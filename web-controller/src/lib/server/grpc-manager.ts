import { GrpcClientService } from './grpc-client-service';
import { MiniPC } from '@/types/shared-types';

/**
 * Server-side gRPC manager for communicating with host agents
 * Used by Next.js API routes to send commands to hosts
 */
class GrpcManagerSingleton {
  private static instance: GrpcManagerSingleton | null = null;
  private grpcService: GrpcClientService;
  private connectedHosts: Map<string, MiniPC> = new Map();
  private isInitialized: boolean = false;

  private constructor() {
    console.log('🔧 GrpcManager: Inicializando com GrpcClientService singleton');
    this.grpcService = GrpcClientService.getInstance();
    this.setupEventHandlers();
  }

  public static getInstance(): GrpcManagerSingleton {
    if (!GrpcManagerSingleton.instance) {
      GrpcManagerSingleton.instance = new GrpcManagerSingleton();
    }
    return GrpcManagerSingleton.instance;
  }

  private setupEventHandlers(): void {
    this.grpcService.on('host-connected', ({ hostId, host }) => {
      console.log(`🔌 gRPC Manager: Host ${hostId} connected`);
      this.connectedHosts.set(hostId, host);
    });

    this.grpcService.on('host-disconnected', ({ hostId }) => {
      console.log(`🔌 gRPC Manager: Host ${hostId} disconnected`);
      this.connectedHosts.delete(hostId);
    });
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    // Start the gRPC client service
    console.log('🚀 gRPC Manager: Initializing server-side gRPC client...');
    this.isInitialized = true;
  }

  public async connectToHost(host: MiniPC): Promise<void> {
    console.log(`🔌 gRPC Manager: Connecting to host ${host.id}...`);
    await this.grpcService.connectToHost(host);
  }

  public isHostConnected(hostId: string): boolean {
    return this.connectedHosts.has(hostId);
  }

  public getConnectedHosts(): MiniPC[] {
    return Array.from(this.connectedHosts.values());
  }

  // ================================
  // Command Methods for API Routes
  // ================================

  public async executeCommand(hostId: string, commandType: string, payload: any): Promise<any> {
    if (!this.isHostConnected(hostId)) {
      // Try to connect first if we have host info
      const { ipAddress, port } = this.parseHostId(hostId);
      if (ipAddress && port) {
        const host: MiniPC = {
          id: hostId,
          name: 'DisplayOps Host',
          hostname: ipAddress,
          ipAddress: ipAddress,
          port: port,
          metrics: { online: true, cpuUsage: 0, memoryUsage: 0, browserProcesses: 0 },
          lastHeartbeat: new Date(),
          lastDiscovered: new Date(),
          version: '1.0.0',
          displays: []
        };
        
        await this.connectToHost(host);
        
        // Wait a moment for connection to establish
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      if (!this.isHostConnected(hostId)) {
        throw new Error(`Host ${hostId} is not connected via gRPC`);
      }
    }

    return this.grpcService.executeCommand(hostId, commandType, payload);
  }

  public async openDashboard(hostId: string, displayId: string, dashboardConfig: {
    dashboardId: string;
    url: string;
    fullscreen?: boolean;
    refreshInterval?: number;
  }): Promise<any> {
    return this.grpcService.openDashboard(hostId, displayId, dashboardConfig);
  }

  public async refreshDashboard(hostId: string, displayId: string): Promise<any> {
    return this.grpcService.refreshDashboard(hostId, displayId);
  }


  public async syncCookies(hostId: string, cookies: any[], domain?: string): Promise<any> {
    return this.grpcService.syncCookies(hostId, cookies, domain);
  }

  public async getHealthStatus(hostId: string): Promise<any> {
    return this.grpcService.getHealthStatus(hostId);
  }

  public async takeScreenshot(hostId: string, displayId: string, format: string = 'png'): Promise<any> {
    return this.grpcService.takeScreenshot(hostId, displayId, format);
  }

  public async removeDashboard(hostId: string, displayId: string): Promise<any> {
    return this.grpcService.removeDashboard(hostId, displayId);
  }

  public async restartDashboard(hostId: string, displayIds?: string[], forceKill?: boolean): Promise<any> {
    return this.grpcService.restartDashboard(hostId, displayIds, forceKill);
  }

  public async identifyDisplays(hostId: string, durationSeconds: number = 5): Promise<any> {
    return this.grpcService.identifyDisplays(hostId, durationSeconds);
  }

  public async getDebugEvents(hostId: string, options?: { limit?: number; since?: string }): Promise<any> {
    return this.grpcService.getDebugEvents(hostId, options);
  }

  public async clearDebugEvents(hostId: string): Promise<any> {
    return this.grpcService.clearDebugEvents(hostId);
  }

  // ================================
  // Debug and Management Methods
  // ================================

  public getConnectionStats(): any {
    return this.grpcService.getConnectionStats();
  }

  public async resetConnectionAttempts(hostId: string): Promise<void> {
    this.grpcService.resetConnectionAttempts(hostId);
  }

  public async forceReconnectHost(hostId: string): Promise<any> {
    console.log(`🔄 gRPC Manager: Force reconnecting to host ${hostId}`);
    
    // First disconnect if connected
    if (this.isHostConnected(hostId)) {
      this.grpcService.disconnectFromHost(hostId, 'manual');
      
      // Wait a moment for cleanup
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Try to parse host info and reconnect
    const { ipAddress, port } = this.parseHostId(hostId);
    if (!ipAddress || !port) {
      throw new Error(`Cannot parse host info from hostId: ${hostId}`);
    }
    
    const host: MiniPC = {
      id: hostId,
      name: 'DisplayOps Host',
      hostname: ipAddress,
      ipAddress: ipAddress,
      port: port,
      metrics: { online: true, cpuUsage: 0, memoryUsage: 0, browserProcesses: 0 },
      lastHeartbeat: new Date(),
      lastDiscovered: new Date(),
      version: '1.0.0',
      displays: []
    };
    
    await this.connectToHost(host);
    
    return {
      hostId,
      reconnectAttempted: true,
      timestamp: new Date().toISOString()
    };
  }

  public async getDetailedHostStatus(hostId: string): Promise<any> {
    const isConnected = this.isHostConnected(hostId);
    const stats = this.grpcService.getConnectionStats();
    
    // Find this host in the connection stats
    const hostStats = stats.connections.find((conn: any) => conn.hostId === hostId);
    const circuitBreakerInfo = stats.circuitBreakers[hostId];
    
    let healthStatus = null;
    if (isConnected) {
      try {
        healthStatus = await this.getHealthStatus(hostId);
      } catch (error) {
        console.error(`Failed to get health status for ${hostId}:`, error);
      }
    }
    
    return {
      hostId,
      isConnected,
      connectionStats: hostStats || null,
      circuitBreaker: circuitBreakerInfo || null,
      healthStatus,
      lastChecked: new Date().toISOString()
    };
  }

  public async clearAllCircuitBreakers(): Promise<void> {
    console.log('🔄 gRPC Manager: Clearing all circuit breakers');
    
    // Get all host IDs from connected hosts and connection stats
    const connectedHostIds = Array.from(this.connectedHosts.keys());
    const stats = this.grpcService.getConnectionStats();
    const allHostIds = new Set([
      ...connectedHostIds,
      ...Object.keys(stats.circuitBreakers || {}),
      ...stats.connections.map((conn: any) => conn.hostId)
    ]);
    
    // Reset connection attempts for all hosts
    for (const hostId of allHostIds) {
      this.grpcService.resetConnectionAttempts(hostId);
    }
  }

  // ================================
  // Helper Methods
  // ================================

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
}

// Export singleton instance
export const grpcManager = GrpcManagerSingleton.getInstance();