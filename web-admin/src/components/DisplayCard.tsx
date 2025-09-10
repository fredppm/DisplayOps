import React, { useState, useEffect } from 'react';
import { MiniPC, Dashboard, DisplayState } from '@/types/shared-types';
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
  Loader,
  LayoutDashboard,
  Settings,
  Clock,
  ArrowRightLeft,
  Edit3
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useNotifications } from '@/contexts/NotificationContext';

interface DisplayCardProps {
  host: MiniPC;
  onRefreshHost?: (host: MiniPC) => void;
  onRefreshDisplay?: (host: MiniPC, displayId: string) => void;
  onIdentifyDisplays?: (hostId: string) => void;
  onToggleDebug?: (hostId: string) => Promise<void>;
  onDownloadDebugEvents?: (hostId: string) => Promise<void>;
  onClearDebugEvents?: (hostId: string) => Promise<void>;
  onDeployDashboard?: (dashboardId: string, hostId: string, displayId: string) => Promise<void>;
  onRemoveDashboard?: (hostId: string, displayId: string) => Promise<void>;
  onOpenDashboardModal?: (hostId: string, displayId: string) => void;
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
  onClearDebugEvents,
  onDeployDashboard,
  onRemoveDashboard,
  onOpenDashboardModal
}) => {
  const [showDebugControls, setShowDebugControls] = useState(false);
  const [identifyingDisplays, setIdentifyingDisplays] = useState(false);
  const [activeDisplays, setActiveDisplays] = useState<ActiveDisplay[]>([]);
  const { addNotification } = useNotifications();
  const [refreshStatus, setRefreshStatus] = useState<RefreshStatus>({});

  const [debugToggling, setDebugToggling] = useState(false);
  const [removingDashboard, setRemovingDashboard] = useState<string | null>(null);



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
        // HostsList já trata as notificações, não duplicar aqui
      }
    } catch (error) {
      setRefreshStatus(prev => ({ ...prev, [statusKey]: 'error' }));
      // HostsList já trata os erros, não duplicar aqui
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
        // HostsList já trata as notificações, não duplicar aqui
        setTimeout(() => setIdentifyingDisplays(false), 5000);
      } catch (error) {
        // HostsList já trata os erros, apenas resetar estado local
        setIdentifyingDisplays(false);
      }
    }
  };

  const handleToggleDebug = async () => {
    if (onToggleDebug) {
      setDebugToggling(true);
      try {
        await onToggleDebug(host.id);
        // HostsList já trata as notificações, não duplicar aqui
      } catch (error) {
        // HostsList já trata os erros, apenas resetar estado local
      } finally {
        setDebugToggling(false);
      }
    }
  };


  const handleRemoveDashboard = async (displayId: string) => {
    if (!onRemoveDashboard) return;

    setRemovingDashboard(displayId);

    try {
      await onRemoveDashboard(host.id, displayId);
      
      // Keep loading state for a bit to show success
      setTimeout(() => {
        setRemovingDashboard(null);
      }, 2000);
      
    } catch (error) {
      console.error('Dashboard removal failed:', error);
      // Immediately reset loading state on error
      setRemovingDashboard(null);
      addNotification('error', 'Removal Failed', 
        error instanceof Error ? error.message : 'Failed to remove dashboard');
    }
  };


  const getDisplayStatus = (displayId: string) => {
    const display = activeDisplays.find(d => d.displayId === displayId);
    
    // 🔍 NEW: Check display states from gRPC heartbeat first
    const displayState = host.displayStates?.find(ds => ds.id === displayId);
    
    if (displayState) {
      if (displayState.assignedDashboard) {
        // Use dashboard ID as display text since we don't have dashboard names in this component
        const displayText = displayState.assignedDashboard.dashboardId;
        
        return {
          status: 'active',
          text: displayText,
          color: displayState.isActive ? 'text-green-600' : 'text-yellow-600',
          dashboard: displayState.assignedDashboard.dashboardId,
          url: displayState.assignedDashboard.url
        };
      } else if (displayState.isActive) {
        return {
          status: 'active',
          text: 'Active (No Dashboard)',
          color: 'text-yellow-600'
        };
      } else {
        return {
          status: 'empty',
          text: 'Inactive',
          color: 'text-gray-500'
        };
      }
    }
    
    // Fallback to legacy mDNS TXT record method
    if (!display) return { status: 'unknown', text: 'Unknown', color: 'text-gray-500' };
    
    const displayDashboards = host.mdnsService?.txtRecord?.displayDashboards;
    
    let activeDashboardId: string | null = null;
    if (displayDashboards) {
      // Parse displayDashboards format: "display-1:dashboard-1,display-2:dashboard-2"
      const dashboardMap = displayDashboards.split(',').reduce((acc, entry) => {
        const [dId, dashId] = entry.split(':');
        if (dId && dashId) {
          acc[dId] = dashId;
        }
        return acc;
      }, {} as Record<string, string>);
      
      activeDashboardId = dashboardMap[displayId] || null;
    }
    
    if (display.hasWindow || activeDashboardId) {
      // Use dashboard ID as display text for fallback method too
      const displayText = activeDashboardId || 'Active';
      
      return {
        status: 'active',
        text: displayText,
        color: 'text-green-600',
        dashboard: activeDashboardId
      };
    }
    
    return { status: 'empty', text: 'No Content', color: 'text-gray-500' };
  };

  useEffect(() => {
    if (host.metrics.online) {
      checkActiveDisplays();
    }
  }, [host.metrics.online]);


  return (
    <>
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
                    disabled={identifyingDisplays || !host.metrics.online}
                    className={`flex-1 text-xs px-3 py-2 rounded transition-colors flex items-center justify-center ${
                      identifyingDisplays 
                        ? 'bg-blue-200 text-blue-800 animate-pulse cursor-not-allowed' 
                        : !host.metrics.online
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                    }`}
                    title={identifyingDisplays ? 'Identifying...' : !host.metrics.online ? 'Host offline' : 'Identify Displays'}
                  >
                    {identifyingDisplays ? (
                      <>
                        <Loader className="w-3 h-3 mr-1 animate-spin" />
                        Identifying...
                      </>
                    ) : (
                      <>
                        <Search className="w-3 h-3 mr-1" />
                        Identify
                      </>
                    )}
                  </button>
                  
                  <button
                    onClick={handleToggleDebug}
                    disabled={debugToggling || !host.metrics.online}
                    className={`flex-1 text-xs px-3 py-2 rounded transition-colors flex items-center justify-center ${
                      debugToggling 
                        ? 'bg-blue-200 text-blue-800 animate-pulse cursor-not-allowed' 
                        : !host.metrics.online
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          : host.debugEnabled 
                            ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                    title={debugToggling ? 'Toggling...' : !host.metrics.online ? 'Host offline' : host.debugEnabled ? 'Disable Debug' : 'Enable Debug'}
                  >
                    {debugToggling ? (
                      <>
                        <Loader className="w-3 h-3 mr-1 animate-spin" />
                        Toggling...
                      </>
                    ) : (
                      <>
                        <Bug className="w-3 h-3 mr-1" />
                        Debug
                      </>
                    )}
                  </button>
                </div>

                {host.debugEnabled && (
                  <div className="space-y-2 pt-2 border-t">
                    <h5 className="text-xs font-medium text-gray-700 uppercase tracking-wide">
                      Debug Logs
                    </h5>
                    <div className="flex gap-1">
                      <button
                        onClick={() => onDownloadDebugEvents?.(host.id)}
                        disabled={!host.metrics.online}
                        className={`flex-1 text-xs px-2 py-1 rounded flex items-center justify-center ${
                          !host.metrics.online
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                        }`}
                        title={!host.metrics.online ? 'Host offline' : 'Export debug logs'}
                      >
                        <Download className="w-3 h-3 mr-1" />
                        Export
                      </button>
                      
                      <button
                        onClick={() => onClearDebugEvents?.(host.id)}
                        disabled={!host.metrics.online}
                        className={`flex-1 text-xs px-2 py-1 rounded flex items-center justify-center ${
                          !host.metrics.online
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            : 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                        }`}
                        title={!host.metrics.online ? 'Host offline' : 'Clear debug logs'}
                      >
                        <Trash2 className="w-3 h-3 mr-1" />
                        Clear
                      </button>
                    </div>
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
                    <div className="text-sm font-medium text-gray-900 mb-1 text-center">
                      {displayId.replace('display-', 'Display ')}
                    </div>
                    <div className={`text-xs mb-2 ${displayStatus.color} text-center`}>
                      {displayStatus.text}
                    </div>
                    <div className="mt-auto">
                      {displayStatus.status === 'active' ? (
                        <div className="space-y-1">
                          <button
                            onClick={() => handleRefreshDisplay(displayId)}
                            className={`w-full text-xs py-2 rounded flex items-center justify-center ${
                              !host.metrics.online
                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                            }`}
                            disabled={refreshStatus[`${host.id}-${displayId}`] === 'refreshing' || !host.metrics.online}
                            title={!host.metrics.online ? 'Host offline' : 'Refresh display'}
                          >
                            <RefreshCw className="w-3 h-3 mr-1" />
                            {refreshStatus[`${host.id}-${displayId}`] === 'refreshing' ? 'Refreshing...' : 'Refresh'}
                          </button>
                          <div className="flex gap-1">
                            <button
                              onClick={() => onOpenDashboardModal?.(host.id, displayId)}
                              disabled={!host.metrics.online}
                              className={`flex-1 text-xs py-2 rounded flex items-center justify-center transition-colors ${
                                !host.metrics.online
                                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                  : 'bg-blue-100 hover:bg-blue-200 text-blue-700'
                              }`}
                              title={!host.metrics.online ? 'Host offline' : 'Change dashboard'}
                            >
                              <ArrowRightLeft className="w-3 h-3 mr-1" />
                              Change
                            </button>
                            <button
                              onClick={() => handleRemoveDashboard(displayId)}
                              disabled={removingDashboard === displayId || !host.metrics.online}
                              className={`flex-1 text-xs py-2 rounded flex items-center justify-center transition-colors ${
                                removingDashboard === displayId 
                                  ? 'bg-red-100 text-red-700 cursor-not-allowed'
                                  : !host.metrics.online
                                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                    : 'bg-red-100 hover:bg-red-200 text-red-700'
                              }`}
                              title={!host.metrics.online ? 'Host offline' : 'Remove dashboard'}
                            >
                              {removingDashboard === displayId ? (
                                <Loader className="w-3 h-3 animate-spin" />
                              ) : (
                                <>
                                  <Trash2 className="w-3 h-3 mr-1" />
                                  Remove
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => onOpenDashboardModal?.(host.id, displayId)}
                          disabled={!host.metrics.online}
                          className={`w-full text-xs py-2 rounded flex items-center justify-center transition-colors ${
                            !host.metrics.online
                              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                              : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                          }`}
                          title={!host.metrics.online ? 'Host offline' : 'Deploy dashboard'}
                        >
                          <LayoutDashboard className="w-3 h-3 mr-1" />
                          Deploy Dashboard
                        </button>
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
                      <LayoutDashboard className="w-3 h-3 mr-1" />
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
                        className={`w-full px-3 py-2 rounded text-sm flex items-center justify-center ${
                          !host.metrics.online
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                        }`}
                        disabled={refreshStatus[`${host.id}-${displayId}`] === 'refreshing' || !host.metrics.online}
                        title={!host.metrics.online ? 'Host offline' : 'Refresh display'}
                      >
                        <RefreshCw className="w-4 h-4 mr-2" />
                        {refreshStatus[`${host.id}-${displayId}`] === 'refreshing' ? 'Refreshing...' : 'Refresh'}
                      </button>
                      <div className="flex gap-2">
                        <button
                          onClick={() => onOpenDashboardModal?.(host.id, displayId)}
                          disabled={!host.metrics.online}
                          className={`flex-1 px-3 py-2 rounded text-sm flex items-center justify-center transition-colors ${
                            !host.metrics.online
                              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                              : 'bg-blue-100 hover:bg-blue-200 text-blue-700'
                          }`}
                          title={!host.metrics.online ? 'Host offline' : 'Change dashboard'}
                        >
                          <ArrowRightLeft className="w-4 h-4 mr-2" />
                          Change Dashboard
                        </button>
                        <button
                          onClick={() => handleRemoveDashboard(displayId)}
                          disabled={removingDashboard === displayId || !host.metrics.online}
                          className={`px-3 py-2 rounded text-sm flex items-center justify-center transition-colors ${
                            removingDashboard === displayId 
                              ? 'bg-red-100 text-red-700 cursor-not-allowed'
                              : !host.metrics.online
                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                : 'bg-red-100 hover:bg-red-200 text-red-700'
                          }`}
                          title={!host.metrics.online ? 'Host offline' : 'Remove dashboard'}
                        >
                          {removingDashboard === displayId ? (
                            <Loader className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </>
                  ) : (
                    <button
                      onClick={() => onOpenDashboardModal?.(host.id, displayId)}
                      disabled={!host.metrics.online}
                      className={`w-full px-3 py-2 rounded text-sm flex items-center justify-center transition-colors ${
                        !host.metrics.online
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                      }`}
                      title={!host.metrics.online ? 'Host offline' : 'Deploy dashboard'}
                    >
                      <LayoutDashboard className="w-4 h-4 mr-2" />
                      Deploy Dashboard
                    </button>
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
                disabled={identifyingDisplays || !host.metrics.online}
                className={`flex-1 px-3 py-2 rounded text-sm transition-colors flex items-center justify-center ${
                  identifyingDisplays 
                    ? 'bg-blue-200 text-blue-800 animate-pulse cursor-not-allowed' 
                    : !host.metrics.online
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                }`}
                title={identifyingDisplays ? 'Identifying...' : !host.metrics.online ? 'Host offline' : 'Identify displays'}
              >
                {identifyingDisplays ? (
                  <>
                    <Loader className="w-4 h-4 mr-2 animate-spin" />
                    Identifying...
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4 mr-2" />
                    Identify Displays
                  </>
                )}
              </button>
              
              <button
                onClick={handleToggleDebug}
                disabled={debugToggling || !host.metrics.online}
                className={`flex-1 px-3 py-2 rounded text-sm transition-colors flex items-center justify-center ${
                  debugToggling 
                    ? 'bg-blue-200 text-blue-800 animate-pulse cursor-not-allowed' 
                    : !host.metrics.online
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : host.debugEnabled 
                        ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                title={debugToggling ? 'Toggling...' : !host.metrics.online ? 'Host offline' : host.debugEnabled ? 'Disable Debug' : 'Enable Debug'}
              >
                {debugToggling ? (
                  <>
                    <Loader className="w-4 h-4 mr-2 animate-spin" />
                    Toggling...
                  </>
                ) : (
                  <>
                    <Bug className="w-4 h-4 mr-2" />
                    Debug
                  </>
                )}
              </button>
              
            </div>
            
            {host.debugEnabled && (
              <div className="pt-3 border-t">
                <h4 className="text-sm font-medium text-gray-700 mb-3">Debug Logs</h4>
                <div className="flex gap-2">
                  <button
                    onClick={() => onDownloadDebugEvents?.(host.id)}
                    disabled={!host.metrics.online}
                    className={`flex-1 px-3 py-2 rounded text-sm flex items-center justify-center ${
                      !host.metrics.online
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                    }`}
                    title={!host.metrics.online ? 'Host offline' : 'Export debug logs'}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Export
                  </button>
                  
                  <button
                    onClick={() => onClearDebugEvents?.(host.id)}
                    disabled={!host.metrics.online}
                    className={`flex-1 px-3 py-2 rounded text-sm flex items-center justify-center ${
                      !host.metrics.online
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                    }`}
                    title={!host.metrics.online ? 'Host offline' : 'Clear debug logs'}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Clear
                  </button>
                </div>
              </div>
            )}
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