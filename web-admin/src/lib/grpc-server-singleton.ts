import { ControllerAdminGrpcServer } from './grpc-controller-server';
import { controllerStatusMonitor } from './controller-status-monitor';
import { createContextLogger } from '@/utils/logger';

const grpcLogger = createContextLogger('grpc');

// Global instance para sobreviver ao hot-reload do Next.js
declare global {
  var __grpcServerSingletonInstance: GrpcServerSingleton | undefined;
}

class GrpcServerSingleton {
  private static instance: GrpcServerSingleton;
  private server: ControllerAdminGrpcServer | null = null;
  private isStarted: boolean = false;
  private port: number;

  private constructor() {
    this.port = parseInt(process.env.GRPC_CONTROLLER_ADMIN_PORT || '50052');
  }

  public static getInstance(): GrpcServerSingleton {
    // Usar global instance para sobreviver ao hot-reload
    if (!global.__grpcServerSingletonInstance) {
      grpcLogger.info('GrpcServerSingleton: Criando instância GLOBAL singleton (sobrevive hot-reload)');
      global.__grpcServerSingletonInstance = new GrpcServerSingleton();
      GrpcServerSingleton.instance = global.__grpcServerSingletonInstance;
    } else {
      grpcLogger.debug('GrpcServerSingleton: Reutilizando instância GLOBAL singleton existente');
      GrpcServerSingleton.instance = global.__grpcServerSingletonInstance;
    }
    return GrpcServerSingleton.instance;
  }

  public async start(): Promise<ControllerAdminGrpcServer> {
    if (this.isStarted && this.server) {
      grpcLogger.debug('gRPC server already running, returning existing instance');
      return this.server;
    }

    try {
      // If we had a previous server instance, force stop it first
      if (this.server) {
        grpcLogger.warn('Cleaning up previous server instance before starting new one');
        this.server.forceStop();
        this.server = null;
        // Wait a bit for cleanup
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      this.server = new ControllerAdminGrpcServer(this.port);
      
      // Set up event listeners for monitoring
      this.server.on('controller_registered', (controller) => {
        grpcLogger.info('Controller registered via gRPC:', { 
          id: controller.id, 
          name: controller.name 
        });
      });

      this.server.on('controller_status_update', (update) => {
        grpcLogger.debug('Controller status update via gRPC:', { 
          controller_id: update.controller_id,
          status: update.status.status 
        });
      });

      this.server.on('controller_disconnected', (controllerId) => {
        grpcLogger.warn('Controller disconnected from gRPC:', { controller_id: controllerId });
      });

      await this.server.start();
      this.isStarted = true;

      // Start controller status monitor
      controllerStatusMonitor.start();

      grpcLogger.info(`gRPC Controller-Admin server started on port ${this.port}`);
      return this.server;

    } catch (error) {
      // Check if it's a bind error (port in use)
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('bind') || errorMessage.includes('address already in use')) {
        grpcLogger.warn('Port already in use, attempting cleanup and retry...');
        if (this.server) {
          this.server.forceStop();
          this.server = null;
        }
        this.isStarted = false;
        
        // Wait longer and try once more
        await new Promise(resolve => setTimeout(resolve, 2000));
        try {
          grpcLogger.info('Retrying gRPC server start after port cleanup...');
          this.server = new ControllerAdminGrpcServer(this.port);
          await this.server.start();
          this.isStarted = true;
          controllerStatusMonitor.start();
          grpcLogger.info(`gRPC Controller-Admin server started on port ${this.port} (after retry)`);
          return this.server;
        } catch (retryError) {
          grpcLogger.error('Retry failed, giving up:', retryError);
          throw retryError;
        }
      }
      
      grpcLogger.error('Failed to start gRPC Controller-Admin server:', error);
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
      grpcLogger.info('gRPC Controller-Admin server stopped');
    }
  }

  public forceStop(): void {
    if (this.server) {
      // Stop controller status monitor
      controllerStatusMonitor.stop();
      
      this.server.forceStop();
      this.server = null;
      this.isStarted = false;
      grpcLogger.info('gRPC Controller-Admin server force stopped');
      
      // Small delay to ensure port is released
      setTimeout(() => {
        grpcLogger.debug('Port cleanup delay completed');
      }, 1000);
    }
  }

  public getServer(): ControllerAdminGrpcServer | null {
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

  public async restart(): Promise<ControllerAdminGrpcServer> {
    grpcLogger.info('Restarting gRPC Controller-Admin server...');
    
    // Force stop first
    this.forceStop();
    
    // Wait a bit for cleanup
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Start again
    return await this.start();
  }

  public isControllerConnected(controllerId: string): boolean {
    return this.server?.isControllerConnected(controllerId) || false;
  }

  // ================================
  // Dashboard Sync Methods
  // ================================

  public async triggerDashboardSync(): Promise<void> {
    if (!this.server) {
      throw new Error('gRPC server not initialized');
    }

    grpcLogger.info('Triggering dashboard sync for all controllers');
    
    // Marcar todos os controllers como pendentes de sync
    await this.server.markAllControllersForSync();
    
    // Fazer broadcast para controllers online
    await this.server.broadcastDashboardSync();
  }

  public async triggerCookieSync(): Promise<void> {
    if (!this.server) {
      throw new Error('gRPC server not initialized');
    }

    grpcLogger.info('Triggering cookie sync for all controllers');
    
    // Marcar todos os controllers como pendentes de cookie sync
    await this.server.markAllControllersForCookieSync();
    
    // Fazer broadcast para controllers online
    await this.server.broadcastCookieSync();
  }
}

export const grpcServerSingleton = GrpcServerSingleton.getInstance();
export default grpcServerSingleton;