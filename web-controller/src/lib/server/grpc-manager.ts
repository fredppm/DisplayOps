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
    this.grpcService = new GrpcClientService();
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
          name: 'Office Display Host',
          hostname: ipAddress,
          ipAddress: ipAddress,
          port: port,
          status: { online: true, cpuUsage: 0, memoryUsage: 0, browserProcesses: 0 },
          lastHeartbeat: new Date(),
          lastDiscovered: new Date(),
          version: '1.0.0',
          tvs: [],
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

  public async refreshDisplay(hostId: string, displayId: string): Promise<any> {
    return this.grpcService.refreshDisplay(hostId, displayId);
  }

  public async validateUrl(hostId: string, url: string, timeoutMs: number = 10000): Promise<any> {
    return this.grpcService.validateUrl(hostId, url, timeoutMs);
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

  public async restartBrowser(hostId: string, displayIds?: string[], forceKill?: boolean): Promise<any> {
    return this.grpcService.restartBrowser(hostId, displayIds, forceKill);
  }

  public async identifyDisplays(hostId: string, durationSeconds: number = 5): Promise<any> {
    return this.grpcService.identifyDisplays(hostId, durationSeconds);
  }

  // Helper method to parse host ID
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