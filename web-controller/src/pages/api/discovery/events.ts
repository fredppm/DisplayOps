import { NextApiRequest, NextApiResponse } from 'next';
import { discoveryService } from '@/lib/discovery-singleton';
import { MiniPC } from '@/types/shared-types';

// Enhanced client management with metadata
interface SSEClient {
  response: NextApiResponse;
  connectedAt: Date;
  lastHeartbeat: Date;
  lastSuccessfulWrite: Date;
  id: string;
}

let clients: Map<string, SSEClient> = new Map();
let heartbeatInterval: NodeJS.Timeout | null = null;

// Broadcast message to all connected SSE clients
const broadcastToClients = (event: string, data: any) => {
  const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  
  const disconnectedClients: string[] = [];
  
  clients.forEach((client, clientId) => {
    // Check if connection is destroyed/closed before writing
    if (client.response.destroyed || client.response.writableEnded) {
      console.log(`🔌 Client ${clientId} connection destroyed during broadcast, removing`);
      disconnectedClients.push(clientId);
      return;
    }

    try {
      client.response.write(message);
      client.response.flush?.(); // Force flush the buffer
      client.lastSuccessfulWrite = new Date(); // Track successful broadcast writes
    } catch (error) {
      console.log(`❌ Client ${clientId} disconnected during broadcast`);
      disconnectedClients.push(clientId);
    }
  });
  
  // Remove disconnected clients
  disconnectedClients.forEach(clientId => {
    clients.delete(clientId);
  });
};

// Send heartbeat to all clients
const sendHeartbeat = () => {
  const now = new Date();
  const disconnectedClients: string[] = [];
  const staleTimeout = 30000; // 30 seconds timeout for stale connections
  
  clients.forEach((client, clientId) => {
    // Check if connection is destroyed/closed
    if (client.response.destroyed || client.response.writableEnded) {
      console.log(`🔌 Client ${clientId} connection destroyed, removing`);
      disconnectedClients.push(clientId);
      return;
    }

    // Check for stale connections (no successful write in last 30s)
    const timeSinceLastWrite = now.getTime() - client.lastSuccessfulWrite.getTime();
    if (timeSinceLastWrite > staleTimeout) {
      console.log(`⏰ Client ${clientId} stale (${Math.round(timeSinceLastWrite/1000)}s), removing`);
      disconnectedClients.push(clientId);
      return;
    }

    try {
      client.response.write(`event: heartbeat\ndata: ${JSON.stringify({ timestamp: now, clientId })}\n\n`);
      client.response.flush?.();
      client.lastHeartbeat = now;
      client.lastSuccessfulWrite = now; // Track successful writes
    } catch (error) {
      console.log(`❌ Client ${clientId} failed heartbeat, removing`);
      disconnectedClients.push(clientId);
    }
  });
  
  // Remove failed clients
  disconnectedClients.forEach(clientId => {
    clients.delete(clientId);
  });
  
  console.log(`💓 Heartbeat sent to ${clients.size} clients`);
};

// Start global heartbeat if not already running
const startGlobalHeartbeat = () => {
  if (heartbeatInterval) return;
  
  console.log('❤️ Starting global SSE heartbeat (10s interval)');
  heartbeatInterval = setInterval(() => {
    if (clients.size > 0) {
      sendHeartbeat();
    } else {
      console.log('👤 No SSE clients connected, stopping heartbeat');
      stopGlobalHeartbeat();
    }
  }, 10000); // 10 second heartbeat
};

// Stop global heartbeat when no clients
const stopGlobalHeartbeat = () => {
  if (heartbeatInterval) {
    console.log('📏 Stopping global SSE heartbeat (no clients)');
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
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

    // Generate unique client ID
    const clientId = `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date();
    
    // Add client to the map
    clients.set(clientId, {
      response: res,
      connectedAt: now,
      lastHeartbeat: now,
      lastSuccessfulWrite: now,
      id: clientId
    });
    
    console.log(`🔗 New SSE client connected: ${clientId} (Total: ${clients.size})`);
    
    // Start global heartbeat if this is first client
    if (clients.size === 1) {
      startGlobalHeartbeat();
    }

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

    // Handle client disconnect
    const cleanup = () => {
      console.log(`🔌 SSE client disconnected: ${clientId}`);
      discoveryService.offHostsChange(eventHandler);
      clients.delete(clientId);
      
      // Stop global heartbeat if no more clients
      stopGlobalHeartbeat();
    };
    
    req.on('close', cleanup);
    req.on('error', (error) => {
      console.error(`❌ SSE client error for ${clientId}:`, error);
      cleanup();
    });
    
    // Send immediate heartbeat to new client
    setTimeout(() => {
      try {
        res.write(`event: heartbeat\ndata: ${JSON.stringify({ timestamp: new Date(), clientId, message: 'connection_established' })}\n\n`);
        res.flush?.();
      } catch (error) {
        console.error(`❌ Failed to send initial heartbeat to ${clientId}`);
        cleanup();
      }
    }, 1000);

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
  console.log('🧹 Process terminating, cleaning up SSE clients...');
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
  clients.clear();
});

process.on('SIGINT', () => {
  console.log('🧹 Process interrupted, cleaning up SSE clients...');
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
  clients.clear();
});
