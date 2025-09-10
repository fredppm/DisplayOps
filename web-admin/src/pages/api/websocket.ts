import { NextApiRequest } from 'next';
import { NextApiResponseServerIO } from '@/types/socket';
import { Server as SocketIOServer } from 'socket.io';
import { WebSocketControllerServer } from '@/lib/websocket-controller-server';
import { createContextLogger } from '@/utils/logger';

const wsLogger = createContextLogger('websocket-api');

// Global para persistir entre hot reloads
declare global {
  var __websocketController: WebSocketControllerServer | undefined;
}

export default async function handler(req: NextApiRequest, res: NextApiResponseServerIO) {
  if (!res.socket.server.io) {
    wsLogger.info('Initializing Socket.IO server for the first time');
    
    // Create Socket.IO server
    const io = new SocketIOServer(res.socket.server, {
      path: '/api/websocket',
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      },
      transports: ['websocket', 'polling'],
      pingTimeout: 60000,
      pingInterval: 25000,
      allowEIO3: true
    });

    // Attach to response
    res.socket.server.io = io;

    // Initialize WebSocket controller server (reuse existing instance if available)
    if (!global.__websocketController) {
      wsLogger.info('Creating new WebSocket controller instance');
      global.__websocketController = new WebSocketControllerServer(3000);
      
      // Set up event listeners
      global.__websocketController.on('controller_registered', (controller) => {
        wsLogger.info('Controller registered:', { id: controller.id, name: controller.name });
      });
    } else {
      wsLogger.info('Reusing existing WebSocket controller instance (hot reload)');
    }

    // Start with existing IO instance
    try {
      await global.__websocketController.startWithIO(io);
      wsLogger.info('WebSocket controller server started successfully');
    } catch (error) {
      wsLogger.error('Failed to start WebSocket controller:', error);
    }
  } else {
    wsLogger.debug('Socket.IO server already initialized');
  }

  res.end();
}