import { NextApiRequest, NextApiResponse } from 'next';
import { createContextLogger } from '@/utils/logger';
import { hostsRepository } from '@/lib/repositories/HostsRepository';

const heartbeatLogger = createContextLogger('host-heartbeat');

interface HeartbeatRequest {
  agentId: string;
  status: 'online' | 'offline';
  lastSeen: string;
  displays: Array<{
    id: string;
    name: string;
    width: number;
    height: number;
    isPrimary: boolean;
    assignedDashboard?: any;
    isActive: boolean;
  }>;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed',
      timestamp: new Date().toISOString()
    });
  }

  try {
    const heartbeatData: HeartbeatRequest = req.body;

    if (!heartbeatData.agentId) {
      return res.status(400).json({
        success: false,
        error: 'Agent ID is required',
        timestamp: new Date().toISOString()
      });
    }

    // Find host by agent ID
    const host = await hostsRepository.getByAgentId(heartbeatData.agentId);
    if (!host) {
      return res.status(404).json({
        success: false,
        error: 'Host not found',
        timestamp: new Date().toISOString()
      });
    }

    // Update host status and display information
    await hostsRepository.update(host.id, {
      status: heartbeatData.status,
      lastSeen: heartbeatData.lastSeen,
      displays: heartbeatData.displays.map(display => ({
        id: display.id,
        name: display.name,
        width: display.width,
        height: display.height,
        isPrimary: display.isPrimary
      }))
    });

    heartbeatLogger.debug('💓 Heartbeat received', {
      agentId: heartbeatData.agentId,
      status: heartbeatData.status,
      displayCount: heartbeatData.displays.length
    });

    return res.status(200).json({
      success: true,
      message: 'Heartbeat received',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    heartbeatLogger.error('❌ Heartbeat processing failed:', error);
    
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }
}

