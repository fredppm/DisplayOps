import { NextApiRequest, NextApiResponse } from 'next';
import { alertManager } from '@/lib/alert-system';
import { withPerformanceMetrics } from '@/lib/performance-metrics';
import { withAuthAndPermissions } from '@/lib/api-protection';

export default withPerformanceMetrics(
  withAuthAndPermissions(['alerts:read'], async (req: NextApiRequest, res: NextApiResponse) => {
    try {
      switch (req.method) {
        case 'GET':
          const activeAlerts = alertManager.getActiveAlerts();
          const stats = alertManager.getAlertStats();
          
          return res.status(200).json({
            success: true,
            data: {
              alerts: activeAlerts,
              stats: stats
            },
            timestamp: new Date().toISOString()
          });

        default:
          return res.status(405).json({
            success: false,
            error: 'Method not allowed'
          });
      }
    } catch (error: any) {
      console.error('Active alerts API error:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Internal server error',
        timestamp: new Date().toISOString()
      });
    }
  })
);