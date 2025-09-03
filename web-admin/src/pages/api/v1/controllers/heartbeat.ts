import { NextApiRequest, NextApiResponse } from 'next';
import { logger } from '../../../../utils/logger';

interface HeartbeatRequest {
  controllerId: string;
  siteId: string;
  status: string;
  hostCount?: number;
  metrics?: {
    uptime: number;
    memory: any;
    hostAgents: {
      discovered: number;
      online: number;
    };
  };
}

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed',
      timestamp: new Date().toISOString()
    });
  }

  try {
    const heartbeat: HeartbeatRequest = req.body;
    
    logger.info('Controller heartbeat received', {
      controllerId: heartbeat.controllerId,
      siteId: heartbeat.siteId,
      status: heartbeat.status,
      hostCount: heartbeat.hostCount || 0
    });

    // In a real implementation, this would update controller status in database
    // For now, we just acknowledge the heartbeat
    
    const response = {
      controllerId: heartbeat.controllerId,
      acknowledged: true,
      serverTime: new Date().toISOString(),
      syncRequired: false, // Could be used to trigger config sync
      commands: [] // Could return pending commands for controller
    };

    res.status(200).json({
      success: true,
      data: response,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    logger.error('Heartbeat processing failed', { error: error.message });
    
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }
}