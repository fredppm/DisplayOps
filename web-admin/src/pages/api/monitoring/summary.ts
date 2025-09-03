import { NextApiRequest, NextApiResponse } from 'next';
import { performanceCollector } from '@/lib/performance-metrics';
import { alertManager } from '@/lib/alert-system';
import { withPerformanceMetrics } from '@/lib/performance-metrics';
import { withAuth } from '@/lib/api-protection';

interface MonitoringSummary {
  overview: {
    systemHealth: 'healthy' | 'warning' | 'critical';
    uptime: string;
    totalRequests: number;
    averageResponseTime: number;
    errorRate: number;
    activeAlerts: number;
  };
  performance: {
    cpu: {
      current: number;
      trend: 'stable' | 'increasing' | 'decreasing';
      status: 'normal' | 'warning' | 'critical';
    };
    memory: {
      current: number;
      trend: 'stable' | 'increasing' | 'decreasing';
      status: 'normal' | 'warning' | 'critical';
    };
    network: {
      requestsPerMinute: number;
      activeConnections: number;
      trend: 'stable' | 'increasing' | 'decreasing';
    };
  };
  alerts: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    recentTrend: 'stable' | 'increasing' | 'decreasing';
  };
  services: Array<{
    name: string;
    status: 'online' | 'degraded' | 'offline';
    uptime: number;
    lastCheck: string;
  }>;
  recommendations: Array<{
    type: 'performance' | 'security' | 'maintenance';
    priority: 'high' | 'medium' | 'low';
    title: string;
    description: string;
  }>;
}

export default withPerformanceMetrics(
  withAuth(async (req, res) => {
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
      // Get performance metrics
      const summary = performanceCollector.getSummary();
      const metrics = performanceCollector.getMetrics();
      
      // Get alert information
      const alertStats = alertManager.getAlertStats();
      const alertHistory = alertManager.getAlertHistory(50);
      const activeAlerts = alertManager.getActiveAlerts();
      
      // Format uptime
      const formatUptime = (seconds: number) => {
        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        
        if (days > 0) return `${days}d ${hours}h ${mins}m`;
        if (hours > 0) return `${hours}h ${mins}m`;
        return `${mins}m`;
      };

      // Determine status based on thresholds
      const getCpuStatus = (usage: number) => {
        if (usage > 85) return 'critical';
        if (usage > 70) return 'warning';
        return 'normal';
      };

      const getMemoryStatus = (usage: number) => {
        if (usage > 90) return 'critical';
        if (usage > 80) return 'warning';
        return 'normal';
      };

      // Calculate trends (simplified - in real system would use historical data)
      const getTrend = (current: number, threshold: number): 'stable' | 'increasing' | 'decreasing' => {
        // Simulate trend based on current values
        if (current > threshold * 1.2) return 'increasing';
        if (current < threshold * 0.8) return 'decreasing';
        return 'stable';
      };

      // Determine overall system health
      const getSystemHealth = (): 'healthy' | 'warning' | 'critical' => {
        if (summary.system.cpuUsage > 85 || summary.system.memoryUsage > 90 || 
            summary.api.errorRate > 10 || alertStats.criticalAlerts > 0) {
          return 'critical';
        }
        if (summary.system.cpuUsage > 70 || summary.system.memoryUsage > 80 || 
            summary.api.errorRate > 5 || alertStats.activeAlerts > 0) {
          return 'warning';
        }
        return 'healthy';
      };

      // Count alerts by severity
      const alertsBySeverity = activeAlerts.reduce((acc, alert) => {
        acc[alert.severity] = (acc[alert.severity] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Generate recommendations
      const recommendations = [];
      
      if (summary.system.cpuUsage > 80) {
        recommendations.push({
          type: 'performance' as const,
          priority: summary.system.cpuUsage > 90 ? 'high' as const : 'medium' as const,
          title: 'High CPU Usage Detected',
          description: `CPU usage is at ${summary.system.cpuUsage.toFixed(1)}%. Consider scaling resources or optimizing processes.`
        });
      }

      if (summary.system.memoryUsage > 85) {
        recommendations.push({
          type: 'performance' as const,
          priority: summary.system.memoryUsage > 95 ? 'high' as const : 'medium' as const,
          title: 'High Memory Usage',
          description: `Memory usage is at ${summary.system.memoryUsage.toFixed(1)}%. Monitor for memory leaks or consider adding more RAM.`
        });
      }

      if (summary.api.errorRate > 5) {
        recommendations.push({
          type: 'performance' as const,
          priority: 'high' as const,
          title: 'Elevated Error Rate',
          description: `API error rate is ${summary.api.errorRate.toFixed(1)}%. Investigate failing endpoints and fix underlying issues.`
        });
      }

      if (alertStats.activeAlerts === 0) {
        recommendations.push({
          type: 'maintenance' as const,
          priority: 'low' as const,
          title: 'System Running Smoothly',
          description: 'All systems are operating normally. Good time for preventive maintenance or updates.'
        });
      }

      // Mock service status (in real system, would check actual services)
      const services = [
        {
          name: 'Web Admin API',
          status: summary.api.errorRate > 10 ? 'offline' as const : summary.api.errorRate > 5 ? 'degraded' as const : 'online' as const,
          uptime: summary.uptime,
          lastCheck: new Date().toISOString()
        },
        {
          name: 'Alert Manager',
          status: 'online' as const,
          uptime: summary.uptime,
          lastCheck: new Date().toISOString()
        },
        {
          name: 'Metrics Collector',
          status: 'online' as const,
          uptime: summary.uptime,
          lastCheck: new Date().toISOString()
        },
        {
          name: 'Host Discovery',
          status: 'online' as const,
          uptime: summary.uptime,
          lastCheck: new Date().toISOString()
        }
      ];

      const monitoringSummary: MonitoringSummary = {
        overview: {
          systemHealth: getSystemHealth(),
          uptime: formatUptime(summary.uptime),
          totalRequests: summary.api.totalRequests,
          averageResponseTime: summary.api.averageResponseTime,
          errorRate: summary.api.errorRate,
          activeAlerts: alertStats.activeAlerts
        },
        performance: {
          cpu: {
            current: summary.system.cpuUsage,
            trend: getTrend(summary.system.cpuUsage, 50),
            status: getCpuStatus(summary.system.cpuUsage)
          },
          memory: {
            current: summary.system.memoryUsage,
            trend: getTrend(summary.system.memoryUsage, 60),
            status: getMemoryStatus(summary.system.memoryUsage)
          },
          network: {
            requestsPerMinute: summary.api.requestsPerMinute,
            activeConnections: summary.application.activeConnections,
            trend: 'stable' as const
          }
        },
        alerts: {
          critical: alertsBySeverity.critical || 0,
          high: alertsBySeverity.high || 0,
          medium: alertsBySeverity.medium || 0,
          low: alertsBySeverity.low || 0,
          recentTrend: alertStats.recentAlerts24h > alertStats.activeAlerts ? 'decreasing' as const : 'stable' as const
        },
        services,
        recommendations
      };

      return res.status(200).json({
        success: true,
        data: monitoringSummary,
        timestamp: new Date().toISOString()
      });

    } catch (error: any) {
      console.error('Monitoring summary error:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to generate monitoring summary',
        timestamp: new Date().toISOString()
      });
    }
  })
);