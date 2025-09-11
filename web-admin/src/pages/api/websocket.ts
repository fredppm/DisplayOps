import { NextApiRequest } from 'next';
import { NextApiResponseServerIO } from '@/types/socket';
import { Server as SocketIOServer } from 'socket.io';
import { webSocketServerSingleton } from '@/lib/websocket-server-singleton';
import { createContextLogger } from '@/utils/logger';

const wsLogger = createContextLogger('websocket-api');

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

    // Use the singleton instance instead of creating a separate global
    try {
      await webSocketServerSingleton.startWithIO(io);
      wsLogger.info('WebSocket controller server started successfully via singleton');
    } catch (error) {
      wsLogger.error('Failed to start WebSocket controller via singleton:', error);
    }
  } else {
    wsLogger.debug('Socket.IO server already initialized');
  }

  res.end();
}