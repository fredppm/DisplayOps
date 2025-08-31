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
const officetv = protoDescriptor.officetv;

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

// Protobuf CommandType enum mapping
const CommandType = {
  OPEN_DASHBOARD: 0,
  REFRESH_DISPLAY: 1,
  SET_COOKIES: 2,
  VALIDATE_URL: 3,
  HEALTH_CHECK: 4,
  IDENTIFY_DISPLAYS: 5,
  TAKE_SCREENSHOT: 6,
  RESTART_BROWSER: 7,
  UPDATE_AGENT: 8
} as const;

/**
 * gRPC client service for streaming events from host agents
 * Replaces HTTP polling with real-time gRPC streaming
 */
export class GrpcClientService extends EventEmitter {
  private connections: Map<string, HostConnection> = new Map();
  private maxReconnectAttempts = 5;
  private reconnectDelay = 5000; // 5 seconds
  private heartbeatTimeout = 60000; // 60 seconds
  private heartbeatCheckInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();
    this.startHeartbeatMonitoring();
  }

  /**
   * Connect to a host's gRPC stream
   */
  public async connectToHost(host: MiniPC): Promise<void> {
    const hostId = host.id;
    
    if (this.connections.has(hostId)) {
      console.log(`📡 gRPC: Already connected to host ${hostId}`);
      return;
    }

    // Use the port directly from mDNS discovery (now gRPC port) or fallback to 8082
    const grpcPort = host.port || 8082;
    const grpcAddress = `${host.ipAddress}:${grpcPort}`;

    console.log(`📡 gRPC: Connecting to host ${grpcAddress}...`);

    try {
      // Create gRPC client
      const client = new officetv.HostAgent(
        grpcAddress,
        grpc.credentials.createInsecure()
      );

      // Test connection with health check first
      await this.testConnection(client);

      // Create stream connection
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

      // Set up stream event handlers
      this.setupStreamHandlers(connection);
      
      this.connections.set(hostId, connection);
      
      console.log(`✅ gRPC: Connected to host ${hostId} (${grpcAddress})`);
      
      // Emit connection established event
      this.emit('host-connected', { hostId, host });

    } catch (error) {
      console.error(`❌ gRPC: Failed to connect to host ${hostId}:`, error);
      this.emit('host-connection-failed', { hostId, host, error });
    }
  }

  /**
   * Disconnect from a host
   */
  public disconnectFromHost(hostId: string, reason: string = 'manual'): void {
    const connection = this.connections.get(hostId);
    if (!connection) return;

    console.log(`📡 gRPC: Disconnecting from host ${hostId} (${reason})`);

    try {
      if (connection.stream) {
        connection.stream.cancel();
      }
      if (connection.client) {
        connection.client.close();
      }
    } catch (error) {
      console.error(`Error closing connection to ${hostId}:`, error);
    }

    this.connections.delete(hostId);
    this.emit('host-disconnected', { hostId, host: connection.host, reason });
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
      deadline.setSeconds(deadline.getSeconds() + 5); // 5 second timeout

      // Use HealthCheck RPC directly (expects Empty message)
      client.HealthCheck({}, { deadline }, (error: any, response: any) => {
        if (error) {
          console.error('gRPC HealthCheck failed:', error);
          reject(error);
        } else {
          console.log('gRPC HealthCheck successful:', response);
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
      this.handleHostEvent(hostId, event);
    });

    stream.on('end', () => {
      console.log(`📡 gRPC: Stream ended for host ${hostId}`);
      connection.isConnected = false;
      this.handleStreamDisconnection(connection, 'stream_ended');
    });

    stream.on('error', (error: any) => {
      console.error(`❌ gRPC: Stream error for host ${hostId}:`, error);
      connection.isConnected = false;
      this.handleStreamDisconnection(connection, 'stream_error');
    });

    stream.on('status', (status: any) => {
      if (status.code !== grpc.status.OK) {
        console.error(`📡 gRPC: Stream status error for host ${hostId}:`, status);
        connection.isConnected = false;
        this.handleStreamDisconnection(connection, 'stream_status_error');
      }
    });
  }

  /**
   * Handle incoming events from host
   */
  private handleHostEvent(hostId: string, event: any): void {
    const connection = this.connections.get(hostId);
    if (!connection) return;

    // Update last heartbeat
    connection.lastHeartbeat = new Date();
    connection.reconnectAttempts = 0; // Reset reconnect attempts on successful communication

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
        // Silent heartbeat processing
        break;
    }
  }

  /**
   * Handle stream disconnection and attempt reconnection
   */
  private async handleStreamDisconnection(connection: HostConnection, reason: string): Promise<void> {
    const { hostId, host } = connection;

    console.log(`⚠️ gRPC: Host ${hostId} disconnected (${reason})`);
    
    // Emit disconnection event
    this.emit('host-disconnected', { hostId, host, reason });

    // Attempt reconnection if not manually disconnected
    if (reason !== 'manual' && connection.reconnectAttempts < this.maxReconnectAttempts) {
      connection.reconnectAttempts++;
      
      console.log(`🔄 gRPC: Attempting to reconnect to ${hostId} (attempt ${connection.reconnectAttempts}/${this.maxReconnectAttempts})`);
      
      setTimeout(() => {
        if (this.connections.has(hostId)) {
          this.disconnectFromHost(hostId, 'reconnect_attempt');
          this.connectToHost(host);
        }
      }, this.reconnectDelay);
    } else {
      // Max reconnect attempts reached, remove connection
      console.error(`❌ gRPC: Max reconnect attempts reached for host ${hostId}`);
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
        return {
          hostStatus: event.heartbeat?.host_status,
          displayStatuses: event.heartbeat?.display_statuses || []
        };
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

    console.log('✅ gRPC: Client service stopped');
  }

  // ================================
  // gRPC Command Methods
  // ================================

  /**
   * Execute a command on a specific host
   */
  public async executeCommand(hostId: string, commandType: string, payload: any): Promise<any> {
    const connection = this.connections.get(hostId);
    if (!connection || !connection.isConnected) {
      throw new Error(`Host ${hostId} is not connected`);
    }

    const commandId = `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Convert string command type to protobuf enum
    const commandTypeEnum = CommandType[commandType as keyof typeof CommandType];
    if (commandTypeEnum === undefined) {
      throw new Error(`Unknown command type: ${commandType}`);
    }

    const request: any = {
      command_id: commandId,
      type: commandTypeEnum, // Use numeric enum value
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

    return new Promise((resolve, reject) => {
      // Set timeout for command execution
      const timeout = setTimeout(() => {
        reject(new Error(`Command ${commandId} timed out`));
      }, 30000); // 30 second timeout

      // Execute command via gRPC
      connection.client.ExecuteCommand(request, (error: any, response: any) => {
        clearTimeout(timeout);
        
        if (error) {
          console.error(`❌ gRPC: Command ${commandType} failed for host ${hostId}:`, error);
          reject(error);
          return;
        }

        if (!response.success) {
          console.error(`❌ gRPC: Command ${commandType} rejected by host ${hostId}:`, response.error);
          reject(new Error(response.error || 'Command failed'));
          return;
        }

        console.log(`✅ gRPC: Command ${commandType} executed successfully on host ${hostId}`);
        resolve(response);
      });
    });
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
  public async refreshDisplay(hostId: string, displayId: string): Promise<any> {
    return this.executeCommand(hostId, 'REFRESH_DISPLAY', {
      display_id: displayId
    });
  }

  /**
   * Validate URL accessibility
   */
  public async validateUrl(hostId: string, url: string, timeoutMs: number = 10000): Promise<any> {
    return this.executeCommand(hostId, 'VALIDATE_URL', {
      url: url,
      timeout_ms: timeoutMs
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
   * Restart browser on displays
   */
  public async restartBrowser(hostId: string, displayIds?: string[], forceKill?: boolean): Promise<any> {
    return this.executeCommand(hostId, 'RESTART_BROWSER', {
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
   * Helper method to get the correct payload field name for each command type
   */
  private getPayloadFieldName(commandType: string): string {
    const fieldMap: Record<string, string> = {
      'OPEN_DASHBOARD': 'open_dashboard',
      'REFRESH_DISPLAY': 'refresh_display', 
      'SET_COOKIES': 'set_cookies',
      'VALIDATE_URL': 'validate_url',
      'IDENTIFY_DISPLAYS': 'identify_displays',
      'TAKE_SCREENSHOT': 'take_screenshot',
      'UPDATE_AGENT': 'update_agent',
      'RESTART_BROWSER': 'restart_browser'
      // Note: HEALTH_CHECK doesn't need payload field (uses empty message)
    };
    
    return fieldMap[commandType] || 'unknown';
  }
}