import { grpcServerSingleton } from './grpc-server-singleton';
import { logger } from '@/utils/logger';

let isInitialized = false;
let initPromise: Promise<void> | null = null;

export async function initializeGrpcServer(): Promise<void> {
  // Prevent multiple initializations
  if (isInitialized) {
    return;
  }

  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    try {
      // Check if gRPC is enabled
      const grpcEnabled = process.env.GRPC_CONTROLLER_ADMIN_ENABLED !== 'false';
      
      if (!grpcEnabled) {
        logger.info('gRPC Controller-Admin server disabled via environment variable');
        return;
      }

      logger.info('Initializing gRPC Controller-Admin server...');
      
      await grpcServerSingleton.start();
      
      isInitialized = true;
      logger.info('gRPC Controller-Admin server initialized successfully');

      // Graceful shutdown handling
      const shutdownHandler = async () => {
        logger.info('Shutting down gRPC Controller-Admin server...');
        try {
          await grpcServerSingleton.stop();
          logger.info('gRPC Controller-Admin server shutdown complete');
        } catch (error) {
          logger.error('Error during gRPC server shutdown:', error);
        }
      };

      process.on('SIGTERM', shutdownHandler);
      process.on('SIGINT', shutdownHandler);
      process.on('SIGUSR2', shutdownHandler); // For nodemon restarts

    } catch (error) {
      logger.error('Failed to initialize gRPC Controller-Admin server:', error);
      initPromise = null; // Allow retry on next call
      throw error;
    }
  })();

  return initPromise;
}

export function getGrpcServerStatus() {
  const running = grpcServerSingleton.isRunning();
  return {
    initialized: isInitialized || running, // Consider running as initialized
    running: running,
    port: grpcServerSingleton.getPort(),
    connectionStats: grpcServerSingleton.getConnectionStats()
  };
}

// Auto-initialize in server-side environments
if (typeof window === 'undefined' && process.env.NODE_ENV !== 'test') {
  // Small delay to ensure Next.js is ready
  setTimeout(() => {
    initializeGrpcServer().catch(error => {
      logger.error('Auto-initialization of gRPC server failed:', error);
    });
  }, 1000);
}