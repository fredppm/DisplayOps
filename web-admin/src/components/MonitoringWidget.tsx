import React, { useState, useEffect } from 'react';
import Link from 'next/link';

interface MonitoringWidgetData {
  systemHealth: 'healthy' | 'warning' | 'critical';
  activeAlerts: number;
  criticalAlerts: number;
  cpuUsage: number;
  memoryUsage: number;
  uptime: string;
}

export const MonitoringWidget: React.FC = () => {
  const [data, setData] = useState<MonitoringWidgetData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const [metricsRes, alertsRes] = await Promise.all([
        fetch('/api/metrics/dashboard'),
        fetch('/api/alerts/active')
      ]);

      const [metricsData, alertsData] = await Promise.all([
        metricsRes.json(),
        alertsRes.json()
      ]);

      if (metricsData.success && alertsData.success) {
        setData({
          systemHealth: metricsData.data.systemHealth,
          activeAlerts: alertsData.data.stats.activeAlerts,
          criticalAlerts: alertsData.data.stats.criticalAlerts,
          cpuUsage: metricsData.data.realtime.cpuUsage,
          memoryUsage: metricsData.data.realtime.memoryUsage,
          uptime: metricsData.data.overview.uptime
        });
        setError(null);
      } else {
        throw new Error('Failed to fetch monitoring data');
      }
    } catch (err) {
      setError('Monitoring unavailable');
      console.error('Error fetching monitoring widget data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    
    // Refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);
    
    return () => clearInterval(interval);
  }, []);

  const getHealthColor = (health: string): string => {
    switch (health) {
      case 'healthy': return 'text-green-600';
      case 'warning': return 'text-yellow-600';
      case 'critical': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getHealthIcon = (health: string): string => {
    switch (health) {
      case 'healthy': return '✅';
      case 'warning': return '⚠️';
      case 'critical': return '🚨';
      default: return '❓';
    }
  };

  if (loading) {
    return (
      <div className="bg-white shadow rounded-lg p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded mb-4"></div>
          <div className="grid grid-cols-2 gap-4">
            <div className="h-8 bg-gray-200 rounded"></div>
            <div className="h-8 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <span className="mr-2">📈</span>
          System Monitoring
        </h3>
        <div className="text-center py-4">
          <div className="text-red-600 mb-2">⚠️</div>
          <div className="text-sm text-gray-500">{error}</div>
          <button 
            onClick={fetchData}
            className="mt-2 px-3 py-1 text-xs bg-gray-200 hover:bg-gray-300 rounded"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold flex items-center">
          <span className="mr-2">📈</span>
          System Monitoring
        </h3>
        <Link 
          href="/admin/monitoring"
          className="text-sm text-blue-600 hover:text-blue-800"
        >
          View Details →
        </Link>
      </div>
      
      {data && (
        <div className="space-y-4">
          {/* System Health Status */}
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">System Health</span>
            <div className="flex items-center">
              <span className="mr-1">{getHealthIcon(data.systemHealth)}</span>
              <span className={`text-sm font-medium ${getHealthColor(data.systemHealth)}`}>
                {data.systemHealth.charAt(0).toUpperCase() + data.systemHealth.slice(1)}
              </span>
            </div>
          </div>

          {/* Active Alerts */}
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">Active Alerts</span>
            <div className="flex items-center space-x-2">
              {data.criticalAlerts > 0 && (
                <span className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded">
                  {data.criticalAlerts} Critical
                </span>
              )}
              <span className="text-sm font-medium">
                {data.activeAlerts} total
              </span>
            </div>
          </div>

          {/* Resource Usage */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">CPU Usage</span>
              <div className="flex items-center">
                <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                  <div 
                    className={`h-2 rounded-full ${data.cpuUsage > 80 ? 'bg-red-500' : data.cpuUsage > 60 ? 'bg-yellow-500' : 'bg-green-500'}`}
                    style={{ width: `${Math.min(data.cpuUsage, 100)}%` }}
                  ></div>
                </div>
                <span className="text-xs">{data.cpuUsage.toFixed(0)}%</span>
              </div>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Memory Usage</span>
              <div className="flex items-center">
                <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                  <div 
                    className={`h-2 rounded-full ${data.memoryUsage > 85 ? 'bg-red-500' : data.memoryUsage > 70 ? 'bg-yellow-500' : 'bg-green-500'}`}
                    style={{ width: `${Math.min(data.memoryUsage, 100)}%` }}
                  ></div>
                </div>
                <span className="text-xs">{data.memoryUsage.toFixed(0)}%</span>
              </div>
            </div>
          </div>

          {/* Uptime */}
          <div className="flex justify-between items-center pt-2 border-t">
            <span className="text-sm text-gray-600">Uptime</span>
            <span className="text-sm font-medium text-blue-600">{data.uptime}</span>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-2 gap-2 pt-2">
            <Link 
              href="/admin/alerts"
              className="px-2 py-1 text-xs text-center bg-orange-100 text-orange-700 rounded hover:bg-orange-200"
            >
              Manage Alerts
            </Link>
            <Link 
              href="/admin/metrics"
              className="px-2 py-1 text-xs text-center bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
            >
              View Metrics
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};

export default MonitoringWidget;