import { NextApiRequest, NextApiResponse } from 'next';
import { alertManager, AlertRule } from '@/lib/alert-system';
import { withPerformanceMetrics } from '@/lib/performance-metrics';
import { withAuthAndPermissions } from '@/lib/api-protection';

export default withPerformanceMetrics(
  withAuthAndPermissions(['alerts:read', 'alerts:write'], async (req: NextApiRequest, res: NextApiResponse) => {
    try {
      switch (req.method) {
        case 'GET':
          const rules = alertManager.getRules();
          return res.status(200).json({
            success: true,
            data: rules,
            total: rules.length,
            timestamp: new Date().toISOString()
          });

        case 'POST':
          if (!req.body.name || !req.body.metric || !req.body.condition || 
              req.body.threshold === undefined || !req.body.severity) {
            return res.status(400).json({
              success: false,
              error: 'Missing required fields: name, metric, condition, threshold, severity'
            });
          }

          const newRule = alertManager.createRule({
            name: req.body.name,
            description: req.body.description || '',
            metric: req.body.metric,
            condition: req.body.condition,
            threshold: parseFloat(req.body.threshold),
            severity: req.body.severity,
            enabled: req.body.enabled !== false,
            cooldownMinutes: parseInt(req.body.cooldownMinutes) || 5,
            notificationChannels: req.body.notificationChannels || ['dashboard']
          });

          return res.status(201).json({
            success: true,
            data: newRule,
            message: 'Alert rule created successfully'
          });

        default:
          return res.status(405).json({
            success: false,
            error: 'Method not allowed'
          });
      }
    } catch (error: any) {
      console.error('Alert rules API error:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Internal server error',
        timestamp: new Date().toISOString()
      });
    }
  })
);