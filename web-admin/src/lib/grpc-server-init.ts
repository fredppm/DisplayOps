import { grpcServerSingleton } from './grpc-server-singleton';
import { createContextLogger } from '@/utils/logger';

const grpcInitLogger = createContextLogger('grpc-init');

let isInitialized = false;
let initPromise: Promise<void> | null = null;

export async function initializeGrpcServer(): Promise<void> {
  // Prevent multiple initializations
  if (isInitialized || grpcServerSingleton.isRunning()) {
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
        grpcInitLogger.info('gRPC Controller-Admin server disabled via environment variable');
        return;
      }

      grpcInitLogger.info('Initializing gRPC Controller-Admin server...');
      
      await grpcServerSingleton.start();
      
      isInitialized = true;
      grpcInitLogger.info('gRPC Controller-Admin server initialized successfully');

      // Graceful shutdown handling
      const shutdownHandler = async () => {
        grpcInitLogger.info('Shutting down gRPC Controller-Admin server...');
        try {
          await grpcServerSingleton.stop();
          grpcInitLogger.info('gRPC Controller-Admin server shutdown complete');
        } catch (error) {
          grpcInitLogger.error('Error during gRPC server shutdown:', error);
          // Force stop if graceful fails
          grpcServerSingleton.forceStop();
        }
      };

      // Enhanced shutdown handlers for dev environments
      process.on('SIGTERM', shutdownHandler);
      process.on('SIGINT', shutdownHandler);
      process.on('SIGUSR2', shutdownHandler); // For nodemon restarts
      
      // Enhanced Next.js hotreload handling
      if (process.env.NODE_ENV === 'development') {
        // Handle various development signals
        process.on('SIGKILL', () => {
          grpcInitLogger.warn('SIGKILL received, force stopping gRPC server');
          grpcServerSingleton.forceStop();
        });
        
        // Handle webpack HMR dispose
        if (module.hot) {
          module.hot.dispose(() => {
            grpcInitLogger.info('HMR dispose detected, force stopping gRPC server');
            grpcServerSingleton.forceStop();
            // Reset initialization flag
            isInitialized = false;
            initPromise = null;
          });
          
          module.hot.accept(() => {
            grpcInitLogger.info('HMR accept detected, preparing for server restart');
          });
        }
        
        // Handle process exit/uncaught exceptions in development
        process.on('exit', () => {
          grpcInitLogger.info('Process exit detected, cleaning up gRPC server');
          grpcServerSingleton.forceStop();
        });
        
        process.on('uncaughtException', (error) => {
          grpcInitLogger.error('Uncaught exception, force stopping gRPC server:', error);
          grpcServerSingleton.forceStop();
        });
        
        process.on('unhandledRejection', (reason) => {
          grpcInitLogger.error('Unhandled rejection, force stopping gRPC server:', reason);
          grpcServerSingleton.forceStop();
        });
        
        // Next.js specific hot reload detection via file watching
        if (typeof window === 'undefined') {
          const fs = require('fs');
          let hotReloadDetected = false;
          
          // Watch for Next.js build indicator files
          const buildIndicators = ['.next/trace', '.next/BUILD_ID'];
          buildIndicators.forEach(indicator => {
            const watchPath = require('path').join(process.cwd(), indicator);
            if (fs.existsSync(watchPath)) {
              fs.watchFile(watchPath, () => {
                if (!hotReloadDetected) {
                  hotReloadDetected = true;
                  grpcInitLogger.info('Next.js hot reload detected via build indicator, stopping gRPC server');
                  grpcServerSingleton.forceStop();
                  setTimeout(() => { hotReloadDetected = false; }, 5000);
                }
              });
            }
          });
        }
      }

    } catch (error) {
      grpcInitLogger.error('Failed to initialize gRPC Controller-Admin server:', error);
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
      grpcInitLogger.error('Auto-initialization of gRPC server failed:', error);
    });
  }, 1000);
}