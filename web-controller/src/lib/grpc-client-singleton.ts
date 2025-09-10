import { GrpcAdminClient, GrpcAdminClientConfig } from './grpc-admin-client';
import { createContextLogger } from '../utils/logger';

const logger = createContextLogger('grpc-client-singleton');

class GrpcClientSingleton {
  private static instance: GrpcClientSingleton;
  private client: GrpcAdminClient | null = null;
  private isStarted: boolean = false;
  private config: GrpcAdminClientConfig;

  private constructor() {
    this.config = {
      adminHost: process.env.ADMIN_GRPC_HOST || 'localhost',
      adminPort: parseInt(process.env.ADMIN_GRPC_PORT || '50052'),
      controllerId: process.env.CONTROLLER_ID,
      heartbeatInterval: parseInt(process.env.CONTROLLER_HEARTBEAT_INTERVAL || '30000'),
      reconnectDelay: parseInt(process.env.CONTROLLER_RECONNECT_DELAY || '5000'),
      maxReconnectAttempts: -1 // infinite retries
    };
  }

  public static getInstance(): GrpcClientSingleton {
    if (!GrpcClientSingleton.instance) {
      GrpcClientSingleton.instance = new GrpcClientSingleton();
    }
    return GrpcClientSingleton.instance;
  }

  public async start(): Promise<GrpcAdminClient> {
    logger.info('🚀 gRPC Client Singleton: Starting...', {
      isStarted: this.isStarted,
      hasClient: !!this.client,
      config: {
        adminHost: this.config.adminHost,
        adminPort: this.config.adminPort,
        controllerId: this.config.controllerId
      }
    });

    if (this.isStarted && this.client) {
      logger.info('🔄 gRPC Client already running, returning existing instance');
      return this.client;
    }

    try {
      logger.info('🔧 Creating new gRPC Admin client instance...');
      this.client = new GrpcAdminClient(this.config);
      
      // Set up event listeners for monitoring
      this.client.on('connected', () => {
        logger.info('✅ gRPC Admin client connected successfully!', { 
          adminHost: this.config.adminHost,
          adminPort: this.config.adminPort,
          controllerId: this.client?.id
        });
      });

      this.client.on('registered', (data) => {
        logger.info('🎉 Controller registered successfully via gRPC!', data);
      });

      this.client.on('registration_error', (data) => {
        logger.error('❌ Controller registration failed via gRPC:', data);
      });

      this.client.on('disconnected', () => {
        logger.warn('⚠️ gRPC Admin client disconnected');
      });

      this.client.on('error', (error) => {
        logger.error('💥 gRPC Admin client error:', error);
      });

      this.client.on('max_reconnect_attempts', () => {
        logger.error('🚫 gRPC Admin client: maximum reconnection attempts reached');
      });

      logger.info('🔌 Attempting to connect to gRPC Admin server...');
      await this.client.connect();
      this.isStarted = true;

      logger.info(`🎯 gRPC Admin client started successfully! Connected to ${this.config.adminHost}:${this.config.adminPort}`);
      return this.client;

    } catch (error) {
      logger.error('💥 Failed to start gRPC Admin client:', error);
      throw error;
    }
  }

  public stop(): void {
    if (this.client && this.isStarted) {
      this.client.disconnect();
      this.client = null;
      this.isStarted = false;
      logger.info('gRPC Admin client stopped');
    }
  }

  public getClient(): GrpcAdminClient | null {
    return this.client;
  }

  public isRunning(): boolean {
    return this.isStarted && this.client !== null;
  }

  public isConnected(): boolean {
    return this.client?.connected || false;
  }

  public isRegistered(): boolean {
    return this.client?.registered || false;
  }

  public getControllerId(): string | undefined {
    return this.client?.id;
  }

  public getConfig(): GrpcAdminClientConfig {
    return { ...this.config };
  }

  public getStatus() {
    return {
      running: this.isRunning(),
      connected: this.isConnected(),
      registered: this.isRegistered(),
      controllerId: this.getControllerId(),
      config: {
        adminHost: this.config.adminHost,
        adminPort: this.config.adminPort,
        heartbeatInterval: this.config.heartbeatInterval
      },
      reconnectAttempts: this.client?.reconnectAttemptsCount || 0
    };
  }

  public async restart(): Promise<GrpcAdminClient> {
    logger.info('Restarting gRPC Admin client...');
    this.stop();
    return this.start();
  }
}

export const grpcClientSingleton = GrpcClientSingleton.getInstance();
export default grpcClientSingleton;