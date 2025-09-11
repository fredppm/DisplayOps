import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { join } from 'path';
import { EventEmitter } from 'events';
import { MiniPC } from '@/types/shared-types';
import { createContextLogger } from '@/utils/logger';

const grpcClientLogger = createContextLogger('grpc-client');

// Load protobuf definition
const PROTO_PATH = process.resourcesPath 
  ? join(process.resourcesPath, 'shared', 'proto', 'host-agent.proto') // Production (Electron packaged)
  : join(process.cwd(), '..', 'shared', 'proto', 'host-agent.proto');  // Development

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true
});

const protoDescriptor = grpc.loadPackageDefinition(packageDefinition) as any;
const displayops = protoDescriptor.displayops;

export interface HostConnection {
  hostId: string;
  host: MiniPC;
  client: any;
  stream: any;
  isConnected: boolean;
  reconnectAttempts: number;
  lastHeartbeat: Date;
}

export interface GrpcHostEvent {
  eventId: string;
  type: string;
  timestamp: Date;
  hostId: string;
  payload: any;
}

// Protobuf CommandType enum mapping (as strings)
const CommandType = {
  OPEN_DASHBOARD: 'OPEN_DASHBOARD',
  REFRESH_DASHBOARD: 'REFRESH_DASHBOARD',
  SET_COOKIES: 'SET_COOKIES',
  HEALTH_CHECK: 'HEALTH_CHECK',
  IDENTIFY_DISPLAYS: 'IDENTIFY_DISPLAYS',
  TAKE_SCREENSHOT: 'TAKE_SCREENSHOT',
  RESTART_DASHBOARD: 'RESTART_DASHBOARD',
  DEBUG_ENABLE: 'DEBUG_ENABLE',
  DEBUG_DISABLE: 'DEBUG_DISABLE',
  REMOVE_DASHBOARD: 'REMOVE_DASHBOARD'
} as const;

/**
 * gRPC client service for streaming events from host agents
 * Replaces HTTP polling with real-time gRPC streaming
 */
// Circuit Breaker states
enum CircuitBreakerState {
  CLOSED = 'CLOSED',     // Normal operation
  OPEN = 'OPEN',         // Circuit is open, not allowing connections
  HALF_OPEN = 'HALF_OPEN' // Testing if service has recovered
}

interface CircuitBreakerInfo {
  state: CircuitBreakerState;
  failureCount: number;
  lastFailureTime: number;
  nextAttemptTime: number;
  consecutiveFailures: number; // Track consecutive failures for exponential backoff
  lastSuccessTime: number; // Track last successful connection
}

// Global instance para sobreviver ao hot-reload do Next.js
declare global {
  var __grpcClientServiceInstance: GrpcClientService | undefined;
}

export class GrpcClientService extends EventEmitter {
  private static instance: GrpcClientService | null = null;
  private connections: Map<string, HostConnection> = new Map();
  private maxReconnectAttempts = 5;
  private baseReconnectDelay = 2000; // 2 seconds base delay
  private maxReconnectDelay = 30000; // 30 seconds max delay
  private heartbeatTimeout = 30000; // 30 seconds (reduced from 60)
  private heartbeatCheckInterval: NodeJS.Timeout | null = null;
  private connectionAttempts: Map<string, number> = new Map();
  
  // Circuit Breaker configuration
  private circuitBreakers: Map<string, CircuitBreakerInfo> = new Map();
  private circuitBreakerFailureThreshold = 3; // Reduced threshold for faster detection
  private circuitBreakerBaseTimeout = 30000; // 30 seconds base timeout
  private circuitBreakerMaxTimeout = 300000; // 5 minutes max timeout
  private circuitBreakerHalfOpenMaxCalls = 2; // Reduced for safer testing

  private constructor() {
    super();
    const instanceId = Math.random().toString(36).substr(2, 8);
    grpcClientLogger.info('GrpcClientService: Nova instância criada', { instanceId });
    (this as any).__instanceId = instanceId;
    this.startHeartbeatMonitoring();
  }

  public static getInstance(): GrpcClientService {
    // Usar global instance para sobreviver ao hot-reload
    if (!global.__grpcClientServiceInstance) {
      grpcClientLogger.info('GrpcClientService: Criando instância GLOBAL singleton (sobrevive hot-reload)');
      global.__grpcClientServiceInstance = new GrpcClientService();
      GrpcClientService.instance = global.__grpcClientServiceInstance;
    } else {
      const existingId = (global.__grpcClientServiceInstance as any).__instanceId;
      grpcClientLogger.info('GrpcClientService: Reutilizando instância GLOBAL singleton existente', { instanceId: existingId });
      GrpcClientService.instance = global.__grpcClientServiceInstance;
    }
    return GrpcClientService.instance;
  }

  /**
   * Connect to a host's gRPC stream
   */
  public async connectToHost(host: MiniPC): Promise<void> {
    // Log received host parameter for debugging
    grpcClientLogger.debug('connectToHost: Received host parameter', {
      hostProvided: !!host,
      hostType: typeof host,
      hostKeys: host ? Object.keys(host) : 'N/A',
      id: host?.id,
      ipAddress: host?.ipAddress,
      port: host?.port
    });
    
    // Validate host parameter and its required properties
    if (!host) {
      const error = new Error('Host parameter is required and cannot be null or undefined');
      grpcClientLogger.error('connectToHost: Host validation failed', { error: error.message });
      throw error;
    }
    
    if (!host.id) {
      const error = new Error('Host must have a valid id property');
      grpcClientLogger.error('connectToHost: Host validation failed', { error: error.message, host });
      throw error;
    }
    
    if (typeof host.id !== 'string' || host.id.trim() === '') {
      const error = new Error('Host id must be a non-empty string');
      grpcClientLogger.error('connectToHost: Host validation failed', { error: error.message, hostId: host.id, type: typeof host.id });
      throw error;
    }
    
    // Validate required host properties for gRPC connection
    if (!host.ipAddress) {
      const error = new Error('Host must have a valid ipAddress property');
      grpcClientLogger.error('connectToHost: Host validation failed', { error: error.message, host });
      throw error;
    }
    
    if (typeof host.ipAddress !== 'string' || !/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host.ipAddress)) {
      const error = new Error('Host ipAddress must be a valid IPv4 address');
      grpcClientLogger.error('connectToHost: Host validation failed', { error: error.message, ipAddress: host.ipAddress, type: typeof host.ipAddress });
      throw error;
    }
    
    const hostId = host.id;
    
    if (this.connections.has(hostId)) {
      const existing = this.connections.get(hostId)!;
      if (existing.isConnected) {
        grpcClientLogger.info('Already connected to host', { hostId });
        return;
      } else {
        grpcClientLogger.info('Existing connection not active, replacing', { hostId });
        this.disconnectFromHost(hostId, 'stale_connection');
      }
    }

    // Validate port and address
    const grpcPort = this.validatePort(host.port) || 8082;
    const grpcAddress = `${host.ipAddress}:${grpcPort}`;
    
    // Check circuit breaker state
    if (!this.canAttemptConnection(hostId)) {
      const breaker = this.circuitBreakers.get(hostId);
      grpcClientLogger.warn('Circuit breaker backing off', { hostId, state: breaker?.state });
      return;
    }

    const attemptCount = this.connectionAttempts.get(hostId) || 0;

    grpcClientLogger.info('Connecting to host', { grpcAddress, attempt: attemptCount + 1 });

    try {
      // Create gRPC client
      const client = new displayops.HostAgent(
        grpcAddress,
        grpc.credentials.createInsecure()
      );

      // Test connection with health check first
      grpcClientLogger.debug('Testing connection', { grpcAddress });
      await this.testConnection(client);
      grpcClientLogger.debug('Health check passed', { grpcAddress });

      // Create stream connection
      grpcClientLogger.debug('Creating event stream', { grpcAddress });
      const stream = client.StreamEvents({});
      
      const connection: HostConnection = {
        hostId,
        host,
        client,
        stream,
        isConnected: true,
        reconnectAttempts: 0,
        lastHeartbeat: new Date()
      };
      
      grpcClientLogger.debug('SET isConnected=true: Nova conexão criada', { hostId });

      // Set up stream event handlers
      this.setupStreamHandlers(connection);
      
      this.connections.set(hostId, connection);
      
      // Reset connection attempts and circuit breaker on success
      this.connectionAttempts.delete(hostId);
      this.resetCircuitBreaker(hostId);
      
      grpcClientLogger.info('Successfully connected to host', { hostId, grpcAddress });
      
      // Emit connection established event
      this.emit('host-connected', { hostId, host });

    } catch (error) {
      // Increment connection attempts and record failure in circuit breaker
      this.connectionAttempts.set(hostId, attemptCount + 1);
      this.recordFailure(hostId);
      
      grpcClientLogger.error('Failed to connect to host', {
        hostId,
        grpcAddress,
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined,
        attempt: attemptCount + 1,
        circuitBreakerState: this.getCircuitBreakerState(hostId)
      });
      
      this.emit('host-connection-failed', { hostId, host, error });
    }
  }

  /**
   * Disconnect from a host
   */
  public disconnectFromHost(hostId: string, reason: string = 'manual'): void {
    const connection = this.connections.get(hostId);
    if (!connection) {
      grpcClientLogger.warn('Attempted to disconnect non-existent connection', { hostId });
      return;
    }

    grpcClientLogger.info('Disconnecting from host', {
      hostId,
      reason,
      wasConnected: connection.isConnected,
      reconnectAttempts: connection.reconnectAttempts,
      lastHeartbeat: connection.lastHeartbeat.toISOString()
    });

    // Mark as disconnected first to prevent race conditions
    grpcClientLogger.debug('SET isConnected=false: Desconectando', { hostId, reason });
    connection.isConnected = false;

    try {
      if (connection.stream) {
        grpcClientLogger.debug('Cancelling stream', { hostId });
        connection.stream.cancel();
        connection.stream.removeAllListeners();
      }
      if (connection.client) {
        grpcClientLogger.debug('Closing client', { hostId });
        connection.client.close();
      }
    } catch (error) {
      grpcClientLogger.error('Error closing connection', {
        hostId,
        error: error instanceof Error ? error.message : error,
        reason
      });
    }

    this.connections.delete(hostId);
    
    // Only emit disconnected event if reason is not a reconnect attempt
    if (reason !== 'reconnect_attempt') {
      this.emit('host-disconnected', { hostId, host: connection.host, reason });
    }
  }

  /**
   * Get list of connected hosts
   */
  public getConnectedHosts(): MiniPC[] {
    return Array.from(this.connections.values())
      .filter(conn => conn.isConnected)
      .map(conn => conn.host);
  }

  /**
   * Check if host is connected
   */
  public isHostConnected(hostId: string): boolean {
    const connection = this.connections.get(hostId);
    return connection ? connection.isConnected : false;
  }

  /**
   * Test gRPC connection with health check and connectivity validation
   */
  private async testConnection(client: any): Promise<void> {
    return new Promise((resolve, reject) => {
      const deadline = new Date();
      deadline.setSeconds(deadline.getSeconds() + 5); // Reduced timeout to 5 seconds for faster failure detection

      const startTime = Date.now();
      
      // Set connection timeout and retry options  
      const options = { 
        deadline,
        retry: false, // No automatic retry for health checks
        maxReceiveMessageLength: 1024 * 1024, // 1MB limit
        maxSendMessageLength: 1024 * 1024
      };
      
      // Use HealthCheck RPC with enhanced error handling
      client.HealthCheck({}, options, (error: any, response: any) => {
        const responseTime = Date.now() - startTime;
        
        if (error) {
          // Classify errors for better circuit breaker decisions
          const errorType = this.classifyGrpcError(error);
          
          grpcClientLogger.error('gRPC HealthCheck failed', {
            error: error instanceof Error ? error.message : error,
            code: error.code,
            details: error.details,
            errorType,
            responseTime: `${responseTime}ms`
          });
          
          // Enhance error with classification for circuit breaker
          const enhancedError = error;
          enhancedError.errorType = errorType;
          enhancedError.responseTime = responseTime;
          
          reject(enhancedError);
        } else {
          // Validate response structure
          if (this.isValidHealthResponse(response)) {
            grpcClientLogger.debug('gRPC HealthCheck successful', {
              responseTime: `${responseTime}ms`,
              hostStatus: response.host_status?.online,
              displayCount: response.display_statuses?.length || 0
            });
            resolve();
          } else {
            const validationError = new Error('Invalid health check response structure');
            grpcClientLogger.warn('Health check response validation failed', { response });
            reject(validationError);
          }
        }
      });
    });
  }

  /**
   * Classify gRPC errors for better circuit breaker decisions
   */
  private classifyGrpcError(error: any): string {
    if (!error.code) return 'UNKNOWN';
    
    switch (error.code) {
      case 14: // UNAVAILABLE
        return error.details?.includes('ECONNRESET') ? 'CONNECTION_RESET' : 
               error.details?.includes('ECONNREFUSED') ? 'CONNECTION_REFUSED' :
               error.details?.includes('ENETUNREACH') ? 'NETWORK_UNREACHABLE' : 'UNAVAILABLE';
      case 4: // DEADLINE_EXCEEDED
        return 'TIMEOUT';
      case 13: // INTERNAL
        return 'INTERNAL_ERROR';
      case 12: // UNIMPLEMENTED
        return 'METHOD_NOT_FOUND';
      case 16: // UNAUTHENTICATED
        return 'AUTH_ERROR';
      default:
        return `GRPC_${error.code}`;
    }
  }

  /**
   * Validate health check response structure
   */
  private isValidHealthResponse(response: any): boolean {
    // For HealthCheck, we expect at least some response structure
    // Even an empty response is valid for basic connectivity test
    return response !== undefined && response !== null;
  }

  /**
   * Set up stream event handlers
   */
  private setupStreamHandlers(connection: HostConnection): void {
    const { hostId, stream } = connection;

    stream.on('data', (event: any) => {
      try {
        this.handleHostEvent(hostId, event);
      } catch (error) {
        grpcClientLogger.error('Error handling event from host', { hostId, error });
      }
    });

    stream.on('end', () => {
      grpcClientLogger.info('Stream ended for host', {
        hostId,
        wasConnected: connection.isConnected,
        reconnectAttempts: connection.reconnectAttempts,
        lastHeartbeat: connection.lastHeartbeat.toISOString()
      });
      grpcClientLogger.debug('SET isConnected=false: Stream ended', { hostId });
      connection.isConnected = false;
      this.handleStreamDisconnection(connection, 'stream_ended');
    });

    stream.on('error', (error: any) => {
      grpcClientLogger.error('Stream error for host', {
        hostId,
        error: error instanceof Error ? error.message : error,
        code: error.code,
        details: error.details,
        metadata: error.metadata,
        wasConnected: connection.isConnected,
        reconnectAttempts: connection.reconnectAttempts
      });
      grpcClientLogger.debug('SET isConnected=false: Stream error', { hostId, code: error.code });
      connection.isConnected = false;
      
      // Don't reconnect immediately on certain errors
      if (error.code === grpc.status.UNAVAILABLE || error.code === grpc.status.DEADLINE_EXCEEDED) {
        grpcClientLogger.warn('Service unavailable or deadline exceeded, will retry later', { hostId });
      }
      
      this.handleStreamDisconnection(connection, 'stream_error');
    });

    stream.on('status', (status: any) => {
      grpcClientLogger.debug('Stream status for host', {
        hostId,
        code: status.code,
        details: status.details,
        metadata: status.metadata
      });
      
      if (status.code !== grpc.status.OK) {
        grpcClientLogger.error('Stream status error for host', { hostId, status });
        grpcClientLogger.debug('SET isConnected=false: Stream status error', { hostId, code: status.code });
        connection.isConnected = false;
        this.handleStreamDisconnection(connection, 'stream_status_error');
      }
    });

    // Add cancellation handler
    stream.on('cancelled', () => {
      grpcClientLogger.info('Stream cancelled for host', { hostId });
      grpcClientLogger.debug('SET isConnected=false: Stream cancelled', { hostId });
      connection.isConnected = false;
      // Don't attempt reconnection for cancelled streams
    });
  }

  /**
   * Handle incoming events from host
   */
  private handleHostEvent(hostId: string, event: any): void {
    const connection = this.connections.get(hostId);
    if (!connection) {
      grpcClientLogger.debug('HEARTBEAT: Evento recebido mas conexão não encontrada no Map', { hostId });
      return;
    }

    // 🔍 DIAGNÓSTICO: Log do heartbeat e estado da conexão
    const eventType = event.type || 'UNKNOWN';
    const instanceId = (this as any).__instanceId;
    grpcClientLogger.debug('HEARTBEAT: Recebido evento', {
      eventType,
      hostId,
      instanceId,
      isConnectedBefore: connection.isConnected,
      reconnectAttemptsBefore: connection.reconnectAttempts
    });

    // Update last heartbeat
    connection.lastHeartbeat = new Date();
    connection.reconnectAttempts = 0; // Reset reconnect attempts on successful communication
    
    grpcClientLogger.debug('HEARTBEAT: Estado após processar evento', {
      hostId,
      isConnectedAfter: connection.isConnected,
      lastHeartbeatUpdated: connection.lastHeartbeat.toISOString()
    });

    // Convert gRPC event to our format
    const hostEvent: GrpcHostEvent = {
      eventId: event.event_id || `event_${Date.now()}`,
      type: event.type || 'UNKNOWN',
      timestamp: this.convertGrpcTimestamp(event.timestamp),
      hostId,
      payload: this.extractEventPayload(event)
    };

    // Emit the event for listeners
    this.emit('host-event', hostEvent);

    // Emit specific event types
    switch (hostEvent.type) {
      case 'DISPLAYS_CHANGED':
        this.emit('displays-changed', {
          hostId,
          host: connection.host,
          ...hostEvent.payload
        });
        break;
      case 'HOST_STATUS_CHANGED':
        this.emit('host-status-changed', {
          hostId,
          host: connection.host,
          ...hostEvent.payload
        });
        break;
      case 'HEARTBEAT':
        grpcClientLogger.debug('HEARTBEAT processado', { hostId, isConnected: connection.isConnected });
        break;
    }
  }

  /**
   * Handle stream disconnection and attempt reconnection
   */
  private async handleStreamDisconnection(connection: HostConnection, reason: string): Promise<void> {
    const { hostId, host } = connection;

    grpcClientLogger.warn('Host disconnected', {
      hostId,
      reason,
      reconnectAttempts: connection.reconnectAttempts,
      lastHeartbeat: connection.lastHeartbeat.toISOString(),
      timeSinceHeartbeat: Date.now() - connection.lastHeartbeat.getTime()
    });
    
    // Emit disconnection event
    this.emit('host-disconnected', { hostId, host, reason });

    // Don't reconnect for certain reasons
    if (reason === 'manual' || reason === 'service_shutdown' || reason === 'stale_connection') {
      grpcClientLogger.info('Not attempting reconnection', { hostId, reason });
      return;
    }

    // Attempt reconnection if not manually disconnected
    if (connection.reconnectAttempts < this.maxReconnectAttempts) {
      connection.reconnectAttempts++;
      
      // Calculate exponential backoff delay
      const backoffDelay = Math.min(
        this.baseReconnectDelay * Math.pow(2, connection.reconnectAttempts - 1),
        this.maxReconnectDelay
      );
      
      grpcClientLogger.info('Attempting to reconnect', {
        hostId,
        attempt: connection.reconnectAttempts,
        maxAttempts: this.maxReconnectAttempts,
        backoffDelay
      });
      
      setTimeout(async () => {
        if (this.connections.has(hostId)) {
          grpcClientLogger.info('Executing reconnection attempt', { hostId, attempt: connection.reconnectAttempts });
          this.disconnectFromHost(hostId, 'reconnect_attempt');
          
          try {
            await this.connectToHost(host);
          } catch (error) {
            grpcClientLogger.error('Reconnection attempt failed', { hostId, attempt: connection.reconnectAttempts, error });
          }
        }
      }, backoffDelay);
    } else {
      // Max reconnect attempts reached, remove connection
      grpcClientLogger.error('Max reconnect attempts reached, giving up', { hostId });
      this.disconnectFromHost(hostId, 'max_reconnects_exceeded');
    }
  }

  /**
   * Extract payload from gRPC event based on type
   */
  private extractEventPayload(event: any): any {
    switch (event.type) {
      case 'DISPLAYS_CHANGED':
        return {
          displays: event.displays_changed?.displays || [],
          changeType: event.displays_changed?.change_type || 'unknown',
          changedDisplay: event.displays_changed?.changed_display
        };
      case 'HOST_STATUS_CHANGED':
        return {
          status: event.host_status_changed?.status
        };
      case 'HEARTBEAT':
        const heartbeatData = {
          hostStatus: event.heartbeat?.host_status,
          displayStatuses: event.heartbeat?.display_statuses || []
        };
        
        // 🔍 LOG: Dashboard information in heartbeat
        grpcClientLogger.debug('DASHBOARD DATA: Heartbeat received', {
          hostStatus: heartbeatData.hostStatus,
          displayCount: heartbeatData.displayStatuses.length,
          displays: heartbeatData.displayStatuses.map((display: any, index: number) => ({
            index: index + 1,
            id: display.display_id || 'N/A',
            active: display.is_active || false,
            dashboard: display.assigned_dashboard?.dashboard_id || 'Nenhum',
            url: display.assigned_dashboard?.url || 'N/A',
            windowId: display.window_id || 'N/A'
          }))
        });
        
        return heartbeatData;
      default:
        return event;
    }
  }

  /**
   * Convert gRPC timestamp to JavaScript Date
   */
  private convertGrpcTimestamp(timestamp: any): Date {
    if (!timestamp) return new Date();
    
    const seconds = parseInt(timestamp.seconds || '0');
    const nanos = parseInt(timestamp.nanos || '0');
    
    return new Date(seconds * 1000 + Math.floor(nanos / 1000000));
  }

  /**
   * Start monitoring heartbeats and clean up stale connections
   */
  private startHeartbeatMonitoring(): void {
    this.heartbeatCheckInterval = setInterval(() => {
      const now = new Date();
      
      this.connections.forEach((connection, hostId) => {
        const timeSinceHeartbeat = now.getTime() - connection.lastHeartbeat.getTime();
        
        if (timeSinceHeartbeat > this.heartbeatTimeout) {
          grpcClientLogger.warn(`gRPC: Host ${hostId} heartbeat timeout (${Math.round(timeSinceHeartbeat/1000)}s)`);
          this.handleStreamDisconnection(connection, 'heartbeat_timeout');
        }
      });
    }, 30000); // Check every 30 seconds
  }

  /**
   * Circuit Breaker Methods
   */
  private canAttemptConnection(hostId: string): boolean {
    const breaker = this.circuitBreakers.get(hostId);
    if (!breaker) {
      return true; // No breaker info means we can attempt
    }

    const now = Date.now();

    switch (breaker.state) {
      case CircuitBreakerState.CLOSED:
        return true;
      
      case CircuitBreakerState.OPEN:
        if (now >= breaker.nextAttemptTime) {
          // Transition to half-open
          breaker.state = CircuitBreakerState.HALF_OPEN;
          grpcClientLogger.info('Circuit breaker transitioning to HALF_OPEN', { hostId });
          return true;
        }
        return false;
      
      case CircuitBreakerState.HALF_OPEN:
        // Allow limited attempts in half-open state
        return breaker.failureCount < this.circuitBreakerHalfOpenMaxCalls;
      
      default:
        return true;
    }
  }

  private recordFailure(hostId: string): void {
    const now = Date.now();
    const breaker = this.circuitBreakers.get(hostId) || {
      state: CircuitBreakerState.CLOSED,
      failureCount: 0,
      lastFailureTime: 0,
      nextAttemptTime: 0,
      consecutiveFailures: 0,
      lastSuccessTime: now
    };

    breaker.failureCount++;
    breaker.consecutiveFailures++;
    breaker.lastFailureTime = now;

    // Calculate exponential backoff with jitter
    const backoffDelay = this.calculateBackoffDelay(breaker.consecutiveFailures);

    if (breaker.state === CircuitBreakerState.HALF_OPEN) {
      // Failed in half-open, go back to open with increased backoff
      breaker.state = CircuitBreakerState.OPEN;
      breaker.nextAttemptTime = now + backoffDelay;
      grpcClientLogger.warn('Circuit breaker failed in HALF_OPEN, transitioning back to OPEN', { 
        hostId, 
        consecutiveFailures: breaker.consecutiveFailures,
        nextAttemptInMs: backoffDelay
      });
    } else if (breaker.failureCount >= this.circuitBreakerFailureThreshold) {
      // Too many failures, open the circuit with backoff
      breaker.state = CircuitBreakerState.OPEN;
      breaker.nextAttemptTime = now + backoffDelay;
      grpcClientLogger.warn('Circuit breaker opened after failures', { 
        hostId, 
        failureCount: breaker.failureCount,
        consecutiveFailures: breaker.consecutiveFailures,
        nextAttemptInMs: backoffDelay
      });
    }

    this.circuitBreakers.set(hostId, breaker);
  }

  /**
   * Calculate exponential backoff delay with jitter to prevent thundering herd
   */
  private calculateBackoffDelay(consecutiveFailures: number): number {
    // Exponential backoff: baseTimeout * (2^failures)
    const exponentialDelay = this.circuitBreakerBaseTimeout * Math.pow(2, Math.min(consecutiveFailures - 1, 5));
    
    // Cap at maximum timeout
    const cappedDelay = Math.min(exponentialDelay, this.circuitBreakerMaxTimeout);
    
    // Add jitter (±25% random variation) to prevent thundering herd
    const jitter = cappedDelay * 0.25 * (Math.random() - 0.5);
    
    return Math.round(cappedDelay + jitter);
  }

  private resetCircuitBreaker(hostId: string): void {
    const breaker = this.circuitBreakers.get(hostId);
    if (breaker) {
      breaker.state = CircuitBreakerState.CLOSED;
      breaker.failureCount = 0;
      breaker.consecutiveFailures = 0; // Reset consecutive failures on success
      breaker.lastSuccessTime = Date.now();
      grpcClientLogger.info('Circuit breaker reset to CLOSED', { hostId });
    }
  }

  private getCircuitBreakerState(hostId: string): string {
    const breaker = this.circuitBreakers.get(hostId);
    return breaker ? `${breaker.state} (failures: ${breaker.failureCount})` : 'CLOSED (no failures)';
  }

  /**
   * Validate port number
   */
  private validatePort(port: number | undefined): number | null {
    if (!port || port < 1 || port > 65535) {
      return null;
    }
    return port;
  }

  /**
   * Reset connection attempts for a host (used when manually reconnecting)
   */
  public resetConnectionAttempts(hostId: string): void {
    this.connectionAttempts.delete(hostId);
    this.resetCircuitBreaker(hostId);
    grpcClientLogger.info('Reset connection attempts and circuit breaker', { hostId });
  }

  /**
   * Get connection statistics for debugging
   */
  public getConnectionStats(): any {
    const stats = {
      totalConnections: this.connections.size,
      activeConnections: Array.from(this.connections.values()).filter(c => c.isConnected).length,
      failedAttempts: Object.fromEntries(this.connectionAttempts.entries()),
      circuitBreakers: Object.fromEntries(
        Array.from(this.circuitBreakers.entries()).map(([hostId, breaker]) => [
          hostId,
          {
            state: breaker.state,
            failureCount: breaker.failureCount,
            lastFailureTime: new Date(breaker.lastFailureTime).toISOString(),
            nextAttemptTime: new Date(breaker.nextAttemptTime).toISOString(),
            canAttempt: this.canAttemptConnection(hostId)
          }
        ])
      ),
      connections: Array.from(this.connections.entries()).map(([hostId, conn]) => ({
        hostId,
        isConnected: conn.isConnected,
        reconnectAttempts: conn.reconnectAttempts,
        lastHeartbeat: conn.lastHeartbeat.toISOString(),
        timeSinceHeartbeat: Date.now() - conn.lastHeartbeat.getTime(),
        circuitBreakerState: this.getCircuitBreakerState(hostId)
      }))
    };
    
    grpcClientLogger.debug('gRPC Connection Stats', stats);
    return stats;
  }

  /**
   * Stop the service and clean up all connections
   */
  public stop(): void {
    grpcClientLogger.info('Stopping client service');
    
    // Clear heartbeat monitoring
    if (this.heartbeatCheckInterval) {
      clearInterval(this.heartbeatCheckInterval);
      this.heartbeatCheckInterval = null;
    }

    // Disconnect all hosts
    const hostIds = Array.from(this.connections.keys());
    hostIds.forEach(hostId => {
      this.disconnectFromHost(hostId, 'service_shutdown');
    });

    // Clear connection attempts and circuit breakers
    this.connectionAttempts.clear();
    this.circuitBreakers.clear();

    grpcClientLogger.info('Client service stopped');
  }

  // ================================
  // gRPC Command Methods
  // ================================

  /**
   * Wait for a host connection to be established (with timeout)
   */
  private async waitForConnection(hostId: string, timeoutMs: number = 5000): Promise<HostConnection> {
    const startTime = Date.now();
    
    // 🔍 DIAGNÓSTICO: Log inicial do estado
    const instanceId = (this as any).__instanceId;
    grpcClientLogger.debug('waitForConnection: Procurando conexão', {
      hostId,
      instanceId,
      totalConnections: this.connections.size,
      availableHostIds: Array.from(this.connections.keys())
    });
    
    let attemptCount = 0;
    
    while (Date.now() - startTime < timeoutMs) {
      attemptCount++;
      const connection = this.connections.get(hostId);
      
      // 🔍 DIAGNÓSTICO: Log detalhado a cada tentativa
      if (attemptCount === 1 || attemptCount % 10 === 0) { // Log na primeira tentativa e depois a cada 10
        grpcClientLogger.debug('waitForConnection: Tentativa', {
          attemptCount,
          hostId,
          connectionFound: !!connection,
          ...(connection ? {
            isConnected: connection.isConnected,
            reconnectAttempts: connection.reconnectAttempts,
            lastHeartbeat: connection.lastHeartbeat.toISOString(),
            timeSinceHeartbeat: Date.now() - connection.lastHeartbeat.getTime(),
            clientExists: !!connection.client,
            streamExists: !!connection.stream
          } : {})
        });
      }
      
      if (connection && connection.isConnected) {
        grpcClientLogger.debug('waitForConnection: Conexão encontrada', {
          hostId,
          attempts: attemptCount,
          duration: Date.now() - startTime
        });
        return connection;
      }
      
      // Wait 100ms before checking again
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // 🔍 DIAGNÓSTICO: Log final de falha com estado completo
    const finalConnection = this.connections.get(hostId);
    grpcClientLogger.error('waitForConnection: TIMEOUT', {
      hostId,
      duration: Date.now() - startTime,
      totalAttempts: attemptCount,
      finalConnectionFound: !!finalConnection,
      ...(finalConnection ? {
        isConnectedFinal: finalConnection.isConnected,
        lastHeartbeatFinal: finalConnection.lastHeartbeat.toISOString(),
        timeSinceHeartbeatFinal: Date.now() - finalConnection.lastHeartbeat.getTime()
      } : {}),
      allConnections: Array.from(this.connections.entries()).map(([id, conn]) => ({
        hostId: id,
        isConnected: conn.isConnected,
        lastHeartbeat: conn.lastHeartbeat.toISOString(),
        timeSinceHeartbeat: Date.now() - conn.lastHeartbeat.getTime()
      }))
    });
    
    throw new Error(`Host ${hostId} is not connected (timeout after ${timeoutMs}ms)`);
  }

  /**
   * Execute a command on a specific host
   */
  public async executeCommand(hostId: string, commandType: string, payload: any): Promise<any> {
    const startTime = Date.now();
    
    try {
      // 🔍 DIAGNÓSTICO: Estado antes de waitForConnection
      const existingConnection = this.connections.get(hostId);
      grpcClientLogger.info('Executing command on host', {
        commandType,
        hostId,
        connectionExists: !!existingConnection,
        ...(existingConnection ? {
          isConnected: existingConnection.isConnected,
          lastHeartbeat: existingConnection.lastHeartbeat.toISOString(),
          timeSinceHeartbeat: Date.now() - existingConnection.lastHeartbeat.getTime()
        } : {})
      });
      
      // Wait for connection to be established (with 10 second timeout)
      const connection = await this.waitForConnection(hostId, 10000);

      const commandId = `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Convert string command type to protobuf enum string
      const commandTypeEnum = CommandType[commandType as keyof typeof CommandType];
      if (commandTypeEnum === undefined) {
        throw new Error(`Unknown command type: "${commandType}". Available types: ${Object.keys(CommandType).join(', ')}`);
      }

      const request: any = {
        command_id: commandId,
        type: commandTypeEnum, // Send as string enum
        timestamp: { 
          seconds: Math.floor(Date.now() / 1000), 
          nanos: (Date.now() % 1000) * 1000000 
        }
      };

      // Add payload only if command requires it (HEALTH_CHECK uses empty message)
      const payloadFieldName = this.getPayloadFieldName(commandType);
      if (payloadFieldName !== 'unknown') {
        request[payloadFieldName] = payload;
      }

      grpcClientLogger.info('Sending command', {
        commandType,
        commandId,
        hostId,
        payload: payloadFieldName !== 'unknown' ? payload : 'empty',
        enum: commandTypeEnum,
        requestType: request.type
      });

      return new Promise((resolve, reject) => {
        // Set timeout for command execution
        const timeout = setTimeout(() => {
          const elapsed = Date.now() - startTime;
          grpcClientLogger.error('Command timed out', { commandType, commandId, elapsed });
          reject(new Error(`Command ${commandId} timed out after ${elapsed}ms`));
        }, 30000); // 30 second timeout

        // 🔧 FORCE: Ensure type is sent as string, not enum number
        const stringRequest = {
          ...request,
          type: String(request.type) // Force conversion to string
        };
        
        // Execute command via gRPC
        connection.client.ExecuteCommand(stringRequest, (error: any, response: any) => {
          clearTimeout(timeout);
          const elapsed = Date.now() - startTime;
          
          if (error) {
            grpcClientLogger.error('Command failed', {
              commandType,
              commandId,
              hostId,
              error: error instanceof Error ? error.message : error,
              code: error.code,
              details: error.details,
              elapsed
            });
            reject(error);
            return;
          }

          if (!response.success) {
            grpcClientLogger.error('Command rejected by host', {
              commandType,
              commandId,
              hostId,
              error: response.error,
              elapsed,
              executionTime: response.execution_time_ms
            });
            reject(new Error(response.error || 'Command failed'));
            return;
          }

          grpcClientLogger.info('Command executed successfully', {
            commandType,
            commandId,
            hostId,
            elapsed,
            executionTime: response.execution_time_ms
          });
          resolve(response);
        });
      });
    } catch (error) {
      const elapsed = Date.now() - startTime;
      grpcClientLogger.error('Command setup failed', {
        commandType,
        hostId,
        error: error instanceof Error ? error.message : error,
        elapsed
      });
      throw error;
    }
  }

  /**
   * Open dashboard on specific display
   */
  public async openDashboard(hostId: string, displayId: string, dashboardConfig: {
    dashboardId: string;
    url: string;
    fullscreen?: boolean;
    refreshInterval?: number;
  }): Promise<any> {
    return this.executeCommand(hostId, 'OPEN_DASHBOARD', {
      display_id: displayId,
      dashboard_id: dashboardConfig.dashboardId,
      url: dashboardConfig.url,
      fullscreen: dashboardConfig.fullscreen !== false,
      refresh_interval_ms: dashboardConfig.refreshInterval || 300000
    });
  }

  /**
   * Refresh display page
   */
  public async refreshDashboard(hostId: string, displayId: string): Promise<any> {
    return this.executeCommand(hostId, 'REFRESH_DASHBOARD', {
      display_id: displayId
    });
  }


  /**
   * Sync cookies to host
   */
  public async syncCookies(hostId: string, cookies: any[], domain?: string): Promise<any> {
    return this.executeCommand(hostId, 'SET_COOKIES', {
      cookies: cookies,
      domain: domain || ''
    });
  }

  /**
   * Get host health status
   */
  public async getHealthStatus(hostId: string): Promise<any> {
    // HEALTH_CHECK command doesn't need payload (uses Empty message)
    return this.executeCommand(hostId, 'HEALTH_CHECK', undefined);
  }

  /**
   * Take screenshot of display
   */
  public async takeScreenshot(hostId: string, displayId: string, format: string = 'png'): Promise<any> {
    return this.executeCommand(hostId, 'TAKE_SCREENSHOT', {
      display_id: displayId,
      format: format,
      quality: format === 'jpeg' ? 90 : undefined
    });
  }

  /**
   * Remove dashboard from display
   */
  public async removeDashboard(hostId: string, displayId: string): Promise<any> {
    return this.executeCommand(hostId, 'REMOVE_DASHBOARD', {
      display_id: displayId
    });
  }

  /**
   * Restart dashboard on displays
   */
  public async restartDashboard(hostId: string, displayIds?: string[], forceKill?: boolean): Promise<any> {
    return this.executeCommand(hostId, 'RESTART_DASHBOARD', {
      display_ids: displayIds || [],
      force_kill: forceKill || false,
      delay_seconds: 2
    });
  }

  /**
   * Identify displays by showing numbers
   */
  public async identifyDisplays(hostId: string, durationSeconds: number = 5, pattern: string = 'blink', fontSize?: number, backgroundColor?: string): Promise<any> {
    return this.executeCommand(hostId, 'IDENTIFY_DISPLAYS', {
      duration_seconds: durationSeconds,
      pattern: pattern,
      font_size: fontSize || 200,
      background_color: backgroundColor || 'rgba(0, 100, 200, 0.9)'
    });
  }

  /**
   * Get debug events from host
   * Note: This is a temporary solution until debug events are properly implemented in gRPC
   */
  public async getDebugEvents(hostId: string, options?: { limit?: number; since?: string }): Promise<any> {
    const connection = this.connections.get(hostId);
    if (!connection || !connection.isConnected) {
      throw new Error(`Host ${hostId} is not connected via gRPC`);
    }

    // For now, we'll fall back to direct HTTP call since debug events aren't in gRPC protocol yet
    // TODO: Implement proper gRPC command when debug events are added to proto
    const { ipAddress, port } = this.parseHostId(hostId);
    if (!ipAddress || !port) {
      throw new Error(`Invalid host ID format: ${hostId}`);
    }

    let url = `http://${ipAddress}:${port}/api/debug/events`;
    const queryParams = [];
    
    if (options?.limit) {
      queryParams.push(`limit=${options.limit}`);
    }
    
    if (options?.since) {
      queryParams.push(`since=${options.since}`);
    }
    
    if (queryParams.length > 0) {
      url += `?${queryParams.join('&')}`;
    }

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      },
      signal: AbortSignal.timeout(10000)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Debug events request failed: ${errorData.error || response.statusText}`);
    }

    return response.json();
  }

  /**
   * Clear debug events on host
   */
  public async clearDebugEvents(hostId: string): Promise<any> {
    const connection = this.connections.get(hostId);
    if (!connection || !connection.isConnected) {
      throw new Error(`Host ${hostId} is not connected via gRPC`);
    }

    // For now, we'll fall back to direct HTTP call since debug events aren't in gRPC protocol yet
    // TODO: Implement proper gRPC command when debug events are added to proto
    const { ipAddress, port } = this.parseHostId(hostId);
    if (!ipAddress || !port) {
      throw new Error(`Invalid host ID format: ${hostId}`);
    }

    const response = await fetch(`http://${ipAddress}:${port}/api/debug/events`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json'
      },
      signal: AbortSignal.timeout(10000)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Clear debug events request failed: ${errorData.error || response.statusText}`);
    }

    return response.json();
  }

  /**
   * Enable debug mode on host
   */
  public async enableDebugMode(hostId: string): Promise<any> {
    return this.executeCommand(hostId, 'DEBUG_ENABLE', {});
  }

  /**
   * Disable debug mode on host
   */
  public async disableDebugMode(hostId: string): Promise<any> {
    return this.executeCommand(hostId, 'DEBUG_DISABLE', {});
  }

  /**
   * Parse host ID to extract IP and port
   */
  private parseHostId(hostId: string): { ipAddress: string; port: number } | { ipAddress: null; port: null } {
    const parts = hostId.split('-');
    
    if (parts.length < 6 || parts[0] !== 'agent') {
      return { ipAddress: null, port: null };
    }
    
    const port = parseInt(parts[parts.length - 1]);
    const ipParts = parts.slice(-5, -1);
    
    if (ipParts.length !== 4 || isNaN(port)) {
      return { ipAddress: null, port: null };
    }
    
    const ipAddress = ipParts.join('.');
    
    if (!/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ipAddress)) {
      return { ipAddress: null, port: null };
    }
    
    return { ipAddress, port };
  }

  /**
   * Helper method to get the correct payload field name for each command type
   */
  private getPayloadFieldName(commandType: string): string {
    const fieldMap: Record<string, string> = {
      'OPEN_DASHBOARD': 'open_dashboard',
      'REFRESH_DASHBOARD': 'refresh_dashboard', 
      'SET_COOKIES': 'set_cookies',
      'IDENTIFY_DISPLAYS': 'identify_displays',
      'TAKE_SCREENSHOT': 'take_screenshot',
      'RESTART_DASHBOARD': 'restart_dashboard',
      'DEBUG_ENABLE': 'debug_enable',
      'DEBUG_DISABLE': 'debug_disable',
      'REMOVE_DASHBOARD': 'remove_dashboard'
      // Note: HEALTH_CHECK doesn't need payload field (uses empty message)
    };
    
    return fieldMap[commandType] || 'unknown';
  }
}

// Export singleton instance para compatibilidade
export const grpcClientService = GrpcClientService.getInstance();