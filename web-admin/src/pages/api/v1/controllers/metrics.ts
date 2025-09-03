import { NextApiRequest, NextApiResponse } from 'next';
import { logger } from '../../../../utils/logger';

interface MetricsData {
  controllerId: string;
  siteId: string;
  uptime: number;
  memory: any;
  hostAgents: {
    discovered: number;
    online: number;
    error: number;
  };
  displays: {
    total: number;
    active: number;
  };
  performance: {
    averageCpu: number;
    averageMemory: number;
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
    const metrics: MetricsData = req.body;
    
    logger.info('Controller metrics received', {
      controllerId: metrics.controllerId,
      siteId: metrics.siteId,
      hostAgents: metrics.hostAgents?.discovered || 0,
      uptime: Math.round(metrics.uptime || 0)
    });

    // In a real implementation, this would store metrics in a time-series database
    // For now, we just acknowledge receipt
    
    const response = {
      controllerId: metrics.controllerId,
      acknowledged: true,
      serverTime: new Date().toISOString()
    };

    res.status(200).json({
      success: true,
      data: response,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    logger.error('Metrics processing failed', { error: error.message });
    
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }
}