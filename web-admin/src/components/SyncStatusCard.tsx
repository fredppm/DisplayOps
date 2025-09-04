import React, { useState } from 'react';
import { useHealthDashboard } from '@/hooks/useSyncMonitor';

interface ControllerSyncStatus {
  controllerId: string;
  name: string;
  status: 'online' | 'offline' | 'error';
  isConnected: boolean;
  lastSync: string;
  dashboardSync: {
    pending: boolean;
    timestamp: string | null;
  };
  cookieSync: {
    pending: boolean;
    timestamp: string | null;
  };
}

interface SyncAlert {
  id: string;
  type: 'warning' | 'error' | 'info';
  title: string;
  message: string;
  timestamp: string;
  controllerId?: string;
}

interface SyncStatusData {
  overall: 'healthy' | 'warning' | 'critical';
  controllers: {
    total: number;
    online: number;
    syncUpToDate: number;
    pendingDashboards: number;
    pendingCookies: number;
  };
  data: {
    dashboards: {
      total: number;
      lastUpdated: string | null;
    };
    cookies: {
      domains: number;
      totalCookies: number;
      lastUpdated: string | null;
    };
  };
  grpc: {
    isRunning: boolean;
    connections: number;
  };
  controllers: ControllerSyncStatus[];
  alerts: SyncAlert[];
}

const getStatusColor = (status: 'healthy' | 'warning' | 'critical'): string => {
  switch (status) {
    case 'healthy':
      return 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900';
    case 'warning':
      return 'text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900';
    case 'critical':
      return 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900';
  }
};

const getStatusIcon = (status: 'healthy' | 'warning' | 'critical'): string => {
  switch (status) {
    case 'healthy':
      return '✅';
    case 'warning':
      return '⚠️';
    case 'critical':
      return '❌';
  }
};

const getAlertIcon = (type: 'warning' | 'error' | 'info'): string => {
  switch (type) {
    case 'warning':
      return '⚠️';
    case 'error':
      return '❌';
    case 'info':
      return 'ℹ️';
  }
};

const formatTimestamp = (timestamp: string): string => {
  return new Date(timestamp).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export default function SyncStatusCard() {
  const { syncStatus, alerts, loading, error, refresh } = useHealthDashboard();
  const [showAlerts, setShowAlerts] = useState(false);
  const [showControllers, setShowControllers] = useState(false);

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 border border-gray-200 dark:border-gray-600">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded"></div>
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-5/6"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 border border-red-200 dark:border-red-600">
        <h2 className="text-lg font-semibold text-red-600 dark:text-red-400 mb-2">
          ❌ Sync Status Error
        </h2>
        <p className="text-gray-700 dark:text-gray-300">{error}</p>
        <button 
          onClick={refresh}
          className="mt-3 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded text-sm"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!syncStatus) {
    return null;
  }

  const { overall, controllers, data, grpc, alerts } = syncStatus;

  return (
    <div className="bg-white dark:bg-gray-800 shadow rounded-lg border border-gray-200 dark:border-gray-600">
      {/* Header */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-600">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Sync Status Dashboard
          </h2>
          <div className={`px-3 py-1 rounded-full text-sm font-medium flex items-center gap-2 ${getStatusColor(overall)}`}>
            <span>{getStatusIcon(overall)}</span>
            <span className="capitalize">{overall}</span>
          </div>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {/* Controllers */}
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Controllers</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {controllers.online}/{controllers.total}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Online</div>
          </div>

          {/* Sync Status */}
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Sync Status</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {controllers.syncUpToDate}/{controllers.total}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Up to Date</div>
          </div>

          {/* Alerts */}
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Alerts</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {alerts.length}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Active</div>
          </div>
        </div>

        {/* Pending Syncs */}
        {(controllers.pendingDashboards > 0 || controllers.pendingCookies > 0) && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-yellow-600 dark:text-yellow-400">⚠️</span>
              <span className="font-medium text-yellow-800 dark:text-yellow-200">Pending Syncs</span>
            </div>
            <div className="text-sm text-yellow-700 dark:text-yellow-300">
              {controllers.pendingDashboards > 0 && (
                <div>📊 {controllers.pendingDashboards} controller(s) pending dashboard sync</div>
              )}
              {controllers.pendingCookies > 0 && (
                <div>🍪 {controllers.pendingCookies} controller(s) pending cookie sync</div>
              )}
            </div>
          </div>
        )}

        {/* Data Summary */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <span>📊</span>
              <span className="font-medium text-blue-800 dark:text-blue-200">Dashboards</span>
            </div>
            <div className="text-sm text-blue-700 dark:text-blue-300">
              <div>Total: {data.dashboards.total}</div>
              {data.dashboards.lastUpdated && (
                <div>Last Updated: {formatTimestamp(data.dashboards.lastUpdated)}</div>
              )}
            </div>
          </div>

          <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <span>🍪</span>
              <span className="font-medium text-purple-800 dark:text-purple-200">Cookies</span>
            </div>
            <div className="text-sm text-purple-700 dark:text-purple-300">
              <div>Domains: {data.cookies.domains}</div>
              <div>Total Cookies: {data.cookies.totalCookies}</div>
              {data.cookies.lastUpdated && (
                <div>Last Updated: {formatTimestamp(data.cookies.lastUpdated)}</div>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3">
          {(alerts.length > 0 || (syncStatus && syncStatus.alerts.length > 0)) && (
            <button
              onClick={() => setShowAlerts(!showAlerts)}
              className="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded text-sm flex items-center gap-2"
            >
              ⚠️ View Alerts ({(syncStatus?.alerts.length || 0) + alerts.length})
            </button>
          )}
          
          <button
            onClick={() => setShowControllers(!showControllers)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm"
          >
            View Controllers ({controllers.total})
          </button>
          
          <button
            onClick={refresh}
            className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded text-sm"
          >
            🔄 Refresh
          </button>
        </div>

        {/* Alerts Details */}
        {showAlerts && ((syncStatus && syncStatus.alerts.length > 0) || alerts.length > 0) && (
          <div className="mt-6 border-t border-gray-200 dark:border-gray-600 pt-6">
            <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-4">Active Alerts</h3>
            <div className="space-y-3">
              {/* System alerts from sync status */}
              {syncStatus?.alerts.map((alert) => (
                <div key={alert.id} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <span className="text-lg">{getAlertIcon(alert.type)}</span>
                    <div className="flex-1">
                      <div className="font-medium text-gray-900 dark:text-gray-100">
                        {alert.title}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {alert.message}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                        {formatTimestamp(alert.timestamp)}
                        {alert.controllerId && (
                          <span className="ml-2">Controller: {alert.controllerId}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              
              {/* Real-time alerts from hook */}
              {alerts.map((alert) => (
                <div key={alert.id} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 border-l-4 border-blue-500">
                  <div className="flex items-start gap-3">
                    <span className="text-lg">{getAlertIcon(alert.type)}</span>
                    <div className="flex-1">
                      <div className="font-medium text-gray-900 dark:text-gray-100">
                        {alert.title} <span className="text-blue-600 text-xs">(Real-time)</span>
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {alert.message}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                        {formatTimestamp(alert.timestamp)}
                        {alert.controllerId && (
                          <span className="ml-2">Controller: {alert.controllerId}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Controllers Details */}
        {showControllers && (
          <div className="mt-6 border-t border-gray-200 dark:border-gray-600 pt-6">
            <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-4">Controllers Status</h3>
            <div className="space-y-3">
              {syncStatus.controllers.map((controller) => (
                <div key={controller.controllerId} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className={`w-3 h-3 rounded-full ${
                        controller.status === 'online' ? 'bg-green-500' : 
                        controller.status === 'offline' ? 'bg-gray-500' : 'bg-red-500'
                      }`}></span>
                      <div>
                        <div className="font-medium text-gray-900 dark:text-gray-100">
                          {controller.name}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          ID: {controller.controllerId}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-gray-900 dark:text-gray-100 capitalize">
                        {controller.status} {controller.isConnected && '(Connected)'}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-500">
                        Last Sync: {formatTimestamp(controller.lastSync)}
                      </div>
                    </div>
                  </div>
                  
                  {(controller.dashboardSync.pending || controller.cookieSync.pending) && (
                    <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
                      <div className="text-sm text-yellow-700 dark:text-yellow-300">
                        Pending Syncs:
                        {controller.dashboardSync.pending && <span className="ml-2">📊 Dashboards</span>}
                        {controller.cookieSync.pending && <span className="ml-2">🍪 Cookies</span>}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}