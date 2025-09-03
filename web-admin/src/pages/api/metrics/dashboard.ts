import { NextApiRequest, NextApiResponse } from 'next';
import { performanceCollector } from '@/lib/performance-metrics';

interface DashboardMetrics {
  overview: {
    uptime: string;
    totalRequests: number;
    averageResponseTime: number;
    errorRate: number;
    currentLoad: number;
  };
  realtime: {
    requestsPerMinute: number;
    activeConnections: number;
    activeSessions: number;
    memoryUsage: number;
    cpuUsage: number;
  };
  topEndpoints: Array<{
    endpoint: string;
    method: string;
    requests: number;
    averageTime: number;
    errorRate: number;
  }>;
  systemHealth: 'healthy' | 'warning' | 'critical';
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const metrics = performanceCollector.getMetrics();
    const summary = performanceCollector.getSummary();

    // Calculate top endpoints
    const endpointStats = new Map<string, {
      requests: number;
      totalTime: number;
      errors: number;
    }>();

    if (metrics.api.endpoints && typeof metrics.api.endpoints.forEach === 'function') {
      metrics.api.endpoints.forEach((endpointMetrics, key) => {
        const stats = {
          requests: endpointMetrics.length,
          totalTime: endpointMetrics.reduce((sum, m) => sum + m.responseTime, 0),
          errors: endpointMetrics.filter(m => m.statusCode >= 400).length
        };
        endpointStats.set(key, stats);
      });
    }

    const topEndpoints = Array.from(endpointStats.entries())
      .map(([endpoint, stats]) => {
        const [method, path] = endpoint.split(' ', 2);
        return {
          endpoint: path,
          method,
          requests: stats.requests,
          averageTime: stats.requests > 0 ? stats.totalTime / stats.requests : 0,
          errorRate: stats.requests > 0 ? (stats.errors / stats.requests) * 100 : 0
        };
      })
      .sort((a, b) => b.requests - a.requests)
      .slice(0, 10);

    // Determine system health
    let systemHealth: 'healthy' | 'warning' | 'critical' = 'healthy';
    
    if (summary.system.cpuUsage > 80 || summary.system.memoryUsage > 90 || summary.api.errorRate > 10) {
      systemHealth = 'critical';
    } else if (summary.system.cpuUsage > 60 || summary.system.memoryUsage > 75 || summary.api.errorRate > 5) {
      systemHealth = 'warning';
    }

    const formatUptime = (seconds: number) => {
      const days = Math.floor(seconds / 86400);
      const hours = Math.floor((seconds % 86400) / 3600);
      const mins = Math.floor((seconds % 3600) / 60);
      
      if (days > 0) return `${days}d ${hours}h ${mins}m`;
      if (hours > 0) return `${hours}h ${mins}m`;
      return `${mins}m`;
    };

    const dashboardData: DashboardMetrics = {
      overview: {
        uptime: formatUptime(summary.uptime),
        totalRequests: summary.api.totalRequests,
        averageResponseTime: Math.round(summary.api.averageResponseTime),
        errorRate: parseFloat(summary.api.errorRate.toFixed(2)),
        currentLoad: parseFloat(summary.system.loadAverage.toFixed(2))
      },
      realtime: {
        requestsPerMinute: summary.api.requestsPerMinute,
        activeConnections: summary.application.activeConnections,
        activeSessions: summary.application.activeSessions,
        memoryUsage: parseFloat(summary.system.memoryUsage.toFixed(1)),
        cpuUsage: parseFloat(summary.system.cpuUsage.toFixed(1))
      },
      topEndpoints,
      systemHealth
    };

    res.status(200).json({
      success: true,
      data: dashboardData,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('Dashboard metrics error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get dashboard metrics',
      timestamp: new Date().toISOString()
    });
  }
}