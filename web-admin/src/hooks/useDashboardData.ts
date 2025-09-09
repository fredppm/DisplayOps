import { useState, useEffect, useCallback } from 'react';

interface HealthCheck {
  name: string;
  status: 'healthy' | 'warning' | 'critical' | 'unknown';
  message?: string;
  lastCheck: string;
  responseTime?: number;
}

interface MonitoringData {
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
}

interface AlertData {
  success: boolean;
  stats: {
    totalRules: number;
    activeRules: number;
    activeAlerts: number;
    criticalAlerts: number;
    recentAlerts24h: number;
  };
  activeAlerts: Array<{
    id: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    message: string;
    timestamp: string;
  }>;
}

interface HealthChecksData {
  success: boolean;
  data: {
    checks: HealthCheck[];
    overallStatus: 'healthy' | 'warning' | 'critical';
  };
  timestamp: string;
}

interface UseDashboardDataReturn {
  monitoringData: MonitoringData | null;
  alertData: AlertData | null;
  healthChecksData: HealthChecksData | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export const useDashboardData = (
  refreshInterval: number = 30000
): UseDashboardDataReturn => {
  const [monitoringData, setMonitoringData] = useState<MonitoringData | null>(null);
  const [alertData, setAlertData] = useState<AlertData | null>(null);
  const [healthChecksData, setHealthChecksData] = useState<HealthChecksData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      
      const [monitoringRes, alertsRes] = await Promise.all([
        fetch('/api/monitoring/summary', {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache'
          }
        }),
        fetch('/api/alerts/active', {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache'
          }
        })
      ]);

      if (!monitoringRes.ok || !alertsRes.ok) {
        throw new Error('Failed to fetch dashboard data');
      }

      const [monitoring, alerts] = await Promise.all([
        monitoringRes.json(),
        alertsRes.json()
      ]);

      setMonitoringData(monitoring.success ? monitoring.data : null);
      setAlertData(alerts.success ? alerts : null);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    
    if (refreshInterval > 0) {
      const interval = setInterval(fetchData, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [fetchData, refreshInterval]);

  // Refetch function for manual refresh
  const refetch = useCallback(async () => {
    setLoading(true);
    await fetchData();
  }, [fetchData]);

  return {
    monitoringData,
    alertData,
    healthChecksData,
    loading,
    error,
    refetch
  };
};

// Hook for system health status calculation
export const useSystemHealth = (monitoringData: MonitoringData | null) => {
  return {
    status: !monitoringData ? 'Loading' : 
      monitoringData.overview?.systemHealth === 'healthy' ? 'Healthy' :
      monitoringData.overview?.systemHealth === 'warning' ? 'Warning' :
      monitoringData.overview?.systemHealth === 'critical' ? 'Critical' : 'Unknown',
    
    color: !monitoringData ? 'text-gray-500 dark:text-gray-400' :
      monitoringData.overview?.systemHealth === 'healthy' ? 'text-green-600 dark:text-green-400' :
      monitoringData.overview?.systemHealth === 'warning' ? 'text-yellow-600 dark:text-yellow-400' :
      monitoringData.overview?.systemHealth === 'critical' ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400',
    
    bgColor: !monitoringData ? 'bg-gray-50 dark:bg-gray-800/50' :
      monitoringData.overview?.systemHealth === 'healthy' ? 'bg-green-50 dark:bg-green-900/20' :
      monitoringData.overview?.systemHealth === 'warning' ? 'bg-yellow-50 dark:bg-yellow-900/20' :
      monitoringData.overview?.systemHealth === 'critical' ? 'bg-red-50 dark:bg-red-900/20' : 'bg-gray-50 dark:bg-gray-800/50'
  };
};