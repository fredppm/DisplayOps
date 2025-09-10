import { WebSocketControllerServer } from './websocket-controller-server';
import { createContextLogger } from '@/utils/logger';

const wsInitLogger = createContextLogger('websocket-init');

let webSocketServer: WebSocketControllerServer | null = null;

export async function initializeWebSocketServer(httpServer?: any): Promise<WebSocketControllerServer> {
  if (webSocketServer) {
    wsInitLogger.info('WebSocket Controller Server already initialized');
    return webSocketServer;
  }

  try {
    // Check if WebSocket should be disabled (e.g., during build or in specific environments)
    const disableWebSocket = process.env.DISABLE_WEBSOCKET === 'true' || 
                             process.env.DISABLE_WEBSOCKET_INIT === 'true' ||
                             process.env.NODE_ENV === 'test';
    
    if (disableWebSocket) {
      wsInitLogger.warn('WebSocket server disabled by environment variable');
      throw new Error('WebSocket server disabled');
    }

    // During Next.js build, skip server initialization
    if (process.env.NODE_ENV === 'production' && !httpServer) {
      wsInitLogger.warn('Skipping WebSocket server during production build');
      throw new Error('WebSocket server skipped during build');
    }

    // Get port from environment or use default
    const port = parseInt(process.env.WEBSOCKET_CONTROLLER_ADMIN_PORT || process.env.ADMIN_PORT || '3000');
    
    wsInitLogger.info('Initializing WebSocket Controller Server', { port });
    
    webSocketServer = new WebSocketControllerServer(port);
    
    // Add graceful shutdown handlers
    setupShutdownHandlers(webSocketServer);
    
    // Start the server
    await webSocketServer.start(httpServer);
    
    wsInitLogger.info('WebSocket Controller Server initialized successfully');
    
    return webSocketServer;
    
  } catch (error) {
    wsInitLogger.error('Failed to initialize WebSocket Controller Server:', error);
    throw error;
  }
}

export function getWebSocketServer(): WebSocketControllerServer | null {
  return webSocketServer;
}

export async function shutdownWebSocketServer(): Promise<void> {
  if (webSocketServer) {
    wsInitLogger.info('Shutting down WebSocket Controller Server');
    
    try {
      await webSocketServer.stop();
      webSocketServer = null;
      wsInitLogger.info('WebSocket Controller Server shut down successfully');
    } catch (error) {
      wsInitLogger.error('Error during WebSocket server shutdown:', error);
      // Force shutdown if graceful shutdown fails
      if (webSocketServer) {
        webSocketServer.forceStop();
      }
      webSocketServer = null;
    }
  }
}

function setupShutdownHandlers(server: WebSocketControllerServer): void {
  // Handle different process termination signals
  const shutdownSignals = ['SIGTERM', 'SIGINT', 'SIGQUIT'];
  
  shutdownSignals.forEach((signal) => {
    process.on(signal, async () => {
      wsInitLogger.info(`Received ${signal}, initiating graceful shutdown`);
      
      try {
        await server.stop();
        process.exit(0);
      } catch (error) {
        wsInitLogger.error('Error during graceful shutdown:', error);
        server.forceStop();
        process.exit(1);
      }
    });
  });

  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    wsInitLogger.error('Uncaught exception, forcing server shutdown:', error);
    server.forceStop();
    process.exit(1);
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    wsInitLogger.error('Unhandled promise rejection:', { reason, promise });
    // Don't exit on unhandled rejections, just log them
  });

  // Handle development hot reload
  if (process.env.NODE_ENV === 'development') {
    // Next.js hot reload cleanup
    if (typeof window === 'undefined' && (module as any).hot) {
      (module as any).hot.dispose(() => {
        wsInitLogger.info('Hot reload cleanup: stopping WebSocket server');
        server.forceStop();
      });
    }
  }
}

// Export for compatibility with existing gRPC initialization
export { initializeWebSocketServer as initializeGrpcServer };
export { getWebSocketServer as getGrpcServer };
export { shutdownWebSocketServer as shutdownGrpcServer };