import React, { useState, useEffect } from 'react';

interface Alert {
  id: string;
  ruleId: string;
  ruleName: string;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  metric: string;
  currentValue: number;
  threshold: number;
  timestamp: string;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  resolved: boolean;
  resolvedAt?: string;
}

interface AlertRule {
  id: string;
  name: string;
  description: string;
  metric: string;
  condition: 'greater_than' | 'less_than' | 'equals';
  threshold: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  enabled: boolean;
  cooldownMinutes: number;
  notificationChannels: string[];
  createdAt: string;
  updatedAt: string;
}

interface AlertStats {
  totalRules: number;
  activeRules: number;
  activeAlerts: number;
  criticalAlerts: number;
  recentAlerts24h: number;
}

interface AlertHistory {
  alerts: Alert[];
  totalCount: number;
  unacknowledgedCount: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
}

interface AlertsData {
  activeAlerts: Alert[];
  alertHistory: AlertHistory;
  alertRules: AlertRule[];
  stats: AlertStats;
}

interface AlertsManagerProps {
  initialData?: AlertsData;
}

export const AlertsManager: React.FC<AlertsManagerProps> = ({ initialData }) => {
  const [activeAlerts, setActiveAlerts] = useState<Alert[]>(initialData?.activeAlerts || []);
  const [alertHistory, setAlertHistory] = useState<AlertHistory | null>(initialData?.alertHistory || null);
  const [alertRules, setAlertRules] = useState<AlertRule[]>(initialData?.alertRules || []);
  const [stats, setStats] = useState<AlertStats | null>(initialData?.stats || null);
  const [loading, setLoading] = useState(!initialData);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'active' | 'history' | 'rules'>('active');

  const fetchData = async () => {
    const loadingState = !initialData || loading;
    
    try {
      if (!loadingState) setRefreshing(true);
      
      const [activeRes, historyRes, rulesRes] = await Promise.all([
        fetch('/api/alerts/active'),
        fetch('/api/alerts/history?limit=100'),
        fetch('/api/alerts/rules')
      ]);

      const [activeData, historyData, rulesData] = await Promise.all([
        activeRes.json(),
        historyRes.json(),
        rulesRes.json()
      ]);

      if (activeData.success) {
        setActiveAlerts(activeData.data.alerts);
        setStats(activeData.data.stats);
      }

      if (historyData.success) {
        setAlertHistory(historyData.data);
      }

      if (rulesData.success) {
        setAlertRules(rulesData.data);
      }

      setError(null);
    } catch (err) {
      setError('Failed to fetch alerts data');
      console.error('Error fetching alerts:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!initialData) {
      fetchData();
    }
    
    // Refresh data every 30 seconds
    const interval = setInterval(fetchData, 30000);
    
    return () => clearInterval(interval);
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  const getSeverityColor = (severity: string): string => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-blue-100 text-blue-800 border-blue-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const acknowledgeAlert = async (alertId: string) => {
    try {
      const response = await fetch('/api/alerts/acknowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alertId,
          acknowledgedBy: 'admin' // In a real app, this would be the current user
        })
      });

      if (response.ok) {
        await fetchData(); // Refresh data
      } else {
        throw new Error('Failed to acknowledge alert');
      }
    } catch (err) {
      console.error('Error acknowledging alert:', err);
      setError('Failed to acknowledge alert');
    }
  };

  const toggleRule = async (ruleId: string, enabled: boolean) => {
    try {
      const response = await fetch(`/api/alerts/rules/${ruleId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled })
      });

      if (response.ok) {
        await fetchData(); // Refresh data
      } else {
        throw new Error('Failed to update rule');
      }
    } catch (err) {
      console.error('Error updating rule:', err);
      setError('Failed to update alert rule');
    }
  };

  const formatDateTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Stats Overview Skeleton */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="animate-pulse">
            <div className="h-6 bg-gray-200 rounded w-40 mb-4"></div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="text-center">
                  <div className="h-8 bg-gray-200 rounded w-16 mx-auto mb-2"></div>
                  <div className="h-4 bg-gray-200 rounded w-20 mx-auto"></div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Tabs and Content Skeleton */}
        <div className="bg-white rounded-lg shadow">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8 px-6">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="py-4 px-1 flex items-center animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-20 mr-2"></div>
                  <div className="h-5 bg-gray-200 rounded-full w-6"></div>
                </div>
              ))}
            </nav>
          </div>
          
          <div className="p-6">
            <div className="space-y-4 animate-pulse">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="border rounded-lg p-4 bg-gray-50">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="h-5 bg-gray-200 rounded w-16"></div>
                        <div className="h-5 bg-gray-200 rounded w-32"></div>
                      </div>
                      <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
                      <div className="space-y-1">
                        <div className="h-3 bg-gray-200 rounded w-24"></div>
                        <div className="h-3 bg-gray-200 rounded w-48"></div>
                        <div className="h-3 bg-gray-200 rounded w-32"></div>
                      </div>
                    </div>
                    <div className="h-8 bg-gray-200 rounded w-20 ml-4"></div>
                  </div>
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
      {/* Stats Overview */}
      {stats && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Alerts Overview</h3>
            {refreshing && (
              <div className="flex items-center text-sm text-gray-500">
                <div className="animate-spin w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full mr-2"></div>
                Updating...
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{stats.totalRules}</div>
              <div className="text-sm text-gray-500">Total Rules</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{stats.activeRules}</div>
              <div className="text-sm text-gray-500">Active Rules</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">{stats.activeAlerts}</div>
              <div className="text-sm text-gray-500">Active Alerts</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{stats.criticalAlerts}</div>
              <div className="text-sm text-gray-500">Critical</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{stats.recentAlerts24h}</div>
              <div className="text-sm text-gray-500">Last 24h</div>
            </div>
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error}</p>
          <button 
            onClick={() => { setError(null); fetchData(); }}
            className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8 px-6">
            {[
              { key: 'active', label: 'Active Alerts', count: activeAlerts.length },
              { key: 'history', label: 'History', count: alertHistory?.totalCount || 0 },
              { key: 'rules', label: 'Alert Rules', count: alertRules.length }
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.key
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
                <span className="ml-2 bg-gray-100 text-gray-600 rounded-full px-2 py-1 text-xs">
                  {tab.count}
                </span>
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {/* Active Alerts Tab */}
          {activeTab === 'active' && (
            <div className="space-y-4">
              {activeAlerts.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <div className="text-4xl mb-2">✅</div>
                  <div>No active alerts</div>
                </div>
              ) : (
                activeAlerts.map(alert => (
                  <div key={alert.id} className={`border rounded-lg p-4 ${getSeverityColor(alert.severity)}`}>
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`px-2 py-1 text-xs font-medium rounded uppercase ${getSeverityColor(alert.severity)}`}>
                            {alert.severity}
                          </span>
                          <h4 className="font-semibold">{alert.ruleName}</h4>
                        </div>
                        <p className="text-sm mb-2">{alert.message}</p>
                        <div className="text-xs text-gray-600 space-y-1">
                          <div>Metric: {alert.metric}</div>
                          <div>Current: {alert.currentValue} | Threshold: {alert.threshold}</div>
                          <div>Triggered: {formatDateTime(alert.timestamp)}</div>
                        </div>
                      </div>
                      {!alert.acknowledged && (
                        <button
                          onClick={() => acknowledgeAlert(alert.id)}
                          className="ml-4 px-3 py-1 text-sm bg-white border border-gray-300 rounded hover:bg-gray-50"
                        >
                          Acknowledge
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* History Tab */}
          {activeTab === 'history' && alertHistory && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                <div className="text-center">
                  <div className="text-lg font-bold text-gray-600">{alertHistory.totalCount}</div>
                  <div className="text-xs text-gray-500">Total</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-red-600">{alertHistory.criticalCount}</div>
                  <div className="text-xs text-gray-500">Critical</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-orange-600">{alertHistory.highCount}</div>
                  <div className="text-xs text-gray-500">High</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-yellow-600">{alertHistory.mediumCount}</div>
                  <div className="text-xs text-gray-500">Medium</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-blue-600">{alertHistory.lowCount}</div>
                  <div className="text-xs text-gray-500">Low</div>
                </div>
              </div>

              {alertHistory.alerts.map(alert => (
                <div key={alert.id} className="border rounded-lg p-4 bg-gray-50">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`px-2 py-1 text-xs font-medium rounded uppercase ${getSeverityColor(alert.severity)}`}>
                          {alert.severity}
                        </span>
                        <h4 className="font-semibold">{alert.ruleName}</h4>
                        {alert.resolved && (
                          <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded">
                            Resolved
                          </span>
                        )}
                        {alert.acknowledged && (
                          <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">
                            Acknowledged
                          </span>
                        )}
                      </div>
                      <p className="text-sm mb-2">{alert.message}</p>
                      <div className="text-xs text-gray-600 space-y-1">
                        <div>Triggered: {formatDateTime(alert.timestamp)}</div>
                        {alert.acknowledgedAt && (
                          <div>Acknowledged: {formatDateTime(alert.acknowledgedAt)} by {alert.acknowledgedBy}</div>
                        )}
                        {alert.resolvedAt && (
                          <div>Resolved: {formatDateTime(alert.resolvedAt)}</div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Rules Tab */}
          {activeTab === 'rules' && (
            <div className="space-y-4">
              {alertRules.map(rule => (
                <div key={rule.id} className="border rounded-lg p-4 bg-gray-50">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-semibold">{rule.name}</h4>
                        <span className={`px-2 py-1 text-xs font-medium rounded uppercase ${getSeverityColor(rule.severity)}`}>
                          {rule.severity}
                        </span>
                        <span className={`px-2 py-1 text-xs rounded ${
                          rule.enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {rule.enabled ? 'Enabled' : 'Disabled'}
                        </span>
                      </div>
                      <p className="text-sm mb-2 text-gray-600">{rule.description}</p>
                      <div className="text-xs text-gray-600 space-y-1">
                        <div>Metric: {rule.metric} {rule.condition.replace('_', ' ')} {rule.threshold}</div>
                        <div>Cooldown: {rule.cooldownMinutes} minutes</div>
                        <div>Channels: {rule.notificationChannels.join(', ')}</div>
                      </div>
                    </div>
                    <div className="ml-4 flex gap-2">
                      <button
                        onClick={() => toggleRule(rule.id, !rule.enabled)}
                        className={`px-3 py-1 text-sm rounded ${
                          rule.enabled 
                            ? 'bg-red-100 text-red-700 hover:bg-red-200' 
                            : 'bg-green-100 text-green-700 hover:bg-green-200'
                        }`}
                      >
                        {rule.enabled ? 'Disable' : 'Enable'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AlertsManager;