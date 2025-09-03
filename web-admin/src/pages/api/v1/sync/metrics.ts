import { NextApiRequest, NextApiResponse } from 'next';
import { syncProtocol } from '@/lib/sync-protocol';
import { ApiResponse } from '@/types/multi-site-types';

interface SyncMetricsResponse {
  controllers: Array<{
    controllerId: string;
    metrics: {
      messagesPerMinute: number;
      averageLatency: number;
      successRate: number;
      errorRate: number;
      retryRate: number;
      queueSize: number;
      lastSync: string;
      bandwidth: {
        sent: number;
        received: number;
      };
    };
  }>;
  aggregated: {
    totalControllers: number;
    averageSuccessRate: number;
    averageLatency: number;
    totalMessages: number;
    totalBandwidth: number;
  };
  timestamp: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<SyncMetricsResponse | any>>
) {
  if (req.method === 'GET') {
    try {
      const { controllerId } = req.query;

      // Se um controller específico foi solicitado
      if (controllerId && typeof controllerId === 'string') {
        const metrics = syncProtocol.getSyncMetrics(controllerId);
        
        if (!metrics) {
          return res.status(404).json({
            success: false,
            error: 'Controller metrics not found',
            timestamp: new Date().toISOString()
          });
        }

        return res.status(200).json({
          success: true,
          data: {
            controllerId,
            metrics,
            timestamp: new Date().toISOString()
          },
          timestamp: new Date().toISOString()
        });
      }

      // Obter métricas de todos os controllers
      const allMetrics = syncProtocol.getAllMetrics();
      const controllers: any[] = [];
      
      let totalSuccessRate = 0;
      let totalLatency = 0;
      let totalMessages = 0;
      let totalBandwidth = 0;

      for (const [controllerId, metrics] of allMetrics.entries()) {
        controllers.push({
          controllerId,
          metrics
        });

        totalSuccessRate += metrics.successRate;
        totalLatency += metrics.averageLatency;
        totalMessages += metrics.messagesPerMinute;
        totalBandwidth += metrics.bandwidth.sent + metrics.bandwidth.received;
      }

      const controllerCount = controllers.length;
      
      const response: SyncMetricsResponse = {
        controllers,
        aggregated: {
          totalControllers: controllerCount,
          averageSuccessRate: controllerCount > 0 ? totalSuccessRate / controllerCount : 0,
          averageLatency: controllerCount > 0 ? totalLatency / controllerCount : 0,
          totalMessages,
          totalBandwidth
        },
        timestamp: new Date().toISOString()
      };

      res.status(200).json({
        success: true,
        data: response,
        timestamp: new Date().toISOString()
      });

    } catch (error: any) {
      console.error('Failed to get sync metrics:', error);
      
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get sync metrics',
        timestamp: new Date().toISOString()
      });
    }
  } else if (req.method === 'DELETE') {
    try {
      // Limpar métricas antigas
      const maxAge = req.query.maxAge ? parseInt(req.query.maxAge as string) : 24 * 60 * 60 * 1000;
      
      syncProtocol.cleanupOldMetrics(maxAge);

      res.status(200).json({
        success: true,
        data: {
          message: 'Old metrics cleaned up',
          maxAgeMs: maxAge
        },
        timestamp: new Date().toISOString()
      });

    } catch (error: any) {
      console.error('Failed to cleanup metrics:', error);
      
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to cleanup metrics',
        timestamp: new Date().toISOString()
      });
    }
  } else {
    res.setHeader('Allow', ['GET', 'DELETE']);
    res.status(405).json({
      success: false,
      error: 'Method not allowed',
      timestamp: new Date().toISOString()
    });
  }
}