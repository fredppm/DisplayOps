import { NextApiRequest, NextApiResponse } from 'next';
import { alertManager } from '@/lib/alert-system';
import { withPerformanceMetrics } from '@/lib/performance-metrics';
import { withAuthAndPermissions } from '@/lib/api-protection';

export default withPerformanceMetrics(
  withAuthAndPermissions(['alerts:read', 'alerts:write'], async (req: NextApiRequest, res: NextApiResponse) => {
    const { id } = req.query;
    
    if (typeof id !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Invalid rule ID'
      });
    }

    try {
      switch (req.method) {
        case 'GET':
          const rule = alertManager.getRule(id);
          if (!rule) {
            return res.status(404).json({
              success: false,
              error: 'Alert rule not found'
            });
          }
          
          return res.status(200).json({
            success: true,
            data: rule
          });

        case 'PUT':
          const existingRule = alertManager.getRule(id);
          if (!existingRule) {
            return res.status(404).json({
              success: false,
              error: 'Alert rule not found'
            });
          }

          const updates: any = {};
          if (req.body.name !== undefined) updates.name = req.body.name;
          if (req.body.description !== undefined) updates.description = req.body.description;
          if (req.body.metric !== undefined) updates.metric = req.body.metric;
          if (req.body.condition !== undefined) updates.condition = req.body.condition;
          if (req.body.threshold !== undefined) updates.threshold = parseFloat(req.body.threshold);
          if (req.body.severity !== undefined) updates.severity = req.body.severity;
          if (req.body.enabled !== undefined) updates.enabled = req.body.enabled;
          if (req.body.cooldownMinutes !== undefined) updates.cooldownMinutes = parseInt(req.body.cooldownMinutes);
          if (req.body.notificationChannels !== undefined) updates.notificationChannels = req.body.notificationChannels;

          const updatedRule = alertManager.updateRule(id, updates);
          if (!updatedRule) {
            return res.status(500).json({
              success: false,
              error: 'Failed to update alert rule'
            });
          }

          return res.status(200).json({
            success: true,
            data: updatedRule,
            message: 'Alert rule updated successfully'
          });

        case 'DELETE':
          const deleted = alertManager.deleteRule(id);
          if (!deleted) {
            return res.status(404).json({
              success: false,
              error: 'Alert rule not found'
            });
          }

          return res.status(200).json({
            success: true,
            message: 'Alert rule deleted successfully'
          });

        default:
          return res.status(405).json({
            success: false,
            error: 'Method not allowed'
          });
      }
    } catch (error: any) {
      console.error('Alert rule API error:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Internal server error'
      });
    }
  })
);