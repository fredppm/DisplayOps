import React, { useState, useEffect } from 'react';
import { MetricsGridSkeleton, ErrorFallback } from './skeletons';

interface SystemMetrics {
  cpu: {
    usage: number;
    loadAverage: number[];
  };
  memory: {
    total: number;
    used: number;
    free: number;
    percentage: number;
  };
  uptime: number;
}

interface ApiSummary {
  averageResponseTime: number;
  totalRequests: number;
  errorRate: number;
  requestsPerMinute: number;
}

interface PerformanceSummary {
  uptime: number;
  system: {
    cpuUsage: number;
    memoryUsage: number;
    loadAverage: number;
  };
  api: ApiSummary;
  application: {
    activeSessions: number;
    activeConnections: number;
    errorRate: number;
    requestsPerMinute: number;
  };
  timestamp: number;
}

interface PerformanceMetricsProps {
  initialMetrics?: PerformanceSummary;
}

export const PerformanceMetrics: React.FC<PerformanceMetricsProps> = ({ initialMetrics }) => {
  const [metrics, setMetrics] = useState<PerformanceSummary | null>(initialMetrics || null);
  const [loading, setLoading] = useState(!initialMetrics);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = async (isRefresh = false) => {
    try {
      if (isRefresh && metrics) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      
      const response = await fetch('/api/metrics/performance?summary=true');
      const data = await response.json();
      
      if (data.success) {
        setMetrics(data.data);
        setError(null);
      } else {
        setError(data.error || 'Failed to fetch metrics');
      }
    } catch (err) {
      setError('Network error fetching metrics');
      console.error('Error fetching metrics:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    // Only fetch if no initial data
    if (!initialMetrics) {
      fetchMetrics();
    }
    
    // Refresh metrics every 10 seconds (using refresh mode)
    const interval = setInterval(() => fetchMetrics(true), 10000);
    
    return () => clearInterval(interval);
  }, []);

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) return `${days}d ${hours}h ${mins}m`;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  const formatBytes = (bytes: number) => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  if (loading) {
    return <MetricsGridSkeleton />;
  }

  if (error) {
    return (
      <ErrorFallback 
        onRetry={() => fetchMetrics(false)}
        message={error}
      />
    );
  }

  if (!metrics) {
    return (
      <div className="text-gray-500 dark:text-gray-400">No metrics available</div>
    );
  }

  return (
    <div className="space-y-6">
      {refreshing && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-3 flex items-center">
          <div className="animate-spin w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full mr-2"></div>
          <span className="text-blue-700 dark:text-blue-400 text-sm">Refreshing metrics...</span>
        </div>
      )}
      
      {/* System Overview */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">System Overview</h3>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">
              {formatUptime(metrics.uptime)}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Uptime</div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {metrics.system.cpuUsage.toFixed(1)}%
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">CPU Usage</div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-600">
              {metrics.system.memoryUsage.toFixed(1)}%
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Memory</div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">
              {metrics.system.loadAverage.toFixed(2)}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Load Avg</div>
          </div>
        </div>
      </div>

      {/* API Performance */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">API Performance</h3>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">
              {metrics.api.averageResponseTime.toFixed(0)}ms
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Avg Response</div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {metrics.api.totalRequests}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Total Requests</div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">
              {metrics.api.errorRate.toFixed(1)}%
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Error Rate</div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600">
              {metrics.api.requestsPerMinute}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Requests/min</div>
          </div>
        </div>
      </div>

      {/* Application Metrics */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">Application Status</h3>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-indigo-600">
              {metrics.application.activeSessions}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Active Sessions</div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-teal-600">
              {metrics.application.activeConnections}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Connections</div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-pink-600">
              {metrics.application.requestsPerMinute}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Requests/min</div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">
              {metrics.application.errorRate.toFixed(1)}%
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Error Rate</div>
          </div>
        </div>
      </div>

      {/* Last Updated */}
      <div className="text-xs text-gray-400 dark:text-gray-500 text-center">
        Last updated: {new Date(metrics.timestamp).toLocaleTimeString()}
      </div>
    </div>
  );
};

export default PerformanceMetrics;