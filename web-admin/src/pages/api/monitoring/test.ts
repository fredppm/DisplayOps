import { NextApiRequest, NextApiResponse } from 'next';
import { performanceCollector } from '@/lib/performance-metrics';
import { alertManager } from '@/lib/alert-system';
import { withPerformanceMetrics } from '@/lib/performance-metrics';

// Test endpoint without authentication to verify monitoring dashboard system
export default withPerformanceMetrics(async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Test all monitoring components
    const summary = performanceCollector.getSummary();
    const alertStats = alertManager.getAlertStats();
    const activeAlerts = alertManager.getActiveAlerts();
    
    // Test dashboard metrics endpoint
    const dashboardRes = await fetch(`${req.headers.host ? `http://${req.headers.host}` : 'http://localhost:3000'}/api/metrics/dashboard`);
    const dashboardData = await dashboardRes.json();
    
    // Test alerts endpoint  
    const alertsRes = await fetch(`${req.headers.host ? `http://${req.headers.host}` : 'http://localhost:3000'}/api/alerts/active`);
    const alertsData = await alertsRes.json();

    return res.status(200).json({
      success: true,
      message: 'Monitoring dashboard system test successful',
      data: {
        components: {
          performanceCollector: {
            status: 'operational',
            uptime: summary.uptime,
            totalRequests: summary.api.totalRequests,
            averageResponseTime: summary.api.averageResponseTime,
            errorRate: summary.api.errorRate
          },
          alertManager: {
            status: 'operational',
            totalRules: alertStats.totalRules,
            activeRules: alertStats.activeRules,
            activeAlerts: alertStats.activeAlerts,
            criticalAlerts: alertStats.criticalAlerts
          },
          dashboardAPI: {
            status: dashboardData.success ? 'operational' : 'error',
            accessible: dashboardRes.ok,
            systemHealth: dashboardData.success ? dashboardData.data?.systemHealth : 'unknown'
          },
          alertsAPI: {
            status: alertsData.success ? 'operational' : 'error',
            accessible: alertsRes.ok,
            alertCount: alertsData.success ? alertsData.data?.stats?.activeAlerts : 0
          }
        },
        systemOverview: {
          health: summary.system.cpuUsage > 85 || summary.system.memoryUsage > 90 || summary.api.errorRate > 10 ? 'critical' :
                  summary.system.cpuUsage > 70 || summary.system.memoryUsage > 80 || summary.api.errorRate > 5 ? 'warning' : 'healthy',
          cpu: summary.system.cpuUsage,
          memory: summary.system.memoryUsage,
          alerts: alertStats.activeAlerts,
          uptime: Math.floor(summary.uptime / 60) + ' minutes'
        }
      },
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('Monitoring dashboard test error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }
});