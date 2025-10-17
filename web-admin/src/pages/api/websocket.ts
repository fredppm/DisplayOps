import { NextApiRequest } from 'next';
import { NextApiResponseServerIO } from '@/types/socket';
import { Server as SocketIOServer } from 'socket.io';
import { createContextLogger } from '@/utils/logger';
import { socketHostManager } from '@/lib/socket-host-manager';

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
    
    // Initialize host manager
    socketHostManager.initialize(io);
    
    wsLogger.info('✅ Socket.IO server initialized with host manager');
  } else {
    wsLogger.debug('Socket.IO server already initialized');
  }

  res.end();
}