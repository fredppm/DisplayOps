import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { join } from 'path';
import { EventEmitter } from 'events';
import { MiniPC } from '@/types/shared-types';

// Load protobuf definition
const PROTO_PATH = join(process.cwd(), '..', 'shared', 'proto', 'host-agent.proto');

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true
});

const protoDescriptor = grpc.loadPackageDefinition(packageDefinition) as any;
const screenfleet = protoDescriptor.screenfleet;

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
  private circuitBreakerFailureThreshold = 5;
  private circuitBreakerTimeout = 60000; // 1 minute
  private circuitBreakerHalfOpenMaxCalls = 3;

  private constructor() {
    super();
    const instanceId = Math.random().toString(36).substr(2, 8);
    console.log(`🔧 GrpcClientService: Nova instância criada (ID: ${instanceId})`);
    (this as any).__instanceId = instanceId;
    this.startHeartbeatMonitoring();
  }

  public static getInstance(): GrpcClientService {
    // Usar global instance para sobreviver ao hot-reload
    if (!global.__grpcClientServiceInstance) {
      console.log('🔧 GrpcClientService: Criando instância GLOBAL singleton (sobrevive hot-reload)');
      global.__grpcClientServiceInstance = new GrpcClientService();
      GrpcClientService.instance = global.__grpcClientServiceInstance;
    } else {
      const existingId = (global.__grpcClientServiceInstance as any).__instanceId;
      console.log(`🔧 GrpcClientService: Reutilizando instância GLOBAL singleton existente (ID: ${existingId})`);
      GrpcClientService.instance = global.__grpcClientServiceInstance;
    }
    return GrpcClientService.instance;
  }

  /**
   * Connect to a host's gRPC stream
   */
  public async connectToHost(host: MiniPC): Promise<void> {
    // Log received host parameter for debugging
    console.log(`🔍 connectToHost: Received host parameter:`, {
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
      console.error('❌ connectToHost: Host validation failed:', error.message);
      throw error;
    }
    
    if (!host.id) {
      const error = new Error('Host must have a valid id property');
      console.error('❌ connectToHost: Host validation failed:', error.message, { host });
      throw error;
    }
    
    if (typeof host.id !== 'string' || host.id.trim() === '') {
      const error = new Error('Host id must be a non-empty string');
      console.error('❌ connectToHost: Host validation failed:', error.message, { hostId: host.id, type: typeof host.id });
      throw error;
    }
    
    // Validate required host properties for gRPC connection
    if (!host.ipAddress) {
      const error = new Error('Host must have a valid ipAddress property');
      console.error('❌ connectToHost: Host validation failed:', error.message, { host });
      throw error;
    }
    
    if (typeof host.ipAddress !== 'string' || !/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host.ipAddress)) {
      const error = new Error('Host ipAddress must be a valid IPv4 address');
      console.error('❌ connectToHost: Host validation failed:', error.message, { ipAddress: host.ipAddress, type: typeof host.ipAddress });
      throw error;
    }
    
    const hostId = host.id;
    
    if (this.connections.has(hostId)) {
      const existing = this.connections.get(hostId)!;
      if (existing.isConnected) {
        console.log(`📡 gRPC: Already connected to host ${hostId}`);
        return;
      } else {
        console.log(`📡 gRPC: Existing connection to ${hostId} is not active, replacing...`);
        this.disconnectFromHost(hostId, 'stale_connection');
      }
    }

    // Validate port and address
    const grpcPort = this.validatePort(host.port) || 8082;
    const grpcAddress = `${host.ipAddress}:${grpcPort}`;
    
    // Check circuit breaker state
    if (!this.canAttemptConnection(hostId)) {
      const breaker = this.circuitBreakers.get(hostId);
      console.warn(`⚠️ gRPC: Circuit breaker is ${breaker?.state} for ${hostId}, backing off...`);
      return;
    }

    const attemptCount = this.connectionAttempts.get(hostId) || 0;

    console.log(`📡 gRPC: Connecting to host ${grpcAddress} (attempt ${attemptCount + 1})...`);

    try {
      // Create gRPC client
      const client = new screenfleet.HostAgent(
        grpcAddress,
        grpc.credentials.createInsecure()
      );

      // Test connection with health check first
      console.log(`🔍 gRPC: Testing connection to ${grpcAddress}...`);
      await this.testConnection(client);
      console.log(`✅ gRPC: Health check passed for ${grpcAddress}`);

      // Create stream connection
      console.log(`📡 gRPC: Creating event stream for ${grpcAddress}...`);
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
      
      console.log(`🔍 SET isConnected=true: Nova conexão criada para ${hostId}`);

      // Set up stream event handlers
      this.setupStreamHandlers(connection);
      
      this.connections.set(hostId, connection);
      
      // Reset connection attempts and circuit breaker on success
      this.connectionAttempts.delete(hostId);
      this.resetCircuitBreaker(hostId);
      
      console.log(`✅ gRPC: Successfully connected to host ${hostId} (${grpcAddress})`);
      
      // Emit connection established event
      this.emit('host-connected', { hostId, host });

    } catch (error) {
      // Increment connection attempts and record failure in circuit breaker
      this.connectionAttempts.set(hostId, attemptCount + 1);
      this.recordFailure(hostId);
      
      console.error(`❌ gRPC: Failed to connect to host ${hostId} (${grpcAddress}):`, {
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined,
        attempt: attemptCount + 1,
        grpcAddress,
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
      console.log(`⚠️ gRPC: Attempted to disconnect non-existent connection ${hostId}`);
      return;
    }

    console.log(`📡 gRPC: Disconnecting from host ${hostId} (${reason})`, {
      wasConnected: connection.isConnected,
      reconnectAttempts: connection.reconnectAttempts,
      lastHeartbeat: connection.lastHeartbeat.toISOString()
    });

    // Mark as disconnected first to prevent race conditions
    console.log(`🔍 SET isConnected=false: Desconectando ${hostId} (razão: ${reason})`);
    connection.isConnected = false;

    try {
      if (connection.stream) {
        console.log(`🔄 gRPC: Cancelling stream for ${hostId}`);
        connection.stream.cancel();
        connection.stream.removeAllListeners();
      }
      if (connection.client) {
        console.log(`🔄 gRPC: Closing client for ${hostId}`);
        connection.client.close();
      }
    } catch (error) {
      console.error(`❌ gRPC: Error closing connection to ${hostId}:`, {
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
   * Test gRPC connection with health check
   */
  private async testConnection(client: any): Promise<void> {
    return new Promise((resolve, reject) => {
      const deadline = new Date();
      deadline.setSeconds(deadline.getSeconds() + 10); // Increased timeout to 10 seconds

      const startTime = Date.now();
      
      // Use HealthCheck RPC directly (expects Empty message)
      client.HealthCheck({}, { deadline }, (error: any, response: any) => {
        const responseTime = Date.now() - startTime;
        
        if (error) {
          console.error('gRPC HealthCheck failed:', {
            error: error instanceof Error ? error.message : error,
            code: error.code,
            details: error.details,
            responseTime: `${responseTime}ms`
          });
          reject(error);
        } else {
          console.log('gRPC HealthCheck successful:', {
            responseTime: `${responseTime}ms`,
            hostStatus: response.host_status?.online,
            displayCount: response.display_statuses?.length || 0
          });
          resolve(response);
        }
      });
    });
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
        console.error(`❌ gRPC: Error handling event from ${hostId}:`, error);
      }
    });

    stream.on('end', () => {
      console.log(`📡 gRPC: Stream ended for host ${hostId}`, {
        wasConnected: connection.isConnected,
        reconnectAttempts: connection.reconnectAttempts,
        lastHeartbeat: connection.lastHeartbeat.toISOString()
      });
      console.log(`🔍 SET isConnected=false: Stream ended para ${hostId}`);
      connection.isConnected = false;
      this.handleStreamDisconnection(connection, 'stream_ended');
    });

    stream.on('error', (error: any) => {
      console.error(`❌ gRPC: Stream error for host ${hostId}:`, {
        error: error instanceof Error ? error.message : error,
        code: error.code,
        details: error.details,
        metadata: error.metadata,
        wasConnected: connection.isConnected,
        reconnectAttempts: connection.reconnectAttempts
      });
      console.log(`🔍 SET isConnected=false: Stream error para ${hostId} (código: ${error.code})`);
      connection.isConnected = false;
      
      // Don't reconnect immediately on certain errors
      if (error.code === grpc.status.UNAVAILABLE || error.code === grpc.status.DEADLINE_EXCEEDED) {
        console.log(`⚠️ gRPC: Service unavailable or deadline exceeded for ${hostId}, will retry later`);
      }
      
      this.handleStreamDisconnection(connection, 'stream_error');
    });

    stream.on('status', (status: any) => {
      console.log(`📡 gRPC: Stream status for host ${hostId}:`, {
        code: status.code,
        details: status.details,
        metadata: status.metadata
      });
      
      if (status.code !== grpc.status.OK) {
        console.error(`📡 gRPC: Stream status error for host ${hostId}:`, status);
        console.log(`🔍 SET isConnected=false: Stream status error para ${hostId} (código: ${status.code})`);
        connection.isConnected = false;
        this.handleStreamDisconnection(connection, 'stream_status_error');
      }
    });

    // Add cancellation handler
    stream.on('cancelled', () => {
      console.log(`🚫 gRPC: Stream cancelled for host ${hostId}`);
      console.log(`🔍 SET isConnected=false: Stream cancelled para ${hostId}`);
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
      console.log(`🔍 HEARTBEAT: Evento recebido para ${hostId} mas conexão não encontrada no Map`);
      return;
    }

    // 🔍 DIAGNÓSTICO: Log do heartbeat e estado da conexão
    const eventType = event.type || 'UNKNOWN';
    const instanceId = (this as any).__instanceId;
    console.log(`🔍 HEARTBEAT: Recebido evento ${eventType} para ${hostId} na instância ${instanceId}:`);
    console.log(`  - isConnected ANTES: ${connection.isConnected}`);
    console.log(`  - reconnectAttempts ANTES: ${connection.reconnectAttempts}`);

    // Update last heartbeat
    connection.lastHeartbeat = new Date();
    connection.reconnectAttempts = 0; // Reset reconnect attempts on successful communication
    
    console.log(`🔍 HEARTBEAT: Estado APÓS processar evento:`);
    console.log(`  - isConnected DEPOIS: ${connection.isConnected}`);
    console.log(`  - lastHeartbeat atualizado: ${connection.lastHeartbeat.toISOString()}`);

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
        console.log(`💓 HEARTBEAT processado para ${hostId} - isConnected: ${connection.isConnected}`);
        break;
    }
  }

  /**
   * Handle stream disconnection and attempt reconnection
   */
  private async handleStreamDisconnection(connection: HostConnection, reason: string): Promise<void> {
    const { hostId, host } = connection;

    console.log(`⚠️ gRPC: Host ${hostId} disconnected (${reason})`, {
      reconnectAttempts: connection.reconnectAttempts,
      lastHeartbeat: connection.lastHeartbeat.toISOString(),
      timeSinceHeartbeat: Date.now() - connection.lastHeartbeat.getTime()
    });
    
    // Emit disconnection event
    this.emit('host-disconnected', { hostId, host, reason });

    // Don't reconnect for certain reasons
    if (reason === 'manual' || reason === 'service_shutdown' || reason === 'stale_connection') {
      console.log(`🚫 gRPC: Not attempting reconnection for ${hostId} (reason: ${reason})`);
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
      
      console.log(`🔄 gRPC: Attempting to reconnect to ${hostId} (attempt ${connection.reconnectAttempts}/${this.maxReconnectAttempts}) in ${backoffDelay}ms`);
      
      setTimeout(async () => {
        if (this.connections.has(hostId)) {
          console.log(`🔄 gRPC: Executing reconnection attempt ${connection.reconnectAttempts} for ${hostId}`);
          this.disconnectFromHost(hostId, 'reconnect_attempt');
          
          try {
            await this.connectToHost(host);
          } catch (error) {
            console.error(`🔄 gRPC: Reconnection attempt ${connection.reconnectAttempts} failed for ${hostId}:`, error);
          }
        }
      }, backoffDelay);
    } else {
      // Max reconnect attempts reached, remove connection
      console.error(`❌ gRPC: Max reconnect attempts reached for host ${hostId}, giving up`);
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
        console.log(`🔍 DASHBOARD DATA: Heartbeat received:`);
        console.log(`  - Host Status:`, heartbeatData.hostStatus);
        console.log(`  - Display Count:`, heartbeatData.displayStatuses.length);
        
        heartbeatData.displayStatuses.forEach((display: any, index: number) => {
          console.log(`  - Display ${index + 1}:`);
          console.log(`    - ID: ${display.display_id || 'N/A'}`);
          console.log(`    - Active: ${display.is_active || false}`);
          console.log(`    - Dashboard: ${display.assigned_dashboard?.dashboard_id || 'Nenhum'}`);
          console.log(`    - URL: ${display.assigned_dashboard?.url || 'N/A'}`);
          console.log(`    - Window ID: ${display.window_id || 'N/A'}`);
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
          console.warn(`⏰ gRPC: Host ${hostId} heartbeat timeout (${Math.round(timeSinceHeartbeat/1000)}s)`);
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
          console.log(`🔄 Circuit breaker for ${hostId} transitioning to HALF_OPEN`);
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
    const breaker = this.circuitBreakers.get(hostId) || {
      state: CircuitBreakerState.CLOSED,
      failureCount: 0,
      lastFailureTime: 0,
      nextAttemptTime: 0
    };

    breaker.failureCount++;
    breaker.lastFailureTime = Date.now();

    if (breaker.state === CircuitBreakerState.HALF_OPEN) {
      // Failed in half-open, go back to open
      breaker.state = CircuitBreakerState.OPEN;
      breaker.nextAttemptTime = Date.now() + this.circuitBreakerTimeout;
      console.log(`❌ Circuit breaker for ${hostId} failed in HALF_OPEN, transitioning back to OPEN`);
    } else if (breaker.failureCount >= this.circuitBreakerFailureThreshold) {
      // Too many failures, open the circuit
      breaker.state = CircuitBreakerState.OPEN;
      breaker.nextAttemptTime = Date.now() + this.circuitBreakerTimeout;
      console.log(`❌ Circuit breaker for ${hostId} opened after ${breaker.failureCount} failures`);
    }

    this.circuitBreakers.set(hostId, breaker);
  }

  private resetCircuitBreaker(hostId: string): void {
    const breaker = this.circuitBreakers.get(hostId);
    if (breaker) {
      breaker.state = CircuitBreakerState.CLOSED;
      breaker.failureCount = 0;
      console.log(`✅ Circuit breaker for ${hostId} reset to CLOSED`);
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
    console.log(`🔄 gRPC: Reset connection attempts and circuit breaker for ${hostId}`);
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
    
    console.log('📊 gRPC Connection Stats:', stats);
    return stats;
  }

  /**
   * Stop the service and clean up all connections
   */
  public stop(): void {
    console.log('🛑 gRPC: Stopping client service...');
    
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

    console.log('✅ gRPC: Client service stopped');
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
    console.log(`🔍 waitForConnection: Procurando conexão para hostId: ${hostId}`);
    console.log(`🔍 waitForConnection: Usando instância ID: ${instanceId}`);
    console.log(`🔍 waitForConnection: Total conexões no Map: ${this.connections.size}`);
    console.log(`🔍 waitForConnection: HostIds disponíveis:`, Array.from(this.connections.keys()));
    
    let attemptCount = 0;
    
    while (Date.now() - startTime < timeoutMs) {
      attemptCount++;
      const connection = this.connections.get(hostId);
      
      // 🔍 DIAGNÓSTICO: Log detalhado a cada tentativa
      if (attemptCount === 1 || attemptCount % 10 === 0) { // Log na primeira tentativa e depois a cada 10
        console.log(`🔍 waitForConnection: Tentativa ${attemptCount} para ${hostId}:`);
        console.log(`  - Conexão encontrada: ${connection ? 'SIM' : 'NÃO'}`);
        if (connection) {
          console.log(`  - isConnected: ${connection.isConnected}`);
          console.log(`  - reconnectAttempts: ${connection.reconnectAttempts}`);
          console.log(`  - lastHeartbeat: ${connection.lastHeartbeat.toISOString()}`);
          console.log(`  - timeSinceHeartbeat: ${Date.now() - connection.lastHeartbeat.getTime()}ms`);
          console.log(`  - client exists: ${connection.client ? 'SIM' : 'NÃO'}`);
          console.log(`  - stream exists: ${connection.stream ? 'SIM' : 'NÃO'}`);
        }
      }
      
      if (connection && connection.isConnected) {
        console.log(`✅ waitForConnection: Conexão encontrada para ${hostId} após ${attemptCount} tentativas (${Date.now() - startTime}ms)`);
        return connection;
      }
      
      // Wait 100ms before checking again
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // 🔍 DIAGNÓSTICO: Log final de falha com estado completo
    const finalConnection = this.connections.get(hostId);
    console.error(`❌ waitForConnection: TIMEOUT após ${Date.now() - startTime}ms para ${hostId}:`);
    console.error(`  - Total tentativas: ${attemptCount}`);
    console.error(`  - Conexão final encontrada: ${finalConnection ? 'SIM' : 'NÃO'}`);
    if (finalConnection) {
      console.error(`  - isConnected final: ${finalConnection.isConnected}`);
      console.error(`  - lastHeartbeat final: ${finalConnection.lastHeartbeat.toISOString()}`);
      console.error(`  - timeSinceHeartbeat final: ${Date.now() - finalConnection.lastHeartbeat.getTime()}ms`);
    }
    console.error(`  - Todas as conexões disponíveis:`, Array.from(this.connections.entries()).map(([id, conn]) => ({
      hostId: id,
      isConnected: conn.isConnected,
      lastHeartbeat: conn.lastHeartbeat.toISOString(),
      timeSinceHeartbeat: Date.now() - conn.lastHeartbeat.getTime()
    })));
    
    throw new Error(`Host ${hostId} is not connected (timeout after ${timeoutMs}ms)`);
  }

  /**
   * Execute a command on a specific host
   */
  public async executeCommand(hostId: string, commandType: string, payload: any): Promise<any> {
    const startTime = Date.now();
    
    try {
      // 🔍 DIAGNÓSTICO: Estado antes de waitForConnection
      console.log(`🚀 gRPC: Executing command ${commandType} on host ${hostId}...`);
      const existingConnection = this.connections.get(hostId);
      console.log(`🔍 COMMAND: Estado antes de waitForConnection:`);
      console.log(`  - Conexão existe no Map: ${existingConnection ? 'SIM' : 'NÃO'}`);
      if (existingConnection) {
        console.log(`  - isConnected: ${existingConnection.isConnected}`);
        console.log(`  - lastHeartbeat: ${existingConnection.lastHeartbeat.toISOString()}`);
        console.log(`  - timeSinceHeartbeat: ${Date.now() - existingConnection.lastHeartbeat.getTime()}ms`);
      }
      
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

      console.log(`📫 gRPC: Sending command ${commandType} (${commandId}) to ${hostId}`, {
        payload: payloadFieldName !== 'unknown' ? payload : 'empty',
        enum: commandTypeEnum,
        requestType: request.type,
        fullRequest: request
      });

      return new Promise((resolve, reject) => {
        // Set timeout for command execution
        const timeout = setTimeout(() => {
          const elapsed = Date.now() - startTime;
          console.error(`⏰ gRPC: Command ${commandType} (${commandId}) timed out after ${elapsed}ms`);
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
            console.error(`❌ gRPC: Command ${commandType} (${commandId}) failed for host ${hostId}:`, {
              error: error instanceof Error ? error.message : error,
              code: error.code,
              details: error.details,
              elapsed: `${elapsed}ms`
            });
            reject(error);
            return;
          }

          if (!response.success) {
            console.error(`❌ gRPC: Command ${commandType} (${commandId}) rejected by host ${hostId}:`, {
              error: response.error,
              elapsed: `${elapsed}ms`,
              executionTime: response.execution_time_ms ? `${response.execution_time_ms}ms` : 'unknown'
            });
            reject(new Error(response.error || 'Command failed'));
            return;
          }

          console.log(`✅ gRPC: Command ${commandType} (${commandId}) executed successfully on host ${hostId}`, {
            elapsed: `${elapsed}ms`,
            executionTime: response.execution_time_ms ? `${response.execution_time_ms}ms` : 'unknown'
          });
          resolve(response);
        });
      });
    } catch (error) {
      const elapsed = Date.now() - startTime;
      console.error(`❌ gRPC: Command ${commandType} setup failed for host ${hostId}:`, {
        error: error instanceof Error ? error.message : error,
        elapsed: `${elapsed}ms`
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