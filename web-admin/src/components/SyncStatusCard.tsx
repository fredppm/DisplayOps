import React, { useState } from 'react';
import { useAdminStatus } from '@/contexts/AdminStatusContext';

interface SyncAlert {
  id: string;
  type: 'warning' | 'error' | 'info';
  title: string;
  message: string;
  timestamp: string;
  hostId?: string;
}

interface SyncStatusData {
  overall: 'healthy' | 'warning' | 'critical';
  hosts: {
    total: number;
    online: number;
    offline: number;
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
  websocket: {
    isRunning: boolean;
    connections: number;
  };
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
  const { syncStatus, alerts: adminAlerts, loading, error, refresh } = useAdminStatus();
  const [showAlerts, setShowAlerts] = useState(false);

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

  const { overall, hosts, data, websocket, alerts } = syncStatus;

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
          {/* Hosts */}
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Hosts</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {hosts.online}/{hosts.total}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Online</div>
          </div>

          {/* WebSocket Status */}
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">WebSocket</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {websocket.isRunning ? 'Running' : 'Offline'}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Status</div>
          </div>

          {/* Alerts */}
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Alerts</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {adminAlerts.length}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Active</div>
          </div>
        </div>

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
          {adminAlerts.length > 0 && (
            <button
              onClick={() => setShowAlerts(!showAlerts)}
              className="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded text-sm flex items-center gap-2"
            >
              ⚠️ View Alerts ({adminAlerts.length})
            </button>
          )}
          
          <button
            onClick={refresh}
            className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded text-sm"
          >
            🔄 Refresh
          </button>
        </div>

        {/* Alerts Details */}
        {showAlerts && adminAlerts.length > 0 && (
          <div className="mt-6 border-t border-gray-200 dark:border-gray-600 pt-6">
            <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-4">Active Alerts</h3>
            <div className="space-y-3">
              {adminAlerts.map((alert) => (
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
                        {alert.hostId && (
                          <span className="ml-2">Host: {alert.hostId}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}