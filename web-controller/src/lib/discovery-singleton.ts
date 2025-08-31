import { WindowsDiscoveryService } from './windows-discovery-service';
import { MiniPC } from '@/types/shared-types';

// Singleton instance for discovery service
class DiscoverySingleton {
  private static instance: DiscoverySingleton | null = null;
  private discoveryService: WindowsDiscoveryService | null = null;
  private discoveredHosts: MiniPC[] = [];
  private isInitialized: boolean = false;
  private initializationPromise: Promise<void> | null = null;
  private eventHandlers: Set<(hosts: MiniPC[], changeType?: string, changedHost?: MiniPC) => void> = new Set();

  private constructor() {}

  public static getInstance(): DiscoverySingleton {
    if (!DiscoverySingleton.instance) {
      DiscoverySingleton.instance = new DiscoverySingleton();
    }
    return DiscoverySingleton.instance;
  }

  public async initialize(): Promise<void> {
    // Return existing initialization promise if already in progress
    if (this.initializationPromise) {
      console.log('⏳ Discovery service initialization in progress, waiting...');
      return this.initializationPromise;
    }

    if (this.isInitialized) {
      console.log('🔄 Discovery service already initialized');
      return;
    }

    // Create and store the initialization promise
    this.initializationPromise = this.performInitialization();
    return this.initializationPromise;
  }

  private async performInitialization(): Promise<void> {
    if (!this.discoveryService) {
      this.discoveryService = new WindowsDiscoveryService();
      
      // Set up event handlers
      this.discoveryService.onHostDiscovered((host) => {
        const existingIndex = this.discoveredHosts.findIndex(h => h.id === host.id);
        let isNewHost = false;
        
        if (existingIndex >= 0) {
          this.discoveredHosts[existingIndex] = host;
        } else {
          this.discoveredHosts.push(host);
          isNewHost = true;
        }

        // Update host cache for host-utils
        try {
          const { updateHostCache } = require('./host-utils');
          updateHostCache(host.id, host.ipAddress, host.port);
        } catch (error) {
          console.debug('Could not update host cache:', error);
        }

        // Notify all event handlers
        const changeType = isNewHost ? 'host_added' : 'host_updated';
        this.notifyHandlers(changeType, host);
        console.log(`📡 ${isNewHost ? 'New host discovered' : 'Host updated'}:`, host.id);
      });

      this.discoveryService.onHostRemoved((hostId) => {
        const removedHost = this.discoveredHosts.find(h => h.id === hostId);
        this.discoveredHosts = this.discoveredHosts.filter(h => h.id !== hostId);

        // Notify all event handlers
        this.notifyHandlers('host_removed', removedHost);
        console.log('📡 Host removed:', hostId);
      });

      // Start discovery service
      try {
        console.log('🚀 Starting discovery singleton service...');
        
        await this.discoveryService.startDiscovery();
        this.isInitialized = true;
        
        console.log('✅ Discovery singleton service started');
        console.log('📋 Current discovered hosts:', this.discoveredHosts.length);
        
      } catch (error) {
        console.error('❌ Failed to initialize discovery singleton service:', error);
        this.initializationPromise = null; // Reset so it can be retried
        throw error;
      }
    }
  }

  public getHosts(): MiniPC[] {
    return [...this.discoveredHosts]; // Return a copy
  }

  public getDiscoveredHosts(): MiniPC[] {
    return this.getHosts(); // Alias for compatibility
  }

  public addManualHost(host: MiniPC): void {
    if (this.discoveryService) {
      this.discoveryService.addManualHost(host);
    }
  }

  public onHostsChange(handler: (hosts: MiniPC[], changeType?: string, changedHost?: MiniPC) => void): void {
    this.eventHandlers.add(handler);
  }

  public offHostsChange(handler: (hosts: MiniPC[], changeType?: string, changedHost?: MiniPC) => void): void {
    this.eventHandlers.delete(handler);
  }

  private notifyHandlers(changeType: string, changedHost?: MiniPC): void {
    this.eventHandlers.forEach(handler => {
      try {
        handler([...this.discoveredHosts], changeType, changedHost);
      } catch (error) {
        console.error('❌ Error in discovery event handler:', error);
      }
    });
  }

  public async stop(): Promise<void> {
    if (this.discoveryService) {
      this.discoveryService.stopDiscovery();
      this.discoveryService = null;
      this.discoveredHosts = [];
      this.isInitialized = false;
      this.initializationPromise = null;
      this.eventHandlers.clear();
      console.log('🛑 Discovery singleton service stopped');
    }
  }

  // 🚀 NEW: Get gRPC service for command execution
  public getGrpcService() {
    if (!this.discoveryService) {
      throw new Error('Discovery service not initialized');
    }
    const grpcService = this.discoveryService.getGrpcService();
    if (!grpcService) {
      throw new Error('gRPC service not available');
    }
    return grpcService;
  }
}

export const discoveryService = DiscoverySingleton.getInstance();

// Export function for host-utils compatibility
export function getDiscoveryService() {
  return discoveryService;
}

