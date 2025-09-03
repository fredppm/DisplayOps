import { NextApiRequest, NextApiResponse } from 'next';
import { controllerStatusMonitor } from '@/lib/controller-status-monitor';
import { logger } from '@/utils/logger';

interface ControllerStatusCheckResponse {
  success: boolean;
  data?: {
    monitoring: boolean;
    statistics: {
      total: number;
      online: number;
      offline: number;
      controllers: Array<{
        id: string;
        name: string;
        status: string;
        lastSync: string;
        timeSinceLastSync: number;
      }>;
    };
    config: {
      checkInterval: number;
      offlineThreshold: number;
    };
  };
  message?: string;
  error?: string;
  timestamp: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ControllerStatusCheckResponse>
) {
  const { method, query } = req;

  if (method === 'GET') {
    // Get current status and statistics
    try {
      const statistics = await controllerStatusMonitor.getControllerStatistics();
      const config = controllerStatusMonitor.getConfig();
      const monitoring = controllerStatusMonitor.isMonitoring();

      res.status(200).json({
        success: true,
        data: {
          monitoring,
          statistics,
          config
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Failed to get controller status statistics:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get controller status statistics',
        timestamp: new Date().toISOString()
      });
    }
  } 
  else if (method === 'POST') {
    // Force a status check
    const force = query.force === 'true';
    
    try {
      if (force) {
        await controllerStatusMonitor.forceCheck();
        logger.info('Controller status check forced via API');
      }

      const statistics = await controllerStatusMonitor.getControllerStatistics();
      
      res.status(200).json({
        success: true,
        data: {
          monitoring: controllerStatusMonitor.isMonitoring(),
          statistics,
          config: controllerStatusMonitor.getConfig()
        },
        message: force ? 'Status check forced and completed' : 'Status check completed',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Failed to force controller status check:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to force controller status check',
        timestamp: new Date().toISOString()
      });
    }
  } 
  else {
    res.setHeader('Allow', ['GET', 'POST']);
    res.status(405).json({
      success: false,
      error: `Method ${method} not allowed`,
      timestamp: new Date().toISOString()
    });
  }
}