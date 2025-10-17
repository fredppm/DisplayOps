import { NextApiRequest, NextApiResponse } from 'next';
import { createContextLogger } from '@/utils/logger';
import { httpHostManager } from '@/lib/http-host-manager';
import { hostsRepository } from '@/lib/repositories/HostsRepository';

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
    const connectedHosts = await httpHostManager.getConnectedHosts();
    
    logger.info('📊 Retrieved connection status', {
      totalConnected: connectedHosts.length,
      hosts: connectedHosts
    });

    // Get detailed host info
    const hostsDetails = await Promise.all(
      connectedHosts.map(async (agentId) => {
        const host = await hostsRepository.getByAgentId(agentId);
        return {
          agentId,
          hostname: host?.hostname,
          lastSeen: host?.lastSeen,
          status: host?.status
        };
      })
    );

    return res.status(200).json({
      success: true,
      data: {
        totalConnected: connectedHosts.length,
        connectedHosts: hostsDetails
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


