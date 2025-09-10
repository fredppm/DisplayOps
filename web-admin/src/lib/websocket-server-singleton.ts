import { WebSocketControllerServer } from './websocket-controller-server';
import { controllerStatusMonitor } from './controller-status-monitor';
import { createContextLogger } from '@/utils/logger';

const wsLogger = createContextLogger('websocket');

// Global instance para sobreviver ao hot-reload do Next.js
declare global {
  var __webSocketServerSingletonInstance: WebSocketServerSingleton | undefined;
}

class WebSocketServerSingleton {
  private static instance: WebSocketServerSingleton;
  private server: WebSocketControllerServer | null = null;
  private isStarted: boolean = false;
  private port: number;

  private constructor() {
    this.port = parseInt(process.env.WEBSOCKET_CONTROLLER_ADMIN_PORT || process.env.ADMIN_PORT || '3000');
  }

  public static getInstance(): WebSocketServerSingleton {
    // Usar global instance para sobreviver ao hot-reload
    if (!global.__webSocketServerSingletonInstance) {
      wsLogger.info('WebSocketServerSingleton: Criando instância GLOBAL singleton (sobrevive hot-reload)');
      global.__webSocketServerSingletonInstance = new WebSocketServerSingleton();
      WebSocketServerSingleton.instance = global.__webSocketServerSingletonInstance;
    } else {
      wsLogger.debug('WebSocketServerSingleton: Reutilizando instância GLOBAL singleton existente');
      WebSocketServerSingleton.instance = global.__webSocketServerSingletonInstance;
    }
    return WebSocketServerSingleton.instance;
  }

  public async startWithIO(io: any): Promise<WebSocketControllerServer> {
    wsLogger.info('WebSocket server start with existing Socket.IO instance requested');

    if (this.isStarted && this.server) {
      wsLogger.debug('WebSocket server already running, returning existing instance');
      return this.server;
    }

    try {
      this.server = new WebSocketControllerServer(this.port);
      
      // Set up event listeners for monitoring
      this.server.on('controller_registered', (controller) => {
        wsLogger.info('Controller registered via WebSocket:', { 
          id: controller.id, 
          name: controller.name 
        });
      });

      this.server.on('controller_status_update', (update) => {
        wsLogger.debug('Controller status update via WebSocket:', { 
          controller_id: update.controller_id,
          status: update.status.status 
        });
      });

      this.server.on('controller_disconnected', (controllerId) => {
        wsLogger.warn('Controller disconnected from WebSocket:', { controller_id: controllerId });
      });

      await this.server.startWithIO(io);
      this.isStarted = true;

      // Start controller status monitor
      controllerStatusMonitor.start();

      wsLogger.info(`WebSocket Controller-Admin server started with existing Socket.IO instance`);
      return this.server;

    } catch (error) {
      wsLogger.error('Failed to start WebSocket Controller-Admin server with Socket.IO:', error);
      throw error;
    }
  }

  public async start(httpServer?: any): Promise<WebSocketControllerServer> {
    wsLogger.info('WebSocket server start requested', {
      isStarted: this.isStarted,
      hasServer: !!this.server,
      hasGlobalServer: !!global.__webSocketServerSingletonInstance?.server
    });

    if (this.isStarted && this.server) {
      wsLogger.debug('WebSocket server already running, returning existing instance');
      return this.server;
    }

    // Check if global instance has a running server (hot reload case)
    if (global.__webSocketServerSingletonInstance?.server && global.__webSocketServerSingletonInstance.isStarted) {
      wsLogger.info('Hot reload detected: reusing existing WebSocket server from global instance');
      this.server = global.__webSocketServerSingletonInstance.server;
      this.isStarted = true;
      return this.server;
    }

    try {
      // Check if WebSocket should be disabled (e.g., in Vercel)
      const disableWebSocket = process.env.DISABLE_WEBSOCKET_INIT === 'true' || process.env.DISABLE_GRPC_INIT === 'true';
      if (disableWebSocket) {
        wsLogger.warn('WebSocket server disabled by environment variable');
        throw new Error('WebSocket server disabled');
      }

      // If we had a previous server instance, force stop it first
      if (this.server) {
        wsLogger.warn('Cleaning up previous server instance before starting new one');
        this.server.forceStop();
        this.server = null;
        // Wait a bit for cleanup
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      this.server = new WebSocketControllerServer(this.port);
      
      // Set up event listeners for monitoring
      this.server.on('controller_registered', (controller) => {
        wsLogger.info('Controller registered via WebSocket:', { 
          id: controller.id, 
          name: controller.name 
        });
      });

      this.server.on('controller_status_update', (update) => {
        wsLogger.debug('Controller status update via WebSocket:', { 
          controller_id: update.controller_id,
          status: update.status.status 
        });
      });

      this.server.on('controller_disconnected', (controllerId) => {
        wsLogger.warn('Controller disconnected from WebSocket:', { controller_id: controllerId });
      });

      await this.server.start(httpServer);
      this.isStarted = true;

      // Start controller status monitor
      controllerStatusMonitor.start();

      wsLogger.info(`WebSocket Controller-Admin server started on port ${this.port}`);
      return this.server;

    } catch (error) {
      // Check if it's a bind error (port in use)
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorCode = (error as any)?.code;
      
      if (errorMessage.includes('bind') || errorMessage.includes('address already in use') || errorCode === 'EADDRINUSE') {
        wsLogger.warn('Port already in use, this may be due to hot reload - attempting graceful handling');
        
        // For hot reload scenarios, don't throw error immediately
        if (global.__webSocketServerSingletonInstance?.server) {
          wsLogger.info('Using existing WebSocket server instance from hot reload');
          this.server = global.__webSocketServerSingletonInstance.server;
          this.isStarted = true;
          return this.server;
        }
        
        // Try cleanup and retry once
        if (this.server) {
          this.server.forceStop();
          this.server = null;
        }
        this.isStarted = false;
        
        // Wait and try once more - the server's ensurePortAvailable() will handle aggressive cleanup
        await new Promise(resolve => setTimeout(resolve, 1000));
        try {
          wsLogger.info('Retrying WebSocket server start after port cleanup...');
          this.server = new WebSocketControllerServer(this.port);
          await this.server.start(httpServer);
          this.isStarted = true;
          controllerStatusMonitor.start();
          wsLogger.info(`WebSocket Controller-Admin server started on port ${this.port} (after retry)`);
          return this.server;
        } catch (retryError) {
          wsLogger.warn('Retry failed, but continuing (may be hot reload):', retryError);
          // Don't throw on retry failure - may be legitimate hot reload
          return this.server || new WebSocketControllerServer(this.port);
        }
      }
      
      wsLogger.error('Failed to start WebSocket Controller-Admin server:', error);
      throw error;
    }
  }

  public async stop(): Promise<void> {
    if (this.server && this.isStarted) {
      // Stop controller status monitor
      controllerStatusMonitor.stop();
      
      await this.server.stop();
      this.server = null;
      this.isStarted = false;
      wsLogger.info('WebSocket Controller-Admin server stopped');
    }
  }

  public forceStop(): void {
    if (this.server) {
      // Stop controller status monitor
      controllerStatusMonitor.stop();
      
      this.server.forceStop();
      this.server = null;
      this.isStarted = false;
      wsLogger.info('WebSocket Controller-Admin server force stopped');
      
      // Small delay to ensure port is released
      setTimeout(() => {
        wsLogger.debug('Port cleanup delay completed');
      }, 1000);
    }
  }

  public getServer(): WebSocketControllerServer | null {
    return this.server;
  }

  public isRunning(): boolean {
    return this.isStarted && this.server !== null;
  }

  public getPort(): number {
    return this.port;
  }

  public getConnectionStats() {
    if (!this.server) {
      return { connected: 0, connections: [] };
    }

    return {
      connected: this.server.getConnectionCount(),
      connections: this.server.getActiveConnections()
    };
  }

  public async restart(httpServer?: any): Promise<WebSocketControllerServer> {
    wsLogger.info('Restarting WebSocket Controller-Admin server...');
    
    // Force stop first
    this.forceStop();
    
    // Wait a bit for cleanup
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Start again
    return await this.start(httpServer);
  }

  public isControllerConnected(controllerId: string): boolean {
    return this.server?.isControllerConnected(controllerId) || false;
  }

  // ================================
  // Dashboard Sync Methods
  // ================================

  public async triggerDashboardSync(): Promise<void> {
    if (!this.server) {
      throw new Error('WebSocket server not initialized');
    }

    wsLogger.info('Triggering dashboard sync for all controllers');
    
    // Marcar todos os controllers como pendentes de sync
    await this.server.markAllControllersForSync();
    
    // Fazer broadcast para controllers online
    await this.server.broadcastDashboardSync();
  }

  public async triggerCookieSync(): Promise<void> {
    if (!this.server) {
      throw new Error('WebSocket server not initialized');
    }

    wsLogger.info('Triggering cookie sync for all controllers');
    
    // Marcar todos os controllers como pendentes de cookie sync
    await this.server.markAllControllersForCookieSync();
    
    // Fazer broadcast para controllers online
    await this.server.broadcastCookieSync();
  }
}

export const webSocketServerSingleton = WebSocketServerSingleton.getInstance();
export default webSocketServerSingleton;

// Export compatibility aliases for existing gRPC code
export const grpcServerSingleton = webSocketServerSingleton;
export { WebSocketServerSingleton as GrpcServerSingleton };