import { NextApiRequest, NextApiResponse } from 'next';
import { discoveryService } from '@/lib/discovery-singleton';
import { MiniPC } from '@/types/shared-types';

let clients: Set<NextApiResponse> = new Set();

// Broadcast message to all connected SSE clients
const broadcastToClients = (event: string, data: any) => {
  const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  
  clients.forEach((client) => {
    try {
      client.write(message);
      client.flush?.(); // Force flush the buffer
    } catch (error) {
      // Remove disconnected clients
      clients.delete(client);
    }
  });
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === 'GET') {
    // Set up Server-Sent Events
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
      'Transfer-Encoding': 'chunked'
    });
    
    // Ensure the connection is established
    res.write(': SSE connection established\n\n');
    res.flush?.();

    // Add client to the set
    clients.add(res);

    // Initialize discovery singleton and register for events
    await discoveryService.initialize();
    
    // Register event handler for this SSE connection
    const eventHandler = (hosts: MiniPC[], changeType?: string, changedHost?: MiniPC) => {
      const eventData = {
        success: true,
        data: hosts,
        timestamp: new Date(),
        changeType: changeType || 'update',
        changedHost
      };
      broadcastToClients('hosts_update', eventData);
    };
    
    discoveryService.onHostsChange(eventHandler);

    // Get current hosts and send immediately
    const initialHosts = discoveryService.getHosts();
    
    // Send initial hosts if available
    if (initialHosts.length > 0) {
      const initialData = {
        success: true,
        data: initialHosts,
        timestamp: new Date(),
        changeType: 'initial_load'
      };
      const initialMessage = `event: hosts_update\ndata: ${JSON.stringify(initialData)}\n\n`;
      res.write(initialMessage);
      res.flush?.();
    } else {
      // Send empty data to establish connection
      const emptyData = {
        success: true,
        data: [],
        timestamp: new Date(),
        changeType: 'initial_empty'
      };
      const emptyMessage = `event: hosts_update\ndata: ${JSON.stringify(emptyData)}\n\n`;
      res.write(emptyMessage);
      res.flush?.();
    }

    // Clean up event handler when client disconnects
    req.on('close', () => {
      discoveryService.offHostsChange(eventHandler);
    });

    // Handle client disconnect
    req.on('close', () => {
      clients.delete(res);
    });

    req.on('error', () => {
      clients.delete(res);
    });

    // Keep connection alive with periodic heartbeat
    const heartbeat = setInterval(() => {
      try {
        res.write(`event: heartbeat\ndata: ${JSON.stringify({ timestamp: new Date() })}\n\n`);
        res.flush?.();
      } catch (error) {
        clearInterval(heartbeat);
        clients.delete(res);
      }
    }, 30000); // Every 30 seconds

    // Clean up on disconnect
    req.on('close', () => {
      clearInterval(heartbeat);
    });

  } else {
    res.setHeader('Allow', ['GET']);
    res.status(405).json({
      success: false,
      error: `Method ${req.method} Not Allowed`
    });
  }
}

// Cleanup on process exit
process.on('SIGTERM', () => {
  clients.clear();
});

process.on('SIGINT', () => {
  clients.clear();
});
