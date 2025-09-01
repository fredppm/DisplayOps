import React, { useState, useEffect } from 'react';
import { MiniPC, Dashboard } from '@/types/shared-types';
import { 
  Monitor, 
  RefreshCw, 
  Bug, 
  BugOff, 
  Search, 
  Download, 
  Trash2, 
  Circle,
  ExternalLink,
  AlertCircle,
  CheckCircle,
  X,
  ChevronDown,
  Loader,
  BarChart3,
  Settings,
  Clock
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useDashboards } from '@/hooks/useDashboards';

interface DisplayCardProps {
  host: MiniPC;
  onRefreshHost?: (host: MiniPC) => void;
  onRefreshDisplay?: (host: MiniPC, displayId: string) => void;
  onIdentifyDisplays?: (hostId: string) => void;
  onToggleDebug?: (hostId: string) => Promise<void>;
  onDownloadDebugEvents?: (hostId: string) => Promise<void>;
  onClearDebugEvents?: (hostId: string) => Promise<void>;
}

interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp: Date;
}

interface ActiveDisplay {
  displayId: string;
  windowId: string;
  hasWindow: boolean;
}

interface RefreshStatus {
  [key: string]: 'idle' | 'refreshing' | 'success' | 'error';
}

export const DisplayCard: React.FC<DisplayCardProps> = ({
  host,
  onRefreshHost,
  onRefreshDisplay,
  onIdentifyDisplays,
  onToggleDebug,
  onDownloadDebugEvents,
  onClearDebugEvents
}) => {
  const [showDebugControls, setShowDebugControls] = useState(false);
  const [identifyingDisplays, setIdentifyingDisplays] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [activeDisplays, setActiveDisplays] = useState<ActiveDisplay[]>([]);
  const [refreshStatus, setRefreshStatus] = useState<RefreshStatus>({});
  const [deployDropdownOpen, setDeployDropdownOpen] = useState<string | null>(null);

  // Use real dashboards from API
  const { dashboards, loading: dashboardsLoading, error: dashboardsError } = useDashboards();

  const addNotification = (type: Notification['type'], title: string, message: string) => {
    const notification: Notification = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      title,
      message,
      timestamp: new Date()
    };
    setNotifications(prev => [notification, ...prev.slice(0, 4)]);
    
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== notification.id));
    }, 4000);
  };

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const getStatusColor = (): string => {
    if (!host.metrics.online) return 'status-offline';
    if (host.metrics.lastError) return 'status-warning';
    return 'status-online';
  };

  const getStatusText = (): string => {
    if (!host.metrics.online) return 'Offline';
    if (host.metrics.lastError) return 'Warning';
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

  const checkActiveDisplays = async () => {
    try {
      const response = await fetch(`/api/host/${host.id}/windows`);
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          const windows = result.data;
          const displays: ActiveDisplay[] = [];
          
          host.displays.forEach(displayId => {
            const window = windows.find((w: any) => w.id.includes(displayId));
            displays.push({
              displayId,
              windowId: window?.id || '',
              hasWindow: !!window
            });
          });
          
          setActiveDisplays(displays);
        }
      }
    } catch (error) {
      setActiveDisplays(host.displays.map(displayId => ({
        displayId,
        windowId: '',
        hasWindow: false
      })));
    }
  };

  const handleRefreshDisplay = async (displayId: string) => {
    const statusKey = `${host.id}-${displayId}`;
    
    setRefreshStatus(prev => ({ ...prev, [statusKey]: 'refreshing' }));
    
    try {
      if (onRefreshDisplay) {
        await onRefreshDisplay(host, displayId);
        setRefreshStatus(prev => ({ ...prev, [statusKey]: 'success' }));
        addNotification('success', 'Display Refreshed', 
          `${displayId.replace('display-', 'Display ')} refreshed successfully`);
      }
    } catch (error) {
      setRefreshStatus(prev => ({ ...prev, [statusKey]: 'error' }));
      addNotification('error', 'Refresh Failed', 'Failed to refresh display');
    }

    setTimeout(() => {
      setRefreshStatus(prev => ({ ...prev, [statusKey]: 'idle' }));
    }, 3000);
  };

  const handleIdentifyDisplays = async () => {
    if (onIdentifyDisplays) {
      setIdentifyingDisplays(true);
      try {
        await onIdentifyDisplays(host.id);
        addNotification('success', 'Display Identification', 'Showing numbers on displays');
        setTimeout(() => setIdentifyingDisplays(false), 5000);
      } catch (error) {
        addNotification('error', 'Identification Failed', 'Failed to identify displays');
        setIdentifyingDisplays(false);
      }
    }
  };

  const handleDeployDashboard = async (dashboardId: string, displayId: string) => {
    const dashboard = dashboards.find(d => d.id === dashboardId);
    if (!dashboard) return;

    try {
      // This would make the actual API call to deploy
      addNotification('info', 'Deploying Dashboard', `Opening ${dashboard.name} on ${displayId.replace('display-', 'Display ')}...`);
      
      // Mock deployment - in real app this would call the actual API
      setTimeout(() => {
        addNotification('success', 'Dashboard Deployed', 
          `${dashboard.name} is now displaying on ${displayId.replace('display-', 'Display ')}`);
      }, 2000);
      
    } catch (error) {
      addNotification('error', 'Deployment Failed', 'Failed to deploy dashboard');
    }
    
    setDeployDropdownOpen(null);
  };

  const getDisplayStatus = (displayId: string) => {
    const display = activeDisplays.find(d => d.displayId === displayId);
    if (!display) return { status: 'unknown', text: 'Unknown', color: 'text-gray-500' };
    
    if (display.hasWindow) {
      // Mock getting dashboard name - in real app this would come from API
      const mockActiveDashboard = displayId === 'display-1' ? 'Grafana VTEX' : 
                                  displayId === 'display-2' ? 'Health Monitor' : null;
      return {
        status: 'active',
        text: mockActiveDashboard || 'Active',
        color: 'text-green-600',
        dashboard: mockActiveDashboard
      };
    }
    
    return { status: 'empty', text: 'No Content', color: 'text-gray-500' };
  };

  useEffect(() => {
    if (host.metrics.online) {
      checkActiveDisplays();
    }
  }, [host.metrics.online]);

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
    <>
      {/* Notifications */}
      {notifications.length > 0 && (
        <div className="fixed top-4 right-4 z-50 space-y-2 max-w-md">
          {notifications.map((notification) => (
            <div
              key={notification.id}
              className={`border-l-4 p-4 rounded shadow-lg ${getNotificationColor(notification.type)}`}
            >
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-semibold">{notification.title}</p>
                  <p className="text-sm">{notification.message}</p>
                </div>
                <button
                  onClick={() => removeNotification(notification.id)}
                  className="ml-2 text-lg leading-none hover:opacity-70"
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="card hover:shadow-md transition-all duration-200">
        {/* Desktop Layout */}
        <div className="hidden lg:block">
          <div className="grid gap-4 items-stretch" style={{
            gridTemplateColumns: `minmax(200px, 1fr) repeat(${host.displays.length}, 1fr)`
          }}>
            {/* Host Info */}
            <div className="col-span-1">
              <div className="flex items-center mb-2">
                <div className="relative mr-2">
                  <Monitor className="w-5 h-5 text-primary-600" />
                  <div className={`absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-white ${
                    host.metrics.online 
                      ? host.metrics.lastError ? 'bg-yellow-500' : 'bg-green-500'
                      : 'bg-red-500'
                  }`}></div>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 text-sm">{host.hostname}</h3>
                  <p className="text-xs text-gray-500">{host.ipAddress}</p>
                </div>
              </div>
              
              <div className="text-xs text-gray-500 mb-3">
                CPU: {host.metrics.cpuUsage.toFixed(0)}% • RAM: {host.metrics.memoryUsage.toFixed(0)}%
              </div>

              {/* Debug Actions */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1">
                    <Clock className="w-3 h-3 text-gray-400" />
                    <span className="text-xs text-gray-500">
                      {formatLastSeen(host.lastHeartbeat)}
                    </span>
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <button
                    onClick={handleIdentifyDisplays}
                    disabled={identifyingDisplays}
                    className={`flex-1 text-xs px-3 py-2 rounded transition-colors flex items-center justify-center ${
                      identifyingDisplays 
                        ? 'bg-blue-200 text-blue-800 animate-pulse' 
                        : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                    }`}
                    title="Identify Displays"
                  >
                    <Search className="w-3 h-3 mr-1" />
                    Identify
                  </button>
                  
                  <button
                    onClick={() => setShowDebugControls(!showDebugControls)}
                    className={`flex-1 text-xs px-3 py-2 rounded transition-colors flex items-center justify-center ${
                      host.debugEnabled 
                        ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                    title={`Debug ${host.debugEnabled ? 'Enabled' : 'Disabled'}`}
                  >
                    <Bug className="w-3 h-3 mr-1" />
                    Debug
                  </button>
                </div>

                {showDebugControls && (
                  <div className="space-y-1 pt-2 border-t">
                    <button
                      onClick={() => onToggleDebug?.(host.id)}
                      className={`text-xs px-2 py-1 rounded transition-colors w-full ${
                        host.debugEnabled 
                          ? 'bg-red-100 text-red-700 hover:bg-red-200' 
                          : 'bg-green-100 text-green-700 hover:bg-green-200'
                      }`}
                    >
                      {host.debugEnabled ? 'Disable' : 'Enable'}
                    </button>
                    
                    <button
                      onClick={() => onDownloadDebugEvents?.(host.id)}
                      disabled={!host.debugEnabled}
                      className="text-xs bg-blue-100 text-blue-700 hover:bg-blue-200 disabled:bg-gray-200 disabled:text-gray-500 px-2 py-1 rounded w-full"
                    >
                      📥 Export
                    </button>
                    
                    <button
                      onClick={() => onClearDebugEvents?.(host.id)}
                      disabled={!host.debugEnabled}
                      className="text-xs bg-orange-100 text-orange-700 hover:bg-orange-200 disabled:bg-gray-200 disabled:text-gray-500 px-2 py-1 rounded w-full"
                    >
                      🗑️ Clear
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Dynamic Displays */}
            {host.displays.map((displayId) => {
              const displayStatus = getDisplayStatus(displayId);
              return (
                <div key={displayId}>
                  <div className="h-full flex flex-col border border-gray-200 rounded-lg p-3 bg-white">
                    <div className="text-sm font-medium text-gray-900 mb-1">
                      {displayId.replace('display-', 'Display ')}
                    </div>
                    <div className={`text-xs mb-2 flex items-center ${displayStatus.color}`}>
                      <BarChart3 className="w-3 h-3 mr-1" />
                      {displayStatus.text}
                    </div>
                    {displayStatus.dashboard && (
                      <div className="text-xs text-gray-600 mb-2">
                        Active 2min ago
                      </div>
                    )}
                    <div className="mt-auto">
                      {displayStatus.status === 'active' ? (
                        <div className="space-y-1">
                          <button
                            onClick={() => handleRefreshDisplay(displayId)}
                            className="w-full text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 rounded flex items-center justify-center"
                            disabled={refreshStatus[`${host.id}-${displayId}`] === 'refreshing'}
                          >
                            <RefreshCw className="w-3 h-3 mr-1" />
                            {refreshStatus[`${host.id}-${displayId}`] === 'refreshing' ? 'Refreshing...' : 'Refresh'}
                          </button>
                          <button className="w-full text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 rounded flex items-center justify-center">
                            <Settings className="w-3 h-3 mr-1" />
                            Config
                          </button>
                        </div>
                      ) : (
                        <div className="relative">
                          <button
                            onClick={() => setDeployDropdownOpen(deployDropdownOpen === displayId ? null : displayId)}
                            className="w-full text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 rounded flex items-center justify-center"
                          >
                            <BarChart3 className="w-3 h-3 mr-1" />
                            Deploy Dashboard
                            <ChevronDown className="w-3 h-3 ml-1" />
                          </button>
                          {deployDropdownOpen === displayId && (
                            <div className="absolute top-full left-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-50 w-full max-h-48 overflow-y-auto">
                              {dashboardsLoading ? (
                                <div className="px-3 py-2 text-sm text-gray-700 flex items-center">
                                  <Loader className="w-3 h-3 mr-2 animate-spin" />
                                  Loading dashboards...
                                </div>
                              ) : dashboardsError ? (
                                <div className="px-3 py-2 text-sm text-red-700 bg-red-50">
                                  Error loading dashboards
                                </div>
                              ) : dashboards.length === 0 ? (
                                <div className="px-3 py-2 text-sm text-gray-700">
                                  No dashboards available
                                </div>
                              ) : (
                                dashboards.map((dashboard) => (
                                  <button
                                    key={dashboard.id}
                                    onClick={() => handleDeployDashboard(dashboard.id, displayId)}
                                    className="block w-full text-left px-3 py-2 text-sm text-gray-900 hover:bg-blue-50 hover:text-blue-900 transition-colors border-b border-gray-100 last:border-b-0"
                                  >
                                    <span className="truncate">{dashboard.name}</span>
                                  </button>
                                ))
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

          </div>
        </div>

        {/* Mobile Layout */}
        <div className="lg:hidden space-y-4">
          {/* Host Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="relative">
                <Monitor className="w-6 h-6 text-primary-600 mr-3" />
                <div className={`absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-white ${
                  host.metrics.online 
                    ? host.metrics.lastError ? 'bg-yellow-500' : 'bg-green-500'
                    : 'bg-red-500'
                }`}></div>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">{host.hostname}</h3>
                <p className="text-sm text-gray-500">{host.ipAddress}</p>
              </div>
            </div>
          </div>

          {/* System Metrics */}
          <div className="text-sm text-gray-600">
            CPU: {host.metrics.cpuUsage.toFixed(0)}% • RAM: {host.metrics.memoryUsage.toFixed(0)}% • {host.metrics.browserProcesses} processes
          </div>

          {/* Displays */}
          <div className="space-y-3">
            {host.displays.map((displayId) => (
              <div key={displayId} className="border border-gray-200 rounded-lg p-3 bg-white">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center">
                    <div className="font-medium text-gray-900">
                      {displayId.replace('display-', 'Display ')}
                    </div>
                    <div className={`ml-2 text-sm flex items-center ${getDisplayStatus(displayId).color}`}>
                      <BarChart3 className="w-3 h-3 mr-1" />
                      {getDisplayStatus(displayId).text}
                    </div>
                  </div>
                </div>
                
                {getDisplayStatus(displayId).dashboard && (
                  <div className="text-sm text-gray-600 mb-2">
                    {getDisplayStatus(displayId).dashboard} • Active 2min ago
                  </div>
                )}
                
                <div className="space-y-2">
                  {getDisplayStatus(displayId).status === 'active' ? (
                    <>
                      <button
                        onClick={() => handleRefreshDisplay(displayId)}
                        className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded text-sm flex items-center justify-center"
                        disabled={refreshStatus[`${host.id}-${displayId}`] === 'refreshing'}
                      >
                        <RefreshCw className="w-4 h-4 mr-2" />
                        {refreshStatus[`${host.id}-${displayId}`] === 'refreshing' ? 'Refreshing...' : 'Refresh'}
                      </button>
                      <button className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded text-sm flex items-center justify-center">
                        <Settings className="w-4 h-4 mr-2" />
                        Config
                      </button>
                    </>
                  ) : (
                    <div className="relative">
                      <button
                        onClick={() => setDeployDropdownOpen(deployDropdownOpen === displayId ? null : displayId)}
                        className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded text-sm flex items-center justify-center"
                      >
                        <BarChart3 className="w-4 h-4 mr-2" />
                        Deploy Dashboard 
                        <ChevronDown className="w-4 h-4 ml-2" />
                      </button>
                      {deployDropdownOpen === displayId && (
                        <div className="absolute top-full left-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-50 w-full max-h-48 overflow-y-auto">
                          {dashboardsLoading ? (
                            <div className="px-3 py-2 text-sm text-gray-700 flex items-center">
                              <Loader className="w-4 h-4 mr-2 animate-spin" />
                              Loading dashboards...
                            </div>
                          ) : dashboardsError ? (
                            <div className="px-3 py-2 text-sm text-red-700 bg-red-50">
                              Error loading dashboards
                            </div>
                          ) : dashboards.length === 0 ? (
                            <div className="px-3 py-2 text-sm text-gray-700">
                              No dashboards available
                            </div>
                          ) : (
                            dashboards.map((dashboard) => (
                              <button
                                key={dashboard.id}
                                onClick={() => handleDeployDashboard(dashboard.id, displayId)}
                                className="block w-full text-left px-3 py-2 text-sm text-gray-900 hover:bg-blue-50 hover:text-blue-900 transition-colors border-b border-gray-100 last:border-b-0"
                              >
                                <span className="truncate">{dashboard.name}</span>
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="pt-3 border-t">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium text-gray-700">Actions</h4>
              <div className="flex items-center space-x-1">
                <Clock className="w-3 h-3 text-gray-400" />
                <span className="text-xs text-gray-500">
                  {formatLastSeen(host.lastHeartbeat)}
                </span>
              </div>
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={handleIdentifyDisplays}
                disabled={identifyingDisplays}
                className={`flex-1 px-3 py-2 rounded text-sm transition-colors flex items-center justify-center ${
                  identifyingDisplays 
                    ? 'bg-blue-200 text-blue-800 animate-pulse' 
                    : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                }`}
              >
                <Search className="w-4 h-4 mr-2" />
                Identify Displays
              </button>
              
              <button
                onClick={() => onToggleDebug?.(host.id)}
                className={`flex-1 px-3 py-2 rounded text-sm transition-colors flex items-center justify-center ${
                  host.debugEnabled 
                    ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                title={`Debug ${host.debugEnabled ? 'Enabled' : 'Disabled'}`}
              >
                <Bug className="w-4 h-4 mr-2" />
                Debug
              </button>
              
              <button
                onClick={() => onDownloadDebugEvents?.(host.id)}
                disabled={!host.debugEnabled}
                className="bg-blue-100 text-blue-700 hover:bg-blue-200 disabled:bg-gray-200 disabled:text-gray-500 px-3 py-1 rounded text-sm"
              >
                📥 Export Logs
              </button>
              
              <button
                onClick={() => onClearDebugEvents?.(host.id)}
                disabled={!host.debugEnabled}
                className="bg-orange-100 text-orange-700 hover:bg-orange-200 disabled:bg-gray-200 disabled:text-gray-500 px-3 py-1 rounded text-sm"
              >
                🗑️ Clear Logs
              </button>
            </div>
          </div>
        </div>

        {/* Error Display */}
        {host.metrics.lastError && (
          <div className="mt-4 p-3 bg-red-50 rounded border border-red-200">
            <div className="flex items-start">
              <AlertCircle className="w-4 h-4 text-red-500 mr-2 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-red-700">
                {host.metrics.lastError}
              </div>
            </div>
          </div>
        )}

      </div>
    </>
  );
};