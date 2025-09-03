import { ControllerAdminGrpcServer } from './grpc-controller-server';
import { controllerStatusMonitor } from './controller-status-monitor';
import { logger } from '@/utils/logger';

class GrpcServerSingleton {
  private static instance: GrpcServerSingleton;
  private server: ControllerAdminGrpcServer | null = null;
  private isStarted: boolean = false;
  private port: number;

  private constructor() {
    this.port = parseInt(process.env.GRPC_CONTROLLER_ADMIN_PORT || '50052');
  }

  public static getInstance(): GrpcServerSingleton {
    if (!GrpcServerSingleton.instance) {
      GrpcServerSingleton.instance = new GrpcServerSingleton();
    }
    return GrpcServerSingleton.instance;
  }

  public async start(): Promise<ControllerAdminGrpcServer> {
    if (this.isStarted && this.server) {
      return this.server;
    }

    try {
      this.server = new ControllerAdminGrpcServer(this.port);
      
      // Set up event listeners for monitoring
      this.server.on('controller_registered', (controller) => {
        logger.info('Controller registered via gRPC:', { 
          id: controller.id, 
          name: controller.name 
        });
      });

      this.server.on('controller_status_update', (update) => {
        logger.debug('Controller status update via gRPC:', { 
          controller_id: update.controller_id,
          status: update.status.status 
        });
      });

      this.server.on('controller_disconnected', (controllerId) => {
        logger.warn('Controller disconnected from gRPC:', { controller_id: controllerId });
      });

      await this.server.start();
      this.isStarted = true;

      // Start controller status monitor
      controllerStatusMonitor.start();

      logger.info(`gRPC Controller-Admin server started on port ${this.port}`);
      return this.server;

    } catch (error) {
      logger.error('Failed to start gRPC Controller-Admin server:', error);
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
      logger.info('gRPC Controller-Admin server stopped');
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

  public isControllerConnected(controllerId: string): boolean {
    return this.server?.isControllerConnected(controllerId) || false;
  }
}

export const grpcServerSingleton = GrpcServerSingleton.getInstance();
export default grpcServerSingleton;