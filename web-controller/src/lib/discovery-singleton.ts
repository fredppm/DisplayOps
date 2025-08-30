import { WindowsDiscoveryService } from './windows-discovery-service';
import { MiniPC } from '@/types/shared-types';

// Singleton instance for discovery service
class DiscoverySingleton {
  private static instance: DiscoverySingleton | null = null;
  private discoveryService: WindowsDiscoveryService | null = null;
  private discoveredHosts: MiniPC[] = [];
  private isInitialized: boolean = false;
  private eventHandlers: Set<(hosts: MiniPC[], changeType?: string, changedHost?: MiniPC) => void> = new Set();

  private constructor() {}

  public static getInstance(): DiscoverySingleton {
    if (!DiscoverySingleton.instance) {
      DiscoverySingleton.instance = new DiscoverySingleton();
    }
    return DiscoverySingleton.instance;
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('🔄 Discovery service already initialized');
      return;
    }

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

      // Start discovery in background (non-blocking)
      try {
        console.log('🚀 Starting discovery singleton service...');
        this.isInitialized = true; // Mark as initialized immediately
        
        // Start discovery asynchronously without waiting
        this.discoveryService.startDiscovery().then(() => {
          console.log('✅ Discovery singleton service started');
          console.log('📋 Current discovered hosts:', this.discoveredHosts.length);
        }).catch((error) => {
          console.error('❌ Failed to start discovery singleton service:', error);
          // Don't throw here since the service is already marked as initialized
        });
        
        console.log('✅ Discovery singleton initialized (background scanning)');
      } catch (error) {
        console.error('❌ Failed to initialize discovery singleton service:', error);
        throw error;
      }
    }
  }

  public getHosts(): MiniPC[] {
    return [...this.discoveredHosts]; // Return a copy
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
      this.eventHandlers.clear();
      console.log('🛑 Discovery singleton service stopped');
    }
  }
}

export const discoveryService = DiscoverySingleton.getInstance();

