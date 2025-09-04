import React, { useState, useEffect } from 'react';

interface SystemMetrics {
  uptime: string;
  totalRequests: number;
  averageResponseTime: number;
  errorRate: number;
  currentLoad: number;
}

interface RealtimeMetrics {
  requestsPerMinute: number;
  activeConnections: number;
  activeSessions: number;
  memoryUsage: number;
  cpuUsage: number;
}

interface TopEndpoint {
  endpoint: string;
  method: string;
  requests: number;
  averageTime: number;
  errorRate: number;
}

interface DashboardMetrics {
  overview: SystemMetrics;
  realtime: RealtimeMetrics;
  topEndpoints: TopEndpoint[];
  systemHealth: 'healthy' | 'warning' | 'critical';
}

interface MonitoringData {
  metrics: DashboardMetrics;
  alerts: Alert[];
  alertStats: AlertStats;
}

interface Alert {
  id: string;
  ruleName: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: string;
}

interface AlertStats {
  totalRules: number;
  activeRules: number;
  activeAlerts: number;
  criticalAlerts: number;
  recentAlerts24h: number;
}

interface MonitoringDashboardProps {
  initialData?: MonitoringData;
}

export const MonitoringDashboard: React.FC<MonitoringDashboardProps> = ({ initialData }) => {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(initialData?.metrics || null);
  const [alerts, setAlerts] = useState<Alert[]>(initialData?.alerts || []);
  const [alertStats, setAlertStats] = useState<AlertStats | null>(initialData?.alertStats || null);
  const [loading, setLoading] = useState(!initialData);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const fetchData = async () => {
    const loadingState = !initialData || loading;
    
    try {
      if (!loadingState) setRefreshing(true);
      
      const [metricsRes, alertsRes] = await Promise.all([
        fetch('/api/metrics/dashboard'),
        fetch('/api/alerts/active')
      ]);

      const [metricsData, alertsData] = await Promise.all([
        metricsRes.json(),
        alertsRes.json()
      ]);

      if (metricsData.success) {
        setMetrics(metricsData.data);
      }

      if (alertsData.success) {
        setAlerts(alertsData.data.alerts);
        setAlertStats(alertsData.data.stats);
      }

      setError(null);
      setLastUpdate(new Date());
    } catch (err) {
      setError('Failed to fetch monitoring data');
      console.error('Error fetching monitoring data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!initialData) {
      fetchData();
    }
    
    // Refresh data every 10 seconds
    const interval = setInterval(fetchData, 10000);
    
    return () => clearInterval(interval);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const getHealthBadgeColor = (health: string): string => {
    switch (health) {
      case 'healthy': return 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-400';
      case 'warning': return 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-400';
      case 'critical': return 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-400';
      default: return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200';
    }
  };

  const getSeverityColor = (severity: string): string => {
    switch (severity) {
      case 'critical': return 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-400 border-red-200 dark:border-red-700';
      case 'high': return 'bg-orange-100 dark:bg-orange-900/20 text-orange-800 dark:text-orange-400 border-orange-200 dark:border-orange-700';
      case 'medium': return 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-400 border-yellow-200 dark:border-yellow-700';
      case 'low': return 'bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-400 border-blue-200 dark:border-blue-700';
      default: return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 border-gray-200 dark:border-gray-700';
    }
  };

  const formatTimestamp = (timestamp: string): string => {
    return new Date(timestamp).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Header Skeleton */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex justify-between items-center animate-pulse">
            <div>
              <div className="h-8 bg-gray-200 dark:bg-gray-600 rounded w-64 mb-2"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-48"></div>
            </div>
            <div className="text-right">
              <div className="h-6 bg-gray-200 dark:bg-gray-600 rounded w-20 mb-1"></div>
              <div className="h-3 bg-gray-200 dark:bg-gray-600 rounded w-32"></div>
            </div>
          </div>
        </div>

        {/* System Overview Skeleton */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="h-6 bg-gray-200 dark:bg-gray-600 rounded w-40 mb-4 animate-pulse"></div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 animate-pulse">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="h-8 bg-gray-200 dark:bg-gray-600 rounded w-16 mx-auto mb-2"></div>
                <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-20 mx-auto"></div>
              </div>
            ))}
          </div>
        </div>

        {/* Real-time and Alerts Grid Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="h-6 bg-gray-200 rounded w-36 mb-4 animate-pulse"></div>
            <div className="space-y-4 animate-pulse">
              {Array.from({ length: 2 }).map((_, index) => (
                <div key={index} className="flex justify-between items-center">
                  <div className="h-4 bg-gray-200 rounded w-24"></div>
                  <div className="flex items-center">
                    <div className="h-2 bg-gray-200 rounded-full w-32 mr-3"></div>
                    <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-12"></div>
                  </div>
                </div>
              ))}
              <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-gray-200 dark:border-gray-800">
                <div className="text-center">
                  <div className="h-6 bg-gray-200 rounded w-12 mx-auto mb-1"></div>
                  <div className="h-3 bg-gray-200 rounded w-20 mx-auto"></div>
                </div>
                <div className="text-center">
                  <div className="h-6 bg-gray-200 rounded w-12 mx-auto mb-1"></div>
                  <div className="h-3 bg-gray-200 rounded w-20 mx-auto"></div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="h-6 bg-gray-200 dark:bg-gray-600 rounded w-32 mb-4 animate-pulse"></div>
            <div className="space-y-3 animate-pulse">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="border border-gray-200 dark:border-gray-800 rounded-lg p-3">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-16"></div>
                        <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-24"></div>
                      </div>
                      <div className="h-3 bg-gray-200 dark:bg-gray-600 rounded w-full mb-1"></div>
                      <div className="h-3 bg-gray-200 dark:bg-gray-600 rounded w-24"></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Top Endpoints Table Skeleton */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="h-6 bg-gray-200 dark:bg-gray-600 rounded w-40 mb-4 animate-pulse"></div>
          <div className="overflow-x-auto animate-pulse">
            <div className="min-w-full">
              <div className="border-b pb-2 mb-4">
                <div className="grid grid-cols-5 gap-4">
                  {['Method', 'Endpoint', 'Requests', 'Avg Time', 'Error Rate'].map((_, index) => (
                    <div key={index} className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-full"></div>
                  ))}
                </div>
              </div>
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="grid grid-cols-5 gap-4 py-2 border-b">
                  <div className="h-6 bg-gray-200 dark:bg-gray-600 rounded w-12"></div>
                  <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-full"></div>
                  <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-16"></div>
                  <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-12"></div>
                  <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-12"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with System Health and Last Update */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">System Monitoring Dashboard</h2>
            <div className="flex items-center mt-1">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Real-time system metrics and alerts
              </p>
              {refreshing && (
                <div className="flex items-center ml-3 text-sm text-gray-500 dark:text-gray-400">
                  <div className="animate-spin w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full mr-2"></div>
                  Refreshing...
                </div>
              )}
            </div>
          </div>
          <div className="text-right">
            {metrics && (
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getHealthBadgeColor(metrics.systemHealth)}`}>
                {metrics.systemHealth === 'healthy' && '✅ '}
                {metrics.systemHealth === 'warning' && '⚠️ '}
                {metrics.systemHealth === 'critical' && '🚨 '}
                {metrics.systemHealth.charAt(0).toUpperCase() + metrics.systemHealth.slice(1)}
              </span>
            )}
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Last updated: {formatTimestamp(lastUpdate.toISOString())}
            </div>
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-4">
          <div className="flex items-center">
            <div className="text-red-600 mr-3">⚠️</div>
            <div>
              <p className="text-red-800 dark:text-red-400 font-medium">Monitoring Error</p>
              <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
            </div>
            <button 
              onClick={fetchData}
              className="ml-auto px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800 text-sm"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* System Overview */}
      {metrics && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center text-gray-900 dark:text-gray-100">
            <span className="mr-2">📊</span>
            System Overview
          </h3>
          
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{metrics.overview.uptime}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Uptime</div>
            </div>
            
            <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{metrics.overview.totalRequests.toLocaleString()}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Total Requests</div>
            </div>
            
            <div className="text-center p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
              <div className="text-2xl font-bold text-yellow-600">{metrics.overview.averageResponseTime}ms</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Avg Response</div>
            </div>
            
            <div className="text-center p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">{metrics.overview.errorRate}%</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Error Rate</div>
            </div>
            
            <div className="text-center p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
              <div className="text-2xl font-bold text-indigo-600">{metrics.overview.currentLoad}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Load Average</div>
            </div>
          </div>
        </div>
      )}

      {/* Real-time Metrics and Alerts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Real-time System Metrics */}
        {metrics && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center text-gray-900 dark:text-gray-100">
              <span className="mr-2">⚡</span>
              Real-time Metrics
            </h3>
            
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-600 dark:text-gray-400">CPU Usage</span>
                <div className="flex items-center">
                  <div className="w-32 bg-gray-200 dark:bg-gray-700 rounded-full h-2 mr-3">
                    <div 
                      className={`h-2 rounded-full ${metrics.realtime.cpuUsage > 80 ? 'bg-red-500' : metrics.realtime.cpuUsage > 60 ? 'bg-yellow-500' : 'bg-green-500'}`}
                      style={{ width: `${Math.min(metrics.realtime.cpuUsage, 100)}%` }}
                    ></div>
                  </div>
                  <span className="text-sm font-medium">{metrics.realtime.cpuUsage.toFixed(1)}%</span>
                </div>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-gray-600 dark:text-gray-400">Memory Usage</span>
                <div className="flex items-center">
                  <div className="w-32 bg-gray-200 dark:bg-gray-700 rounded-full h-2 mr-3">
                    <div 
                      className={`h-2 rounded-full ${metrics.realtime.memoryUsage > 85 ? 'bg-red-500' : metrics.realtime.memoryUsage > 70 ? 'bg-yellow-500' : 'bg-green-500'}`}
                      style={{ width: `${Math.min(metrics.realtime.memoryUsage, 100)}%` }}
                    ></div>
                  </div>
                  <span className="text-sm font-medium">{metrics.realtime.memoryUsage.toFixed(1)}%</span>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-gray-200 dark:border-gray-800">
                <div className="text-center">
                  <div className="text-lg font-bold text-blue-600">{metrics.realtime.requestsPerMinute}</div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">Requests/min</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-green-600">{metrics.realtime.activeConnections}</div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">Connections</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Active Alerts */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold flex items-center">
              <span className="mr-2">🚨</span>
              Active Alerts
            </h3>
            {alertStats && (
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {alertStats.activeAlerts} active / {alertStats.totalRules} rules
              </span>
            )}
          </div>
          
          {alertStats && (
            <div className="grid grid-cols-4 gap-2 mb-4 text-center text-xs">
              <div className="bg-red-50 dark:bg-red-900/20 p-2 rounded">
                <div className="font-bold text-red-600">{alertStats.criticalAlerts}</div>
                <div className="text-gray-600 dark:text-gray-400">Critical</div>
              </div>
              <div className="bg-orange-50 dark:bg-orange-900/20 p-2 rounded">
                <div className="font-bold text-orange-600">{alertStats.activeAlerts - alertStats.criticalAlerts}</div>
                <div className="text-gray-600 dark:text-gray-400">Other</div>
              </div>
              <div className="bg-blue-50 dark:bg-blue-900/20 p-2 rounded">
                <div className="font-bold text-blue-600">{alertStats.activeRules}</div>
                <div className="text-gray-600 dark:text-gray-400">Active Rules</div>
              </div>
              <div className="bg-purple-50 dark:bg-purple-900/20 p-2 rounded">
                <div className="font-bold text-purple-600">{alertStats.recentAlerts24h}</div>
                <div className="text-gray-600 dark:text-gray-400">Last 24h</div>
              </div>
            </div>
          )}

          <div className="space-y-3 max-h-64 overflow-y-auto">
            {alerts.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <div className="text-2xl mb-2">✅</div>
                <div className="text-sm">No active alerts</div>
                <div className="text-xs text-gray-400 dark:text-gray-500">System running normally</div>
              </div>
            ) : (
              alerts.map(alert => (
                <div key={alert.id} className={`border rounded-lg p-3 ${getSeverityColor(alert.severity)}`}>
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-1 text-xs font-medium rounded uppercase ${getSeverityColor(alert.severity)}`}>
                          {alert.severity}
                        </span>
                        <span className="font-medium text-sm text-gray-900 dark:text-gray-100">{alert.ruleName}</span>
                      </div>
                      <p className="text-sm text-gray-700 dark:text-gray-300">{alert.message}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {formatTimestamp(alert.timestamp)}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Top Endpoints Performance */}
      {metrics && metrics.topEndpoints.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center text-gray-900 dark:text-gray-100">
            <span className="mr-2">🎯</span>
            Top API Endpoints
          </h3>
          
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-800">
                  <th className="text-left py-2 px-3 text-sm font-medium text-gray-600 dark:text-gray-400">Method</th>
                  <th className="text-left py-2 px-3 text-sm font-medium text-gray-600 dark:text-gray-400">Endpoint</th>
                  <th className="text-right py-2 px-3 text-sm font-medium text-gray-600 dark:text-gray-400">Requests</th>
                  <th className="text-right py-2 px-3 text-sm font-medium text-gray-600 dark:text-gray-400">Avg Time</th>
                  <th className="text-right py-2 px-3 text-sm font-medium text-gray-600 dark:text-gray-400">Error Rate</th>
                </tr>
              </thead>
              <tbody>
                {metrics.topEndpoints.map((endpoint, index) => (
                  <tr key={index} className="border-b border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="py-2 px-3 text-sm">
                      <span className={`px-2 py-1 text-xs font-medium rounded ${
                        endpoint.method === 'GET' ? 'bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-400' :
                        endpoint.method === 'POST' ? 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-400' :
                        endpoint.method === 'PUT' ? 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-400' :
                        endpoint.method === 'DELETE' ? 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-400' :
                        'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
                      }`}>
                        {endpoint.method}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-sm font-mono text-gray-800 dark:text-gray-200">{endpoint.endpoint}</td>
                    <td className="py-2 px-3 text-sm text-right text-gray-800 dark:text-gray-200">{endpoint.requests.toLocaleString()}</td>
                    <td className="py-2 px-3 text-sm text-right">
                      <span className={endpoint.averageTime > 1000 ? 'text-red-600 dark:text-red-400' : endpoint.averageTime > 500 ? 'text-yellow-600 dark:text-yellow-400' : 'text-green-600 dark:text-green-400'}>
                        {endpoint.averageTime.toFixed(0)}ms
                      </span>
                    </td>
                    <td className="py-2 px-3 text-sm text-right">
                      <span className={endpoint.errorRate > 5 ? 'text-red-600 dark:text-red-400' : endpoint.errorRate > 1 ? 'text-yellow-600 dark:text-yellow-400' : 'text-green-600 dark:text-green-400'}>
                        {endpoint.errorRate.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <span className="mr-2">🔧</span>
          Quick Actions
        </h3>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <button 
            onClick={fetchData}
            className="p-3 border border-blue-200 dark:border-blue-700 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 text-center transition-colors"
          >
            <div className="text-blue-600 dark:text-blue-400 text-sm font-medium">🔄 Refresh Data</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Update metrics</div>
          </button>
          
          <a 
            href="/admin/alerts"
            className="p-3 border border-orange-200 dark:border-orange-700 rounded-lg hover:bg-orange-50 dark:hover:bg-orange-900/20 text-center transition-colors block"
          >
            <div className="text-orange-600 dark:text-orange-400 text-sm font-medium">🚨 Manage Alerts</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Alert rules</div>
          </a>
          
          <a 
            href="/admin/metrics"
            className="p-3 border border-green-200 dark:border-green-700 rounded-lg hover:bg-green-50 dark:hover:bg-green-900/20 text-center transition-colors block"
          >
            <div className="text-green-600 dark:text-green-400 text-sm font-medium">📊 View Metrics</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Detailed view</div>
          </a>
          
          <a 
            href="/admin/health"
            className="p-3 border border-purple-200 dark:border-purple-700 rounded-lg hover:bg-purple-50 dark:hover:bg-purple-900/20 text-center transition-colors block"
          >
            <div className="text-purple-600 dark:text-purple-400 text-sm font-medium">💚 System Health</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Health status</div>
          </a>
        </div>
      </div>
    </div>
  );
};

export default MonitoringDashboard;