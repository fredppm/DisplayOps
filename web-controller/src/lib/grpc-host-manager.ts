import { EventEmitter } from 'events';
import { GrpcHostClient, CommandRequest, CommandResponse, HostEvent } from './grpc-client';

export interface HostInfo {
  id: string;
  name: string;
  hostname: string;
  ipAddress: string;
  port: number;
  grpcPort: number;
}

export interface HostConnection {
  hostInfo: HostInfo;
  client: GrpcHostClient;
  isConnected: boolean;
  lastSeen: Date;
  connectionAttempts: number;
  status?: any;
}

export class GrpcHostManager extends EventEmitter {
  private connections: Map<string, HostConnection> = new Map();
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private healthCheckIntervalMs: number = 30000; // 30 seconds

  constructor() {
    super();
    this.startHealthChecking();
  }

  // Add or update a host
  public addHost(hostInfo: HostInfo): void {
    const existingConnection = this.connections.get(hostInfo.id);
    
    if (existingConnection) {
      // Update existing host info
      existingConnection.hostInfo = hostInfo;
      this.emit('host_updated', hostInfo);
    } else {
      // Create new connection
      const client = new GrpcHostClient({
        host: hostInfo.ipAddress,
        port: hostInfo.grpcPort,
        timeout: 10000
      });

      const connection: HostConnection = {
        hostInfo,
        client,
        isConnected: false,
        lastSeen: new Date(),
        connectionAttempts: 0
      };

      this.setupClientEventHandlers(connection);
      this.connections.set(hostInfo.id, connection);
      
      // Attempt to connect
      this.connectHost(hostInfo.id);
      
      this.emit('host_added', hostInfo);
    }
  }

  // Remove a host
  public removeHost(hostId: string): void {
    const connection = this.connections.get(hostId);
    if (connection) {
      connection.client.disconnect();
      this.connections.delete(hostId);
      this.emit('host_removed', connection.hostInfo);
    }
  }

  // Connect to a specific host
  public connectHost(hostId: string): void {
    const connection = this.connections.get(hostId);
    if (!connection) {
      console.error(`Host ${hostId} not found`);
      return;
    }

    connection.connectionAttempts++;
    
    try {
      connection.client.connect();
    } catch (error) {
      console.error(`Failed to connect to host ${hostId}:`, error);
      this.emit('host_connection_failed', { hostId, error });
    }
  }

  // Disconnect from a specific host
  public disconnectHost(hostId: string): void {
    const connection = this.connections.get(hostId);
    if (connection) {
      connection.client.disconnect();
    }
  }

  // Execute command on a specific host
  public async executeCommand(hostId: string, command: CommandRequest): Promise<CommandResponse> {
    const connection = this.connections.get(hostId);
    if (!connection) {
      throw new Error(`Host ${hostId} not found`);
    }

    if (!connection.isConnected) {
      throw new Error(`Host ${hostId} is not connected`);
    }

    try {
      const response = await connection.client.executeCommand(command);
      this.emit('command_executed', { hostId, command, response });
      return response;
    } catch (error) {
      this.emit('command_failed', { hostId, command, error });
      throw error;
    }
  }

  // Execute command on multiple hosts
  public async executeCommandOnHosts(hostIds: string[], command: Omit<CommandRequest, 'command_id'>): Promise<Map<string, CommandResponse | Error>> {
    const results = new Map<string, CommandResponse | Error>();
    const promises = hostIds.map(async (hostId) => {
      try {
        const commandWithId = {
          ...command,
          command_id: `${command.type}_${hostId}_${Date.now()}`
        };
        const response = await this.executeCommand(hostId, commandWithId);
        results.set(hostId, response);
      } catch (error) {
        results.set(hostId, error as Error);
      }
    });

    await Promise.allSettled(promises);
    return results;
  }

  // Health check a specific host
  public async healthCheckHost(hostId: string): Promise<any> {
    const connection = this.connections.get(hostId);
    if (!connection) {
      throw new Error(`Host ${hostId} not found`);
    }

    try {
      const healthInfo = await connection.client.healthCheck();
      connection.status = healthInfo;
      connection.lastSeen = new Date();
      this.emit('host_health_updated', { hostId, health: healthInfo });
      return healthInfo;
    } catch (error) {
      this.emit('host_health_failed', { hostId, error });
      throw error;
    }
  }

  // Get host connection info
  public getHost(hostId: string): HostConnection | undefined {
    return this.connections.get(hostId);
  }

  // Get all hosts
  public getAllHosts(): HostConnection[] {
    return Array.from(this.connections.values());
  }

  // Get connected hosts
  public getConnectedHosts(): HostConnection[] {
    return Array.from(this.connections.values()).filter(conn => conn.isConnected);
  }

  // Get disconnected hosts
  public getDisconnectedHosts(): HostConnection[] {
    return Array.from(this.connections.values()).filter(conn => !conn.isConnected);
  }

  // Setup event handlers for client
  private setupClientEventHandlers(connection: HostConnection): void {
    const { client, hostInfo } = connection;
    const hostId = hostInfo.id;

    client.on('connected', () => {
      connection.isConnected = true;
      connection.lastSeen = new Date();
      this.emit('host_connected', hostInfo);
    });

    client.on('disconnected', () => {
      connection.isConnected = false;
      this.emit('host_disconnected', hostInfo);
    });

    client.on('event', (event: HostEvent) => {
      connection.lastSeen = new Date();
      this.emit('host_event', { hostId, event });
      
      // Emit specific event types
      if (event.type === 'DISPLAY_STATE_CHANGED') {
        this.emit('display_state_changed', {
          hostId,
          displayId: event.payload.displayId,
          status: event.payload.status
        });
      } else if (event.type === 'HOST_STATUS_CHANGED') {
        connection.status = event.payload.status;
        this.emit('host_status_changed', {
          hostId,
          status: event.payload.status
        });
      } else if (event.type === 'HEARTBEAT') {
        connection.status = event.payload.hostStatus;
        this.emit('host_heartbeat', {
          hostId,
          hostStatus: event.payload.hostStatus,
          displayStatuses: event.payload.displayStatuses
        });
      }
    });

    client.on('command_response', (response: CommandResponse) => {
      this.emit('command_response', { hostId, response });
    });

    client.on('max_reconnect_attempts', () => {
      this.emit('host_max_reconnect_attempts', hostInfo);
    });
  }

  // Health checking for all hosts
  private startHealthChecking(): void {
    this.healthCheckInterval = setInterval(async () => {
      const hosts = this.getConnectedHosts();
      
      for (const connection of hosts) {
        try {
          await this.healthCheckHost(connection.hostInfo.id);
        } catch (error) {
          // Health check failed - connection might be having issues
          console.warn(`Health check failed for host ${connection.hostInfo.id}:`, error);
        }
      }
    }, this.healthCheckIntervalMs);
  }

  // Cleanup
  public destroy(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    // Disconnect all hosts
    for (const connection of this.connections.values()) {
      connection.client.disconnect();
    }
    
    this.connections.clear();
    this.removeAllListeners();
  }

  // Helper methods for common operations
  public async deployDashboard(hostId: string, displayId: string, dashboardConfig: {
    url: string;
    dashboardId?: string;
    fullscreen?: boolean;
    refreshInterval?: number;
  }): Promise<CommandResponse> {
    const command: CommandRequest = {
      command_id: `deploy_${hostId}_${displayId}_${Date.now()}`,
      type: 'deploy_dashboard',
      payload: {
        displayId,
        dashboardId: dashboardConfig.dashboardId || 'default',
        url: dashboardConfig.url,
        fullscreen: dashboardConfig.fullscreen,
        refreshInterval: dashboardConfig.refreshInterval
      }
    };

    return this.executeCommand(hostId, command);
  }

  public async refreshDisplay(hostId: string, displayId: string): Promise<CommandResponse> {
    const command: CommandRequest = {
      command_id: `refresh_${hostId}_${displayId}_${Date.now()}`,
      type: 'refresh_display',
      payload: { displayId }
    };

    return this.executeCommand(hostId, command);
  }

  public async setCookies(hostId: string, cookies: any[], domain: string): Promise<CommandResponse> {
    const command: CommandRequest = {
      command_id: `cookies_${hostId}_${Date.now()}`,
      type: 'set_cookies',
      payload: { cookies, domain }
    };

    return this.executeCommand(hostId, command);
  }

  public async validateUrl(hostId: string, url: string, timeoutMs?: number): Promise<CommandResponse> {
    const command: CommandRequest = {
      command_id: `validate_${hostId}_${Date.now()}`,
      type: 'validate_url',
      payload: { url, timeoutMs }
    };

    return this.executeCommand(hostId, command);
  }

  public async identifyDisplays(hostId: string, options?: {
    duration?: number;
    pattern?: string;
    fontSize?: number;
    backgroundColor?: string;
  }): Promise<CommandResponse> {
    const command: CommandRequest = {
      command_id: `identify_${hostId}_${Date.now()}`,
      type: 'identify_displays',
      payload: options || {}
    };

    return this.executeCommand(hostId, command);
  }

  public async takeScreenshot(hostId: string, displayId: string, options?: {
    format?: string;
    quality?: number;
  }): Promise<CommandResponse> {
    const command: CommandRequest = {
      command_id: `screenshot_${hostId}_${displayId}_${Date.now()}`,
      type: 'take_screenshot',
      payload: { displayId, ...options }
    };

    return this.executeCommand(hostId, command);
  }

  public async updateAgent(hostId: string, options?: {
    version?: string;
    updateUrl?: string;
    forceUpdate?: boolean;
    restartAfterUpdate?: boolean;
  }): Promise<CommandResponse> {
    const command: CommandRequest = {
      command_id: `update_${hostId}_${Date.now()}`,
      type: 'update_agent',
      payload: {
        version: options?.version || 'latest',
        updateUrl: options?.updateUrl || '',
        forceUpdate: options?.forceUpdate || false,
        restartAfterUpdate: options?.restartAfterUpdate || false
      }
    };

    return this.executeCommand(hostId, command);
  }

  public async restartBrowser(hostId: string, options?: {
    displayIds?: string[];
    forceKill?: boolean;
    delaySeconds?: number;
  }): Promise<CommandResponse> {
    const command: CommandRequest = {
      command_id: `restart_${hostId}_${Date.now()}`,
      type: 'restart_browser',
      payload: {
        displayIds: options?.displayIds || [],
        forceKill: options?.forceKill || false,
        delaySeconds: options?.delaySeconds || 0
      }
    };

    return this.executeCommand(hostId, command);
  }
}