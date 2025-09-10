import { HybridAdminClient, HybridAdminClientConfig } from './hybrid-admin-client';
import { createContextLogger } from '../utils/logger';

const hybridLogger = createContextLogger('hybrid-admin');

// Global instance para sobreviver ao hot-reload do Next.js
declare global {
  var __hybridAdminClientSingletonInstance: HybridAdminClientSingleton | undefined;
}

class HybridAdminClientSingleton {
  private static instance: HybridAdminClientSingleton;
  private client: HybridAdminClient | null = null;
  private isStarted: boolean = false;
  private config: HybridAdminClientConfig;

  private constructor() {
    this.config = {
      adminHost: process.env.ADMIN_HOST || 'localhost',
      adminPort: parseInt(process.env.ADMIN_PORT || '3000'),
      controllerId: process.env.CONTROLLER_ID,
      heartbeatInterval: parseInt(process.env.CONTROLLER_HEARTBEAT_INTERVAL || '30000'),
      useHttps: process.env.ADMIN_USE_HTTPS === 'true',
      preferWebSocket: process.env.PREFER_WEBSOCKET !== 'false', // Default to true
      websocketTimeout: parseInt(process.env.WEBSOCKET_TIMEOUT || '10000'),
      fallbackDelay: parseInt(process.env.FALLBACK_DELAY || '2000')
    };
  }

  public static getInstance(): HybridAdminClientSingleton {
    // Usar global instance para sobreviver ao hot-reload
    if (!global.__hybridAdminClientSingletonInstance) {
      hybridLogger.info('HybridAdminClientSingleton: Criando instância GLOBAL singleton (sobrevive hot-reload)');
      global.__hybridAdminClientSingletonInstance = new HybridAdminClientSingleton();
      HybridAdminClientSingleton.instance = global.__hybridAdminClientSingletonInstance;
    } else {
      hybridLogger.debug('HybridAdminClientSingleton: Reutilizando instância GLOBAL singleton existente');
      HybridAdminClientSingleton.instance = global.__hybridAdminClientSingletonInstance;
    }
    return HybridAdminClientSingleton.instance;
  }

  public async start(): Promise<HybridAdminClient> {
    if (this.isStarted && this.client) {
      hybridLogger.debug('Hybrid Admin client already running, returning existing instance');
      return this.client;
    }

    try {
      // If we had a previous client instance, disconnect it first
      if (this.client) {
        hybridLogger.warn('Cleaning up previous client instance before starting new one');
        this.client.disconnect();
        this.client = null;
        // Wait a bit for cleanup
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      this.client = new HybridAdminClient(this.config);
      
      // Set up event listeners for monitoring and logging
      this.client.on('connected', (data) => {
        hybridLogger.info('Hybrid Admin client connected', { mode: data.mode });
      });

      this.client.on('registered', (data) => {
        hybridLogger.info('Controller registered via Hybrid Admin client', { 
          mode: data.mode,
          controllerId: data.controllerId,
          siteId: data.siteId
        });
      });

      this.client.on('disconnected', () => {
        hybridLogger.warn('Hybrid Admin client disconnected');
      });

      this.client.on('connection_failed', () => {
        hybridLogger.error('All connection methods failed in Hybrid Admin client');
      });

      this.client.on('dashboard_sync', (data) => {
        hybridLogger.info('Dashboard sync received', {
          dashboardsCount: data.dashboards?.length || 0,
          syncType: data.syncType
        });
      });

      this.client.on('cookie_sync', (data) => {
        hybridLogger.info('Cookie sync received', {
          domainsCount: Object.keys(data.cookiesData?.domains || {}).length,
          syncType: data.syncType
        });
      });

      this.client.on('error', (error) => {
        hybridLogger.error('Hybrid Admin client error:', error);
      });

      await this.client.connect();
      this.isStarted = true;

      hybridLogger.info(`Hybrid Admin client started successfully`, {
        adminHost: this.config.adminHost,
        adminPort: this.config.adminPort,
        preferWebSocket: this.config.preferWebSocket,
        mode: this.client.connectionMode
      });
      
      return this.client;

    } catch (error) {
      hybridLogger.error('Failed to start Hybrid Admin client:', error);
      this.client = null;
      this.isStarted = false;
      throw error;
    }
  }

  public stop(): void {
    if (this.client && this.isStarted) {
      this.client.disconnect();
      this.client = null;
      this.isStarted = false;
      hybridLogger.info('Hybrid Admin client stopped');
    }
  }

  public getClient(): HybridAdminClient | null {
    return this.client;
  }

  public isRunning(): boolean {
    return this.isStarted && this.client !== null;
  }

  public getConfig(): HybridAdminClientConfig {
    return { ...this.config };
  }

  public getConnectionInfo() {
    if (!this.client) {
      return { 
        mode: 'none' as const, 
        connected: false, 
        registered: false, 
        attempts: 0 
      };
    }

    return this.client.getConnectionInfo();
  }

  public async restart(): Promise<HybridAdminClient> {
    hybridLogger.info('Restarting Hybrid Admin client...');
    
    // Stop first
    this.stop();
    
    // Wait a bit for cleanup
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Start again
    return await this.start();
  }

  public isConnected(): boolean {
    return this.client?.connected || false;
  }

  public isRegistered(): boolean {
    return this.client?.registered || false;
  }

  public getControllerId(): string {
    return this.client?.id || 'unknown';
  }

  public getConnectionMode(): 'websocket' | 'http' | 'none' {
    return this.client?.connectionMode || 'none';
  }

  public async forceMode(mode: 'websocket' | 'http'): Promise<void> {
    if (!this.client) {
      throw new Error('Hybrid Admin client not initialized');
    }

    hybridLogger.info(`Forcing connection mode to ${mode}`);
    await this.client.forceMode(mode);
  }

  // Update configuration
  public updateConfig(newConfig: Partial<HybridAdminClientConfig>): void {
    this.config = { ...this.config, ...newConfig };
    hybridLogger.info('Configuration updated', newConfig);
    
    // If client is running, suggest restart
    if (this.isStarted) {
      hybridLogger.warn('Configuration changed while client is running. Consider restarting for changes to take effect.');
    }
  }
}

export const hybridAdminClientSingleton = HybridAdminClientSingleton.getInstance();
export default hybridAdminClientSingleton;