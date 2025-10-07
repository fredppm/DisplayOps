import { MiniPC, HostMetrics, DisplayState } from '@/types/shared-types';
import { DirectHostDiscoveryService } from './direct-host-discovery-service';
import { GrpcClientService } from './server/grpc-client-service';
import { createContextLogger } from '@/utils/logger';

const windowsDiscoveryLogger = createContextLogger('windows-discovery');

export type HostDiscoveredCallback = (host: MiniPC) => void;
export type HostRemovedCallback = (hostId: string) => void;

/**
 * 🚀 Modern Direct Discovery Service for DisplayOps hosts
 * 
 * NEW Features:
 * - Direct connection to Web-Admin API
 * - Real-time gRPC streaming events
 * - Automatic host discovery via Web-Admin
 * - Instant display change notifications via gRPC streams
 * - Automatic reconnection handling
 * 
 * REMOVED:
 * - mDNS discovery (replaced with direct API calls)
 * - HTTP polling (replaced with gRPC streaming)
 * - Fixed IP ranges (now Web-Admin based)
 * - Scan intervals (events are real-time)
 */
export class WindowsDiscoveryService {
  private discoveredHosts: Map<string, MiniPC> = new Map();
  private onHostDiscoveredCallback: HostDiscoveredCallback | null = null;
  private onHostRemovedCallback: HostRemovedCallback | null = null;
  private isRunning: boolean = false;
  private directDiscoveryService: DirectHostDiscoveryService;
  private grpcService: GrpcClientService | null = null;

  constructor(webAdminUrl: string = 'http://localhost:3000') {
    this.directDiscoveryService = new DirectHostDiscoveryService(webAdminUrl);
    
    try {
      this.grpcService = GrpcClientService.getInstance();
      this.setupGrpcEventHandlers();
    } catch (error) {
      windowsDiscoveryLogger.warn('gRPC service not available, continuing with direct discovery only', { error: error instanceof Error ? error.message : String(error) });
      // gRPC service will be null, we'll handle this in other methods
    }
  }

  public async startDiscovery(): Promise<void> {
    if (this.isRunning) {
      windowsDiscoveryLogger.info('Direct Discovery service already running');
      return;
    }

    try {
      windowsDiscoveryLogger.info('🚀 Starting Direct Discovery service');
      
      this.isRunning = true;
      
      // Start direct discovery via Web-Admin
      await this.directDiscoveryService.startDiscovery();
      this.setupDirectDiscoveryCallbacks();
      
      windowsDiscoveryLogger.info('✅ Direct Discovery service started');
      
    } catch (error) {
      windowsDiscoveryLogger.error('❌ Failed to start Direct discovery service', { error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  public stopDiscovery(): void {
    if (!this.isRunning) {
      return;
    }

    windowsDiscoveryLogger.info('🛑 Stopping Direct discovery service');
    
    // Stop gRPC service if available
    if (this.grpcService) {
      this.grpcService.stop();
    }

    // Stop direct discovery
    this.directDiscoveryService.stopDiscovery();
    
    this.discoveredHosts.clear();
    this.isRunning = false;
    
    windowsDiscoveryLogger.info('✅ Direct Discovery service stopped');
  }

  private setupDirectDiscoveryCallbacks(): void {
    // Set up direct discovery callbacks
    this.directDiscoveryService.onHostDiscovered((discoveredHost) => {
      windowsDiscoveryLogger.info('🆕 Direct discovery found host', { 
        hostId: discoveredHost.id,
        hostname: discoveredHost.hostname,
        ipAddress: discoveredHost.ipAddress
      });
      this.connectToDiscoveredHost(discoveredHost);
    });

    this.directDiscoveryService.onHostRemoved((hostId: string) => {
      windowsDiscoveryLogger.info('🗑️ Direct discovery removed host', { hostId });
      this.handleHostRemoved(hostId);
    });
  }

  // Connect to discovered host via gRPC using agentId as unique identifier
  private async connectToDiscoveredHost(discoveredHost: MiniPC): Promise<void> {
    const hostId = discoveredHost.id;
    
    windowsDiscoveryLogger.info('🔗 Connecting to discovered host via gRPC', {
      hostId,
      hostname: discoveredHost.hostname,
      ipAddress: discoveredHost.ipAddress,
      port: discoveredHost.port
    });

    try {
      // Store the discovered host
      this.discoveredHosts.set(hostId, discoveredHost);

      // Connect via gRPC if service is available
      if (this.grpcService) {
        await this.grpcService.connectToHost(discoveredHost);
        windowsDiscoveryLogger.info('✅ gRPC connection established', { hostId });
      } else {
        windowsDiscoveryLogger.warn('⚠️ gRPC service not available, host stored for later connection', { hostId });
      }

      // Notify callback
      if (this.onHostDiscoveredCallback) {
        this.onHostDiscoveredCallback(discoveredHost);
      }

    } catch (error) {
      windowsDiscoveryLogger.error('❌ Failed to connect to host via gRPC', {
        hostId,
        error: error instanceof Error ? error.message : String(error)
      });
      
      // Still store the host even if gRPC connection fails
      this.discoveredHosts.set(hostId, discoveredHost);
      
      if (this.onHostDiscoveredCallback) {
        this.onHostDiscoveredCallback(discoveredHost);
      }
    }
  }

  private handleHostRemoved(hostId: string): void {
    const removedHost = this.discoveredHosts.get(hostId);
    this.discoveredHosts.delete(hostId);

    // Disconnect gRPC if connected
    if (this.grpcService && removedHost) {
      this.grpcService.disconnectHost(hostId);
    }

    // Notify callback
    if (this.onHostRemovedCallback) {
      this.onHostRemovedCallback(hostId);
    }
  }

  private setupGrpcEventHandlers(): void {
    if (!this.grpcService) return;

    // Handle gRPC connection events
    this.grpcService.on('host-connected', (event: { hostId: string; host: MiniPC }) => {
      windowsDiscoveryLogger.info('✅ gRPC host connected', { hostId: event.hostId });
      
      // Update host status
      const host = this.discoveredHosts.get(event.hostId);
      if (host) {
        host.status = 'online';
        this.discoveredHosts.set(event.hostId, host);
      }
    });

    this.grpcService.on('host-disconnected', (event: { hostId: string }) => {
      windowsDiscoveryLogger.info('❌ gRPC host disconnected', { hostId: event.hostId });
      
      // Update host status
      const host = this.discoveredHosts.get(event.hostId);
      if (host) {
        host.status = 'offline';
        this.discoveredHosts.set(event.hostId, host);
      }
    });

    // Handle display state updates via gRPC
    this.grpcService.on('display-state-updated', (event: { hostId: string; displayStates: DisplayState[] }) => {
      const host = this.discoveredHosts.get(event.hostId);
      if (host) {
        host.displayStates = event.displayStates;
        this.discoveredHosts.set(event.hostId, host);
        
        windowsDiscoveryLogger.debug('🔄 Display states updated via gRPC', {
          hostId: event.hostId,
          displayCount: event.displayStates.length
        });
      }
    });
  }

  public onHostDiscovered(callback: HostDiscoveredCallback): void {
    this.onHostDiscoveredCallback = callback;
  }

  public onHostRemoved(callback: HostRemovedCallback): void {
    this.onHostRemovedCallback = callback;
  }

  public getDiscoveredHosts(): MiniPC[] {
    return Array.from(this.discoveredHosts.values());
  }

  public getHostById(hostId: string): MiniPC | null {
    return this.discoveredHosts.get(hostId) || null;
  }

  public isDiscoveryRunning(): boolean {
    return this.isRunning;
  }

  public async forceRefresh(): Promise<void> {
    if (this.isRunning) {
      await this.directDiscoveryService.forceRefresh();
    }
  }

  public getGrpcService(): GrpcClientService | null {
    return this.grpcService;
  }

  public async addManualHost(host: MiniPC): Promise<void> {
    windowsDiscoveryLogger.info('➕ Adding manual host', { hostId: host.id });
    await this.connectToDiscoveredHost(host);
  }

  public async executeCommand(hostId: string, commandType: string, payload: any): Promise<any> {
    if (!this.grpcService) {
      throw new Error('gRPC service not available');
    }
    return await this.grpcService.executeCommand(hostId, commandType, payload);
  }

  public async getHostMetrics(hostId: string): Promise<HostMetrics | null> {
    if (!this.grpcService) {
      return null;
    }
    return await this.grpcService.getHostMetrics(hostId);
  }

  public async getHostHealth(hostId: string): Promise<any> {
    if (!this.grpcService) {
      return null;
    }
    return await this.grpcService.getHostHealth(hostId);
  }
}