import React, { useState, useEffect } from 'react';
import { MiniPC } from '@/types/shared-types';
import { 
  Bug, 
  BugOff, 
  Monitor, 
  Activity, 
  Eye, 
  EyeOff,
  RefreshCw,
  Download,
  Trash2,
  Circle
} from 'lucide-react';

interface DebugControllerProps {
  hosts: MiniPC[];
}

interface DebugStatus {
  hostId: string;
  hostname: string;
  enabled: boolean;
  metrics?: {
    cpu: number;
    memory: number;
    apiRequestsPerMinute: number;
    activeWindows: number;
    uptime: number;
  };
  eventCount?: number;
  lastUpdate?: Date;
  loading?: boolean;
  error?: string;
}

export const DebugController: React.FC<DebugControllerProps> = ({ hosts }) => {
  const [debugStatuses, setDebugStatuses] = useState<Map<string, DebugStatus>>(new Map());
  const [selectedHost, setSelectedHost] = useState<string>('');
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);
  const [refreshInterval, setRefreshInterval] = useState<number>(5000);

  // Auto-refresh debug status for all hosts
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      refreshAllDebugStatuses();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, hosts]);

  // Initial load
  useEffect(() => {
    refreshAllDebugStatuses();
  }, [hosts]);

  const refreshAllDebugStatuses = async () => {
    const onlineHosts = hosts.filter(h => h.status.online);
    
    for (const host of onlineHosts) {
      await refreshDebugStatus(host.id);
    }
  };

  const refreshDebugStatus = async (hostId: string): Promise<void> => {
    const host = hosts.find(h => h.id === hostId);
    if (!host || !host.status.online) return;

    setDebugStatuses(prev => {
      const newMap = new Map(prev);
      const current = newMap.get(hostId) || { hostId, hostname: host.hostname, enabled: false };
      newMap.set(hostId, { ...current, loading: true, error: undefined });
      return newMap;
    });

    try {
      const response = await fetch(`http://${host.hostname}:${host.port}/api/debug/status`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.ok) {
        const result = await response.json();
        
        if (result.success) {
          setDebugStatuses(prev => {
            const newMap = new Map(prev);
            newMap.set(hostId, {
              hostId,
              hostname: host.hostname,
              enabled: result.data.enabled,
              metrics: result.data.metrics,
              eventCount: Object.values(result.data.eventStats || {}).reduce((sum: number, count) => sum + (count as number), 0),
              lastUpdate: new Date(),
              loading: false
            });
            return newMap;
          });
        }
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      setDebugStatuses(prev => {
        const newMap = new Map(prev);
        const current = newMap.get(hostId) || { hostId, hostname: host.hostname, enabled: false };
        newMap.set(hostId, { 
          ...current, 
          loading: false, 
          error: error instanceof Error ? error.message : 'Connection failed'
        });
        return newMap;
      });
    }
  };

  const toggleDebug = async (hostId: string): Promise<void> => {
    const host = hosts.find(h => h.id === hostId);
    const status = debugStatuses.get(hostId);
    
    if (!host || !host.status.online) return;

    const action = status?.enabled ? 'disable' : 'enable';
    
    try {
      const response = await fetch(`http://${host.hostname}:${host.port}/api/debug/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          // Refresh status immediately after toggle
          await refreshDebugStatus(hostId);
        }
      }
    } catch (error) {
      console.error(`Error toggling debug for ${host.hostname}:`, error);
    }
  };

  const clearDebugEvents = async (hostId: string): Promise<void> => {
    const host = hosts.find(h => h.id === hostId);
    if (!host || !host.status.online) return;

    try {
      const response = await fetch(`http://${host.hostname}:${host.port}/api/debug/events`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.ok) {
        // Refresh status after clearing
        await refreshDebugStatus(hostId);
      }
    } catch (error) {
      console.error(`Error clearing debug events for ${host.hostname}:`, error);
    }
  };

  const downloadDebugEvents = async (hostId: string): Promise<void> => {
    const host = hosts.find(h => h.id === hostId);
    if (!host || !host.status.online) return;

    try {
      const response = await fetch(`http://${host.hostname}:${host.port}/api/debug/events?limit=1000`);
      
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          const dataStr = JSON.stringify(result.data, null, 2);
          const blob = new Blob([dataStr], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          
          const a = document.createElement('a');
          a.href = url;
          a.download = `debug-events-${host.hostname}-${new Date().toISOString().split('T')[0]}.json`;
          a.click();
          
          URL.revokeObjectURL(url);
        }
      }
    } catch (error) {
      console.error(`Error downloading debug events for ${host.hostname}:`, error);
    }
  };

  const enableAllDebug = async (): Promise<void> => {
    const onlineHosts = hosts.filter(h => h.status.online);
    for (const host of onlineHosts) {
      const status = debugStatuses.get(host.id);
      if (!status?.enabled) {
        await toggleDebug(host.id);
      }
    }
  };

  const disableAllDebug = async (): Promise<void> => {
    const onlineHosts = hosts.filter(h => h.status.online);
    for (const host of onlineHosts) {
      const status = debugStatuses.get(host.id);
      if (status?.enabled) {
        await toggleDebug(host.id);
      }
    }
  };

  const onlineHosts = hosts.filter(h => h.status.online);
  const enabledCount = Array.from(debugStatuses.values()).filter(s => s.enabled).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Bug className="w-6 h-6 text-primary-600" />
          <h2 className="text-xl font-semibold text-gray-900">Debug Controller</h2>
          <span className="px-2 py-1 bg-primary-100 text-primary-800 rounded text-sm font-medium">
            {enabledCount}/{onlineHosts.length} Active
          </span>
        </div>

        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`p-2 rounded transition-colors ${
                autoRefresh ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-600'
              }`}
              title={autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh OFF'}
            >
              {autoRefresh ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            </button>

            <button
              onClick={() => refreshAllDebugStatuses()}
              className="p-2 bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition-colors"
              title="Refresh All"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={enableAllDebug}
              className="btn-primary text-sm flex items-center"
              disabled={enabledCount === onlineHosts.length}
            >
              <Bug className="w-4 h-4 mr-1" />
              Enable All
            </button>
            
            <button
              onClick={disableAllDebug}
              className="btn-secondary text-sm flex items-center"
              disabled={enabledCount === 0}
            >
              <BugOff className="w-4 h-4 mr-1" />
              Disable All
            </button>
          </div>
        </div>
      </div>

      {/* Host Debug Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {onlineHosts.map(host => {
          const status = debugStatuses.get(host.id);
          const isLoading = status?.loading;
          const hasError = status?.error;

          return (
            <div key={host.id} className="card">
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <Monitor className="w-5 h-5 text-gray-600" />
                  <div>
                    <h3 className="font-medium text-gray-900">{host.hostname}</h3>
                    <p className="text-xs text-gray-500">{host.ipAddress}:{host.port}</p>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Circle 
                    className={`w-3 h-3 ${
                      isLoading ? 'text-yellow-500 animate-pulse' :
                      status?.enabled ? 'text-green-500' : 
                      hasError ? 'text-red-500' : 'text-gray-400'
                    }`} 
                    fill="currentColor"
                  />
                  
                  <button
                    onClick={() => toggleDebug(host.id)}
                    disabled={isLoading}
                    className={`p-2 rounded transition-colors ${
                      status?.enabled 
                        ? 'bg-red-100 text-red-600 hover:bg-red-200' 
                        : 'bg-green-100 text-green-600 hover:bg-green-200'
                    }`}
                  >
                    {status?.enabled ? <BugOff className="w-4 h-4" /> : <Bug className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Status & Metrics */}
              {hasError ? (
                <div className="text-sm text-red-600 mb-4">
                  Error: {status?.error}
                </div>
              ) : status?.enabled && status?.metrics ? (
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">CPU:</span>
                    <span className="font-mono">{status.metrics.cpu}%</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Memory:</span>
                    <span className="font-mono">{status.metrics.memory}%</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">API Requests:</span>
                    <span className="font-mono">{status.metrics.apiRequestsPerMinute}/min</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Events:</span>
                    <span className="font-mono">{status.eventCount || 0}</span>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-gray-500 mb-4">
                  {isLoading ? 'Loading...' : 'Debug disabled'}
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => downloadDebugEvents(host.id)}
                  disabled={!status?.enabled || isLoading}
                  className="flex-1 btn-secondary text-xs flex items-center justify-center"
                >
                  <Download className="w-3 h-3 mr-1" />
                  Export
                </button>
                
                <button
                  onClick={() => clearDebugEvents(host.id)}
                  disabled={!status?.enabled || isLoading}
                  className="flex-1 btn-secondary text-xs flex items-center justify-center"
                >
                  <Trash2 className="w-3 h-3 mr-1" />
                  Clear
                </button>
              </div>

              {/* Last Update */}
              {status?.lastUpdate && (
                <div className="mt-2 text-xs text-gray-400 text-center">
                  Updated: {status.lastUpdate.toLocaleTimeString()}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Info Panel */}
      <div className="bg-blue-50 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <Activity className="w-5 h-5 text-blue-600 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-medium text-blue-900 mb-2">Debug Controller Info</h4>
            <div className="text-sm text-blue-800 space-y-1">
              <p>• <strong>Remote Control:</strong> Enable/disable debug mode on any host</p>
              <p>• <strong>Local Sync:</strong> Hotkey (Ctrl+Shift+D) syncs with this interface</p>
              <p>• <strong>Real-time:</strong> Status updates every {refreshInterval/1000} seconds when auto-refresh is on</p>
              <p>• <strong>Debug Overlay:</strong> Visual overlay appears on host's primary display when enabled</p>
            </div>
          </div>
        </div>
      </div>

      {onlineHosts.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <Monitor className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No hosts online. Start host agents to see debug controls.</p>
        </div>
      )}
    </div>
  );
};
