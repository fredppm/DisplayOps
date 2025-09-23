import { WindowsDiscoveryService } from './windows-discovery-service';
import { MiniPC } from '@/types/shared-types';
import { createContextLogger } from '../utils/logger';

const discoveryLogger = createContextLogger('discovery');

// Global instance para sobreviver ao hot-reload do Next.js
declare global {
  var __discoverySingletonInstance: DiscoverySingleton | undefined;
}

// Singleton instance for discovery service
class DiscoverySingleton {
  private static instance: DiscoverySingleton | null = null;
  private discoveryService: WindowsDiscoveryService | null = null;
  private discoveredHosts: MiniPC[] = [];
  private isInitialized: boolean = false;
  private initializationPromise: Promise<void> | null = null;
  private eventHandlers: Set<(hosts: MiniPC[], changeType?: string, changedHost?: MiniPC) => void> = new Set();

  private constructor() {
    const instanceId = Math.random().toString(36).substr(2, 8);
    discoveryLogger.info(`🔧 DiscoverySingleton: Nova instância criada (ID: ${instanceId})`);
    (this as any).__instanceId = instanceId;
  }

  public static getInstance(): DiscoverySingleton {
    // Usar global instance para sobreviver ao hot-reload
    if (!global.__discoverySingletonInstance) {
      discoveryLogger.info('🔧 DiscoverySingleton: Criando instância GLOBAL singleton (sobrevive hot-reload)');
      global.__discoverySingletonInstance = new DiscoverySingleton();
      DiscoverySingleton.instance = global.__discoverySingletonInstance;
    } else {
      const existingId = (global.__discoverySingletonInstance as any).__instanceId;
      discoveryLogger.info(`🔧 DiscoverySingleton: Reutilizando instância GLOBAL singleton existente (ID: ${existingId})`);
      DiscoverySingleton.instance = global.__discoverySingletonInstance;
    }
    return DiscoverySingleton.instance;
  }

  public async initialize(): Promise<void> {
    // Return existing initialization promise if already in progress
    if (this.initializationPromise) {
      discoveryLogger.info('⏳ Discovery service initialization in progress, waiting...');
      return this.initializationPromise;
    }

    if (this.isInitialized) {
      discoveryLogger.info('🔄 Discovery service already initialized');
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
          discoveryLogger.debug('Could not update host cache:', error);
        }

        // Notify all event handlers
        const changeType = isNewHost ? 'host_added' : 'host_updated';
        this.notifyHandlers(changeType, host);
        discoveryLogger.info(`📡 ${isNewHost ? 'New host discovered' : 'Host updated'}:`, { hostId: host.id });
      });

      this.discoveryService.onHostRemoved((hostId) => {
        const removedHost = this.discoveredHosts.find(h => h.id === hostId);
        this.discoveredHosts = this.discoveredHosts.filter(h => h.id !== hostId);

        // Notify all event handlers
        this.notifyHandlers('host_removed', removedHost);
        discoveryLogger.info('📡 Host removed:', hostId);
      });

      // Start discovery service
      try {
        discoveryLogger.info('🚀 Starting discovery singleton service...');
        
        await this.discoveryService.startDiscovery();
        
        // 🔄 SINCRONIZAÇÃO: Recuperar hosts já conectados do gRPC service
        discoveryLogger.info('🔄 Iniciando sincronização de hosts existentes...');
        this.syncExistingHostsFromGrpc();
        
        // 🔄 SINCRONIZAÇÃO ATRASADA: Verificar novamente após mDNS discovery
        setTimeout(() => {
          discoveryLogger.info('🔄 Verificação atrasada de hosts conectados via gRPC...');
          this.syncExistingHostsFromGrpc();
        }, 2000); // 2 segundos após inicialização
        
        this.isInitialized = true;
        
        discoveryLogger.info('✅ Discovery singleton service started');
        discoveryLogger.info('📋 Current discovered hosts:', this.discoveredHosts.length);
        
      } catch (error) {
        discoveryLogger.error('❌ Failed to initialize discovery singleton service:', error);
        this.initializationPromise = null; // Reset so it can be retried
        throw error;
      }
    }
  }

  // 🔄 NEW: Sync existing hosts from gRPC service (for hot reload recovery)
  private syncExistingHostsFromGrpc(): void {
    try {
      const grpcService = this.discoveryService?.getGrpcService();
      if (!grpcService) {
        discoveryLogger.info('🔄 No gRPC service available for host sync');
        return;
      }

      const connectedHosts = grpcService.getConnectedHosts();
      discoveryLogger.info(`🔄 Syncing ${connectedHosts.length} existing hosts from gRPC service`);

      connectedHosts.forEach(host => {
        const existingIndex = this.discoveredHosts.findIndex(h => h.id === host.id);
        if (existingIndex >= 0) {
          this.discoveredHosts[existingIndex] = host;
          discoveryLogger.info(`🔄 Updated existing host: ${host.id}`);
        } else {
          this.discoveredHosts.push(host);
          discoveryLogger.info(`🔄 Added previously connected host: ${host.id}`);
        }

        // Update host cache for host-utils
        try {
          const { updateHostCache } = require('./host-utils');
          updateHostCache(host.id, host.ipAddress, host.port);
        } catch (error) {
          discoveryLogger.debug('Could not update host cache during sync:', error);
        }

        // Notify all event handlers
        this.notifyHandlers('host_synced', host);
      });

      discoveryLogger.info(`✅ Host sync completed: ${this.discoveredHosts.length} total hosts available`);
    } catch (error) {
      discoveryLogger.error('❌ Failed to sync hosts from gRPC service:', error);
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
        discoveryLogger.error('❌ Error in discovery event handler:', error);
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
      discoveryLogger.info('🛑 Discovery singleton service stopped');
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

