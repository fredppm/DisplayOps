import React, { useState, useEffect } from 'react';
import { MiniPC } from '@/types/shared-types';
import { Monitor, Wifi, WifiOff, Activity, AlertCircle, RefreshCw, Eye, EyeOff, Bug, BugOff, Download, Trash2, Circle, Search } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface HostsListProps {
  hosts: MiniPC[];
  isDiscovering: boolean;
  discoveryStatus?: {
    isConnected: boolean;
    lastUpdate: Date | null;
    connectionError: string | null;
    reconnectAttempts: number;
  };
}

interface RefreshStatus {
  [key: string]: 'idle' | 'refreshing' | 'success' | 'error';
}

interface ActiveDisplay {
  displayId: string;
  windowId: string;
  hasWindow: boolean;
}

interface NotificationProps {
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
}

interface DebugStatus {
  hostId: string;
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

export const HostsList: React.FC<HostsListProps> = ({ hosts, isDiscovering, discoveryStatus }) => {
  const [selectedHost, setSelectedHost] = useState<string | null>(null);
  const [refreshStatus, setRefreshStatus] = useState<RefreshStatus>({});
  const [notifications, setNotifications] = useState<NotificationProps[]>([]);
  const [activeDisplays, setActiveDisplays] = useState<{[hostId: string]: ActiveDisplay[]}>({});
  const [expandedHosts, setExpandedHosts] = useState<Set<string>>(new Set());
  const [debugStatuses, setDebugStatuses] = useState<Map<string, DebugStatus>>(new Map());
  const [showDebugControls, setShowDebugControls] = useState<Set<string>>(new Set());
  const [identifyingDisplays, setIdentifyingDisplays] = useState<{[hostId: string]: boolean}>({});
  
  // Debug log removed to reduce console noise

  const getStatusColor = (host: MiniPC): string => {
    if (!host.status.online) return 'status-offline';
    if (host.status.lastError) return 'status-warning';
    return 'status-online';
  };

  const getStatusText = (host: MiniPC): string => {
    if (!host.status.online) return 'Offline';
    if (host.status.lastError) return 'Warning';
    return 'Online';
  };

  const formatLastSeen = (lastHeartbeat: Date | string | undefined): string => {
    if (!lastHeartbeat) return 'Never';
    
    try {
      const date = typeof lastHeartbeat === 'string' ? new Date(lastHeartbeat) : lastHeartbeat;
      if (isNaN(date.getTime())) return 'Never';
      return formatDistanceToNow(date);
    } catch {
      return 'Never';
    }
  };

  const addNotification = (type: NotificationProps['type'], title: string, message: string) => {
    const notification = { type, title, message };
    setNotifications(prev => [...prev, notification]);
    
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n !== notification));
    }, 4000);
  };

  const removeNotification = (notification: NotificationProps) => {
    setNotifications(prev => prev.filter(n => n !== notification));
  };

  const checkActiveDisplays = async (host: MiniPC) => {
    try {
      const response = await fetch(`/api/host/${host.id}/windows`);
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          const windows = result.data;
          const displays: ActiveDisplay[] = [];
          
          ['display-1', 'display-2', 'display-3'].forEach(displayId => {
            const window = windows.find((w: any) => w.id.includes(displayId));
            displays.push({
              displayId,
              windowId: window?.id || '',
              hasWindow: !!window
            });
          });
          
          setActiveDisplays(prev => ({
            ...prev,
            [host.id]: displays
          }));
        }
      }
    } catch (error) {
      setActiveDisplays(prev => ({
        ...prev,
        [host.id]: ['display-1', 'display-2', 'display-3'].map(displayId => ({
          displayId,
          windowId: '',
          hasWindow: false
        }))
      }));
    }
  };

  const refreshDisplay = async (host: MiniPC, displayId: string) => {
    const statusKey = `${host.id}-${displayId}`;
    
    setRefreshStatus(prev => ({ ...prev, [statusKey]: 'refreshing' }));
    
    try {
      // ✅ Refresh display via web-controller API (which uses gRPC)
      const response = await fetch(`/api/host/${host.id}/command`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'REFRESH_PAGE',
          targetDisplay: displayId,
          payload: {},
          timestamp: new Date()
        })
      });

      if (response.ok) {
        const result = await response.json();
        
        if (result.success) {
          setRefreshStatus(prev => ({ ...prev, [statusKey]: 'success' }));
          addNotification('success', 'Display Refreshed', 
            `${displayId.replace('display-', 'Display ')} on ${host.hostname} refreshed successfully`);
        } else {
          setRefreshStatus(prev => ({ ...prev, [statusKey]: 'error' }));
          addNotification('error', 'Refresh Failed', 
            result.error || 'Unknown error occurred during refresh');
        }
      } else {
        setRefreshStatus(prev => ({ ...prev, [statusKey]: 'error' }));
        const errorData = await response.json();
        addNotification('error', 'Refresh Request Failed', errorData.error || `HTTP ${response.status}`);
      }
    } catch (error: any) {
      setRefreshStatus(prev => ({ ...prev, [statusKey]: 'error' }));
      addNotification('error', 'Connection Error', 
        `Failed to connect to ${host.hostname}`);
    }

    setTimeout(() => {
      setRefreshStatus(prev => ({ ...prev, [statusKey]: 'idle' }));
    }, 3000);
  };

  const refreshAllDisplaysOnHost = async (host: MiniPC) => {
    const hostDisplays = activeDisplays[host.id] || [];
    const activeDisplayIds = hostDisplays.filter(d => d.hasWindow).map(d => d.displayId);
    
    if (activeDisplayIds.length === 0) {
      addNotification('warning', 'No Active Displays', 
        `No active displays found on ${host.hostname}`);
      return;
    }
    
    addNotification('info', 'Refreshing Active Displays', 
      `Refreshing ${activeDisplayIds.length} displays on ${host.hostname}`);

    const refreshPromises = activeDisplayIds.map(displayId => refreshDisplay(host, displayId));
    await Promise.all(refreshPromises);
  };

  const handleRefreshHost = async (host: MiniPC) => {
    await checkActiveDisplays(host);
    await refreshDebugStatus(host.id);
  };

  const toggleHostExpansion = (hostId: string) => {
    setExpandedHosts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(hostId)) {
        newSet.delete(hostId);
      } else {
        newSet.add(hostId);
      }
      return newSet;
    });
  };

  useEffect(() => {
    hosts.forEach(host => {
      if (host.status.online) {
        checkActiveDisplays(host);
        refreshDebugStatus(host.id);
      }
    });
  }, [hosts]);

  const refreshDebugStatus = async (hostId: string): Promise<void> => {
    const host = hosts.find(h => h.id === hostId);
    if (!host || !host.status.online) return;

    setDebugStatuses(prev => {
      const newMap = new Map(prev);
      const current = newMap.get(hostId) || { hostId, enabled: false };
      newMap.set(hostId, { ...current, loading: true, error: undefined });
      return newMap;
    });

    try {
      const response = await fetch(`/api/host/${hostId}/debug/status`, {
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
        const current = newMap.get(hostId) || { hostId, enabled: false };
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
      const response = await fetch(`/api/host/${hostId}/debug/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          await refreshDebugStatus(hostId);
          addNotification('success', 'Debug Mode', 
            `Debug ${action}d on ${host.hostname}`);
        }
      }
    } catch (error) {
      addNotification('error', 'Debug Error', 
        `Failed to ${action} debug on ${host.hostname}`);
    }
  };

  const clearDebugEvents = async (hostId: string): Promise<void> => {
    const host = hosts.find(h => h.id === hostId);
    if (!host || !host.status.online) return;

    try {
      const response = await fetch(`/api/host/${hostId}/debug/events`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.ok) {
        await refreshDebugStatus(hostId);
        addNotification('success', 'Debug Events', 
          `Cleared debug events on ${host.hostname}`);
      }
    } catch (error) {
      addNotification('error', 'Debug Error', 
        `Failed to clear debug events on ${host.hostname}`);
    }
  };

  const downloadDebugEvents = async (hostId: string): Promise<void> => {
    const host = hosts.find(h => h.id === hostId);
    if (!host || !host.status.online) return;

    try {
      const response = await fetch(`/api/host/${hostId}/debug/events?limit=1000`);
      
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
          addNotification('success', 'Debug Export', 
            `Downloaded debug events from ${host.hostname}`);
        }
      }
    } catch (error) {
      addNotification('error', 'Debug Error', 
        `Failed to download debug events from ${host.hostname}`);
    }
  };

  const toggleDebugControls = (hostId: string) => {
    setShowDebugControls(prev => {
      const newSet = new Set(prev);
      if (newSet.has(hostId)) {
        newSet.delete(hostId);
      } else {
        newSet.add(hostId);
      }
      return newSet;
    });
  };

  const identifyDisplays = async (hostId: string) => {
    const host = hosts.find(h => h.id === hostId);
    if (!host || !host.status.online) return;

    setIdentifyingDisplays(prev => ({ ...prev, [hostId]: true }));

    try {
      // ✅ Identify displays via web-controller API (which uses gRPC)
      const response = await fetch(`/api/host/${hostId}/command`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'identify_displays',
          targetDisplay: 'all',
          payload: {
            duration: 5,
            fontSize: 200,
            backgroundColor: 'rgba(0, 100, 200, 0.9)'
          },
          timestamp: new Date().toISOString()
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to identify displays');
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Failed to identify displays');
      }

      addNotification('success', 'Display Identification', 
        `Showing numbers on displays for ${host.hostname}`);

      // Auto clear the identifying state after the duration
      setTimeout(() => {
        setIdentifyingDisplays(prev => ({ ...prev, [hostId]: false }));
      }, 5000);

    } catch (error) {
      console.error('Error identifying displays:', error);
      addNotification('error', 'Display Identification Failed', 
        `Failed to identify displays on ${host.hostname}`);
      setIdentifyingDisplays(prev => ({ ...prev, [hostId]: false }));
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'success': return 'bg-green-100 border-green-400 text-green-700';
      case 'error': return 'bg-red-100 border-red-400 text-red-700';
      case 'warning': return 'bg-yellow-100 border-yellow-400 text-yellow-700';
      case 'info': return 'bg-blue-100 border-blue-400 text-blue-700';
      default: return 'bg-gray-100 border-gray-400 text-gray-700';
    }
  };

  return (
    <div className="space-y-6">
      {/* Notifications */}
      {notifications.length > 0 && (
        <div className="fixed top-4 right-4 z-50 space-y-2 max-w-md">
          {notifications.map((notification, index) => (
            <div
              key={index}
              className={`border-l-4 p-4 rounded shadow-lg ${getNotificationColor(notification.type)}`}
            >
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-semibold">{notification.title}</p>
                  <p className="text-sm">{notification.message}</p>
                </div>
                <button
                  onClick={() => removeNotification(notification)}
                  className="ml-2 text-lg leading-none hover:opacity-70"
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Host Agents</h2>
          <p className="text-gray-600 mt-1 text-sm">
            {hosts.length} {hosts.length === 1 ? 'host' : 'hosts'} discovered
          </p>
        </div>
        
        <div className="flex items-center space-x-3">
          {isDiscovering && (
            <div className="flex items-center text-blue-600">
              <RefreshCw className="w-4 h-4 animate-spin mr-2" />
              <span className="text-sm">Discovering...</span>
            </div>
          )}
        </div>
      </div>

      {/* Hosts Grid */}
      {hosts.length === 0 ? (
        <div className="card text-center py-12">
          <div className="flex flex-col items-center">
            <Wifi className="w-12 h-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No hosts discovered yet
            </h3>
            <p className="text-gray-500 mb-4">
              Make sure host agents are running and mDNS is enabled on your network
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-1 lg:grid-cols-2 gap-4">
          {hosts.map((host) => (
            <div
              key={host.id}
              className="card hover:shadow-md transition-all duration-200 cursor-pointer"
              onClick={() => setSelectedHost(selectedHost === host.id ? null : host.id)}
            >
              {/* Host Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center">
                  <Monitor className="w-6 h-6 text-primary-600 mr-3" />
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {host.hostname}
                    </h3>
                    <p className="text-sm text-gray-500">{host.ipAddress} • v{host.version}</p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <span className={getStatusColor(host)}>
                    {getStatusText(host)}
                  </span>
                  
                  {/* Debug Status Indicator */}
                  <div className="flex items-center mr-2">
                    <Circle 
                      className={`w-2 h-2 ${
                        debugStatuses.get(host.id)?.loading ? 'text-yellow-500 animate-pulse' :
                        debugStatuses.get(host.id)?.enabled ? 'text-green-500' : 
                        debugStatuses.get(host.id)?.error ? 'text-red-500' : 'text-gray-300'
                      }`} 
                      fill="currentColor"
                    />
                  </div>
                  
                  {host.status.online && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        identifyDisplays(host.id);
                      }}
                      disabled={identifyingDisplays[host.id]}
                      className={`p-1 transition-colors ${
                        identifyingDisplays[host.id] 
                          ? 'text-blue-500 animate-pulse' 
                          : 'text-gray-400 hover:text-blue-600'
                      }`}
                      title="Identify Displays - Shows numbers on each monitor"
                    >
                      <Search className="w-4 h-4" />
                    </button>
                  )}
                  
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleDebugControls(host.id);
                    }}
                    className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                    title="Show debug controls"
                  >
                    <Bug className="w-4 h-4" />
                  </button>
                  
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleHostExpansion(host.id);
                    }}
                    className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                    title="Show display controls"
                  >
                    {expandedHosts.has(host.id) ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                  
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRefreshHost(host);
                    }}
                    className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                    title="Refresh host status"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* System Metrics - Simplified */}
              <div className="flex items-center space-x-4 mb-4 text-sm text-gray-600">
                <span>CPU: {host.status.cpuUsage.toFixed(0)}%</span>
                <span>•</span>
                <span>Memory: {host.status.memoryUsage.toFixed(0)}%</span>
                <span>•</span>
                <span>{host.status.browserProcesses} processes</span>
              </div>

              {/* Displays - Simplified */}
              <div className="mb-3">
                <div className="flex items-center space-x-2 text-sm text-gray-600">
                  <Monitor className="w-4 h-4" />
                  <span>{host.displays.length} displays configured</span>
                </div>
              </div>

              {/* Last Seen */}
              <div className="text-xs text-gray-500">
                Last seen {formatLastSeen(host.lastHeartbeat)} ago
              </div>

              {/* Error Display */}
              {host.status.lastError && (
                <div className="mt-3 p-2 bg-red-50 rounded border border-red-200">
                  <div className="flex items-start">
                    <AlertCircle className="w-4 h-4 text-red-500 mr-2 mt-0.5 flex-shrink-0" />
                    <div className="text-xs text-red-700">
                      {host.status.lastError}
                    </div>
                  </div>
                </div>
              )}

              {/* Debug Controls */}
              {showDebugControls.has(host.id) && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-medium text-gray-700">Debug Controls</h4>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleDebug(host.id);
                        }}
                        disabled={debugStatuses.get(host.id)?.loading}
                        className={`text-xs px-2 py-1 rounded transition-colors ${
                          debugStatuses.get(host.id)?.enabled 
                            ? 'bg-red-100 text-red-700 hover:bg-red-200' 
                            : 'bg-green-100 text-green-700 hover:bg-green-200'
                        }`}
                      >
                        {debugStatuses.get(host.id)?.enabled ? (
                          <><BugOff className="w-3 h-3 inline mr-1" />Disable</>
                        ) : (
                          <><Bug className="w-3 h-3 inline mr-1" />Enable</>
                        )}
                      </button>
                    </div>
                  </div>
                  
                  {/* Debug Status & Metrics */}
                  {debugStatuses.get(host.id)?.error ? (
                    <div className="text-xs text-red-600 mb-3">
                      Error: {debugStatuses.get(host.id)?.error}
                    </div>
                  ) : debugStatuses.get(host.id)?.enabled && debugStatuses.get(host.id)?.metrics ? (
                    <div className="grid grid-cols-2 gap-2 mb-3 text-xs">
                      <div className="flex justify-between">
                        <span className="text-gray-600">API Req:</span>
                        <span className="font-mono">{debugStatuses.get(host.id)?.metrics?.apiRequestsPerMinute || 0}/min</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Events:</span>
                        <span className="font-mono">{debugStatuses.get(host.id)?.eventCount || 0}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-gray-500 mb-3">
                      {debugStatuses.get(host.id)?.loading ? 'Loading...' : 'Debug disabled'}
                    </div>
                  )}
                  
                  {/* Debug Actions */}
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        downloadDebugEvents(host.id);
                      }}
                      disabled={!debugStatuses.get(host.id)?.enabled || debugStatuses.get(host.id)?.loading}
                      className="flex-1 bg-blue-100 text-blue-700 hover:bg-blue-200 disabled:bg-gray-200 disabled:text-gray-500 px-2 py-1 rounded text-xs font-medium transition-colors"
                    >
                      <Download className="w-3 h-3 inline mr-1" />
                      Export
                    </button>
                    
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        clearDebugEvents(host.id);
                      }}
                      disabled={!debugStatuses.get(host.id)?.enabled || debugStatuses.get(host.id)?.loading}
                      className="flex-1 bg-orange-100 text-orange-700 hover:bg-orange-200 disabled:bg-gray-200 disabled:text-gray-500 px-2 py-1 rounded text-xs font-medium transition-colors"
                    >
                      <Trash2 className="w-3 h-3 inline mr-1" />
                      Clear
                    </button>
                  </div>
                </div>
              )}
              
              {/* Display Refresh Controls */}
              {expandedHosts.has(host.id) && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-medium text-gray-700">Display Controls</h4>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        refreshAllDisplaysOnHost(host);
                      }}
                      disabled={!host.status.online}
                      className="text-xs bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white px-2 py-1 rounded transition-colors"
                    >
                      Refresh All
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-2">
                    {['display-1', 'display-2', 'display-3'].map((displayId) => {
                      const statusKey = `${host.id}-${displayId}`;
                      const status = refreshStatus[statusKey] || 'idle';
                      const hostDisplays = activeDisplays[host.id] || [];
                      const displayInfo = hostDisplays.find(d => d.displayId === displayId);
                      const hasWindow = displayInfo?.hasWindow || false;
                      
                      return (
                        <div
                          key={displayId}
                          className={`border rounded-lg p-3 text-center transition-colors ${
                            hasWindow 
                              ? 'border-green-200 bg-green-50' 
                              : 'border-gray-200 bg-gray-50'
                          }`}
                        >
                          <div className={`font-medium text-sm mb-2 ${
                            hasWindow ? 'text-green-700' : 'text-gray-500'
                          }`}>
                            {displayId.replace('display-', 'Display ')}
                          </div>
                          
                          <div className={`text-xs mb-3 ${
                            hasWindow ? 'text-green-600' : 'text-gray-400'
                          }`}>
                            {hasWindow ? '🟢 Active' : '⚪ No Dashboard'}
                          </div>
                          
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              refreshDisplay(host, displayId);
                            }}
                            disabled={!host.status.online || status === 'refreshing' || !hasWindow}
                            className={`w-full py-2 px-3 rounded text-xs font-medium transition-colors ${
                              hasWindow 
                                ? 'bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white'
                                : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                            }`}
                          >
                            {status === 'refreshing' ? 'Refreshing...' : 
                             hasWindow ? 'Refresh' : 'No Dashboard'}
                          </button>
                          
                          {status === 'success' && (
                            <div className="text-xs text-green-600 mt-2">✓ Success</div>
                          )}
                          {status === 'error' && (
                            <div className="text-xs text-red-600 mt-2">✗ Error</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Expanded Details */}
              {selectedHost === host.id && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="space-y-3">
                    <div>
                      <div className="text-xs text-gray-500 uppercase tracking-wide">
                        mDNS Service
                      </div>
                      <div className="text-sm text-gray-900">
                        {host.mdnsService?.instanceName || 'N/A'}
                      </div>
                    </div>
                    
                    <div>
                      <div className="text-xs text-gray-500 uppercase tracking-wide">
                        Browser Processes
                      </div>
                      <div className="text-sm text-gray-900">
                        {host.status.browserProcesses} active
                      </div>
                    </div>
                    
                    <div>
                      <div className="text-xs text-gray-500 uppercase tracking-wide">
                        Last Discovered
                      </div>
                      <div className="text-sm text-gray-900">
                        {formatLastSeen(host.lastDiscovered)} ago
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
