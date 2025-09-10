import { NextApiRequest, NextApiResponse } from 'next';
import { alertManager } from '@/lib/alert-system';
import { withPerformanceMetrics } from '@/lib/performance-metrics';
import { withAuthAndPermissions } from '@/lib/api-protection';

export default withPerformanceMetrics(
  withAuthAndPermissions(['alerts:write'], async (req: NextApiRequest, res: NextApiResponse) => {
    try {
      switch (req.method) {
        case 'POST':
          const { alertId, acknowledgedBy } = req.body;

          if (!alertId || !acknowledgedBy) {
            return res.status(400).json({
              success: false,
              error: 'Missing required fields: alertId, acknowledgedBy'
            });
          }

          const acknowledged = alertManager.acknowledgeAlert(alertId, acknowledgedBy);
          
          if (!acknowledged) {
            return res.status(404).json({
              success: false,
              error: 'Alert not found'
            });
          }

          return res.status(200).json({
            success: true,
            message: 'Alert acknowledged successfully',
            data: {
              alertId,
              acknowledgedBy,
              acknowledgedAt: new Date().toISOString()
            }
          });

        default:
          return res.status(405).json({
            success: false,
            error: 'Method not allowed'
          });
      }
    } catch (error: any) {
      console.error('Alert acknowledgment API error:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Internal server error',
        timestamp: new Date().toISOString()
      });
    }
  })
);