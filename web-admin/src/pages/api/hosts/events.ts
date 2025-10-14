import { NextApiRequest, NextApiResponse } from 'next';
import { createContextLogger } from '@/utils/logger';

const logger = createContextLogger('hosts-sse');

// Store active SSE connections
const clients = new Set<NextApiResponse>();

// Function to broadcast events to all connected clients
export function broadcastHostEvent(event: { type: string; host?: any; hostId?: string }) {
  const data = JSON.stringify(event);
  logger.debug('Broadcasting host event to clients', { 
    type: event.type, 
    clientCount: clients.size 
  });
  
  clients.forEach((client) => {
    try {
      client.write(`data: ${data}\n\n`);
    } catch (error) {
      logger.error('Error sending SSE to client:', error);
      clients.delete(client);
    }
  });
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Set headers for SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

  // Add client to active connections
  clients.add(res);
  logger.info('New SSE client connected', { totalClients: clients.size });

  // Send initial connection message
  res.write(`data: ${JSON.stringify({ type: 'connected', message: 'Connected to host events stream' })}\n\n`);

  // Send periodic heartbeat to keep connection alive
  const heartbeatInterval = setInterval(() => {
    try {
      res.write(`: heartbeat\n\n`);
    } catch (error) {
      clearInterval(heartbeatInterval);
      clients.delete(res);
    }
  }, 30000); // Every 30 seconds

  // Handle client disconnect
  req.on('close', () => {
    clearInterval(heartbeatInterval);
    clients.delete(res);
    logger.info('SSE client disconnected', { totalClients: clients.size });
  });
}

