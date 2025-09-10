import { NextApiRequest, NextApiResponse } from 'next';
import { alertManager } from '@/lib/alert-system';
import { performanceCollector } from '@/lib/performance-metrics';
import { withPerformanceMetrics } from '@/lib/performance-metrics';

// Test endpoint without authentication to verify alert system
export default withPerformanceMetrics(async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get current alert system status
    const stats = alertManager.getAlertStats();
    const activeAlerts = alertManager.getActiveAlerts();
    const rules = alertManager.getRules();
    const history = alertManager.getAlertHistory(10);
    
    // Get current performance metrics to see if alerts should trigger
    const summary = performanceCollector.getSummary();

    // Create some test metrics that might trigger alerts
    const testMetrics = {
      cpuUsage: Math.random() * 100, // Random CPU usage 0-100%
      memoryUsage: Math.random() * 100, // Random memory usage 0-100%
      apiResponseTime: 50 + Math.random() * 2000, // Response time 50-2050ms
      errorRate: Math.random() * 20 // Error rate 0-20%
    };

    return res.status(200).json({
      success: true,
      data: {
        alertSystem: {
          stats,
          activeAlertsCount: activeAlerts.length,
          rulesCount: rules.length,
          recentHistoryCount: history.alerts.length
        },
        currentMetrics: {
          system: {
            cpuUsage: summary.system.cpuUsage,
            memoryUsage: summary.system.memoryUsage,
            loadAverage: summary.system.loadAverage
          },
          api: {
            averageResponseTime: summary.api.averageResponseTime,
            errorRate: summary.api.errorRate,
            totalRequests: summary.api.totalRequests
          }
        },
        testMetrics,
        alertRules: rules.map(rule => ({
          id: rule.id,
          name: rule.name,
          metric: rule.metric,
          condition: rule.condition,
          threshold: rule.threshold,
          severity: rule.severity,
          enabled: rule.enabled
        })),
        activeAlerts: activeAlerts.map(alert => ({
          id: alert.id,
          ruleName: alert.ruleName,
          severity: alert.severity,
          message: alert.message,
          timestamp: alert.timestamp
        }))
      },
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('Alert system test error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }
});