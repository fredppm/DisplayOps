import { NextApiRequest, NextApiResponse } from 'next';
import { alertManager } from '@/lib/alert-system';
import { withPerformanceMetrics } from '@/lib/performance-metrics';
import { withAuthAndPermissions } from '@/lib/api-protection';

export default withPerformanceMetrics(
  withAuthAndPermissions(['alerts:read'], async (req: NextApiRequest, res: NextApiResponse) => {
    try {
      switch (req.method) {
        case 'GET':
          const limit = parseInt(req.query.limit as string) || 50;
          const history = alertManager.getAlertHistory(limit);
          
          return res.status(200).json({
            success: true,
            data: history,
            timestamp: new Date().toISOString()
          });

        default:
          return res.status(405).json({
            success: false,
            error: 'Method not allowed'
          });
      }
    } catch (error: any) {
      console.error('Alert history API error:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Internal server error',
        timestamp: new Date().toISOString()
      });
    }
  })
);