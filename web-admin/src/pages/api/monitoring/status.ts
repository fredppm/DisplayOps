import { NextApiRequest, NextApiResponse } from 'next';
import { performanceCollector } from '@/lib/performance-metrics';
import { alertManager } from '@/lib/alert-system';
import { withPerformanceMetrics } from '@/lib/performance-metrics';
import { withAuth } from '@/lib/api-protection';

interface SystemStatus {
  status: 'healthy' | 'warning' | 'critical';
  uptime: number;
  services: {
    api: {
      status: 'online' | 'degraded' | 'offline';
      responseTime: number;
      errorRate: number;
    };
    alerts: {
      status: 'online' | 'offline';
      activeCount: number;
      criticalCount: number;
    };
    metrics: {
      status: 'online' | 'offline';
      collectionRate: number;
    };
  };
  resources: {
    cpu: {
      usage: number;
      status: 'normal' | 'high' | 'critical';
    };
    memory: {
      usage: number;
      status: 'normal' | 'high' | 'critical';
    };
    disk: {
      usage: number;
      status: 'normal' | 'high' | 'critical';
    };
  };
  alerts: {
    active: number;
    critical: number;
    recent24h: number;
  };
}

export default withPerformanceMetrics(
  withAuth(async (req, res) => {
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
      // Get performance metrics
      const summary = performanceCollector.getSummary();
      
      // Get alert information
      const alertStats = alertManager.getAlertStats();
      const activeAlerts = alertManager.getActiveAlerts();
      
      // Determine CPU status
      const getCpuStatus = (usage: number) => {
        if (usage > 90) return 'critical';
        if (usage > 75) return 'high';
        return 'normal';
      };
      
      // Determine memory status
      const getMemoryStatus = (usage: number) => {
        if (usage > 95) return 'critical';
        if (usage > 85) return 'high';
        return 'normal';
      };
      
      // Simulate disk usage (in a real system, this would be measured)
      const diskUsage = 45 + Math.random() * 20; // 45-65%
      const getDiskStatus = (usage: number) => {
        if (usage > 90) return 'critical';
        if (usage > 80) return 'high';
        return 'normal';
      };
      
      // Determine API status
      const getApiStatus = (errorRate: number, avgResponseTime: number) => {
        if (errorRate > 10 || avgResponseTime > 5000) return 'offline';
        if (errorRate > 5 || avgResponseTime > 2000) return 'degraded';
        return 'online';
      };
      
      // Determine overall system status
      const getOverallStatus = (): 'healthy' | 'warning' | 'critical' => {
        const cpuStatus = getCpuStatus(summary.system.cpuUsage);
        const memoryStatus = getMemoryStatus(summary.system.memoryUsage);
        const diskStatus = getDiskStatus(diskUsage);
        const apiStatus = getApiStatus(summary.api.errorRate, summary.api.averageResponseTime);
        
        if (cpuStatus === 'critical' || memoryStatus === 'critical' || 
            diskStatus === 'critical' || apiStatus === 'offline' || 
            alertStats.criticalAlerts > 0) {
          return 'critical';
        }
        
        if (cpuStatus === 'high' || memoryStatus === 'high' || 
            diskStatus === 'high' || apiStatus === 'degraded' || 
            alertStats.activeAlerts > 0) {
          return 'warning';
        }
        
        return 'healthy';
      };

      const status: SystemStatus = {
        status: getOverallStatus(),
        uptime: summary.uptime,
        services: {
          api: {
            status: getApiStatus(summary.api.errorRate, summary.api.averageResponseTime),
            responseTime: summary.api.averageResponseTime,
            errorRate: summary.api.errorRate
          },
          alerts: {
            status: 'online', // Alert system is always online if we can query it
            activeCount: alertStats.activeAlerts,
            criticalCount: alertStats.criticalAlerts
          },
          metrics: {
            status: 'online', // Metrics system is online if we can get summary
            collectionRate: summary.api.requestsPerMinute || 0
          }
        },
        resources: {
          cpu: {
            usage: summary.system.cpuUsage,
            status: getCpuStatus(summary.system.cpuUsage)
          },
          memory: {
            usage: summary.system.memoryUsage,
            status: getMemoryStatus(summary.system.memoryUsage)
          },
          disk: {
            usage: diskUsage,
            status: getDiskStatus(diskUsage)
          }
        },
        alerts: {
          active: alertStats.activeAlerts,
          critical: alertStats.criticalAlerts,
          recent24h: alertStats.recentAlerts24h
        }
      };

      return res.status(200).json({
        success: true,
        data: status,
        timestamp: new Date().toISOString()
      });

    } catch (error: any) {
      console.error('System status error:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to get system status',
        timestamp: new Date().toISOString()
      });
    }
  })
);