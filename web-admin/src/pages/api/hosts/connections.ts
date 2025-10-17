import { NextApiRequest, NextApiResponse } from 'next';
import { createContextLogger } from '@/utils/logger';
import { socketHostManager } from '@/lib/socket-host-manager';

const logger = createContextLogger('connections-api');

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed',
      timestamp: new Date().toISOString()
    });
  }

  try {
    const connectedHosts = socketHostManager.getConnectedHosts();
    
    logger.info('📊 Retrieved connection status', {
      totalConnected: connectedHosts.length,
      hosts: connectedHosts
    });

    return res.status(200).json({
      success: true,
      data: {
        totalConnected: connectedHosts.length,
        connectedHosts: connectedHosts.map(agentId => {
          const connection = socketHostManager.getHostConnection(agentId);
          return {
            agentId,
            connectedAt: connection?.connectedAt,
            lastSeen: connection?.lastSeen,
            socketId: connection?.socket.id
          };
        })
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get connections', { error });
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }
}

