import React, { useState } from 'react';
import { MiniPC } from '@/types/shared-types';

interface DisplayRefreshControllerProps {
  hosts: MiniPC[];
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

export const DisplayRefreshController: React.FC<DisplayRefreshControllerProps> = ({ hosts }) => {
  const [refreshStatus, setRefreshStatus] = useState<RefreshStatus>({});
  const [notifications, setNotifications] = useState<NotificationProps[]>([]);
  const [activeDisplays, setActiveDisplays] = useState<{[hostId: string]: ActiveDisplay[]}>({});

  const addNotification = (type: NotificationProps['type'], title: string, message: string) => {
    const notification = { type, title, message };
    setNotifications(prev => [...prev, notification]);
    
    // Auto-remove notification after 5 seconds
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n !== notification));
    }, 5000);
  };

  const removeNotification = (notification: NotificationProps) => {
    setNotifications(prev => prev.filter(n => n !== notification));
  };

  // Check which displays have active windows
  const checkActiveDisplays = async (host: MiniPC) => {
    try {
      const response = await fetch(`/api/host/${host.id}/windows`);
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          const windows = result.data;
          const displays: ActiveDisplay[] = [];
          
          // Check each potential display
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
      console.error(`Error checking active displays for ${host.name}:`, error);
      // Set all displays as inactive on error
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

  // Check active displays for all hosts on component mount and when hosts change
  React.useEffect(() => {
    hosts.forEach(host => {
      if (host.status.online) {
        checkActiveDisplays(host);
      }
    });
  }, [hosts]);

  const refreshDisplay = async (host: MiniPC, displayId: string) => {
    const statusKey = `${host.id}-${displayId}`;
    
    setRefreshStatus(prev => ({ ...prev, [statusKey]: 'refreshing' }));
    
    try {
      addNotification('info', 'Refreshing Display', 
        `Refreshing ${displayId.replace('display-', 'Display ')} on ${host.name || host.hostname}...`);

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
        
        if (result.success || result.data) {
          setRefreshStatus(prev => ({ ...prev, [statusKey]: 'success' }));
          addNotification('success', 'Display Refreshed', 
            `${displayId.replace('display-', 'Display ')} on ${host.name || host.hostname} has been refreshed successfully`);
        } else {
          setRefreshStatus(prev => ({ ...prev, [statusKey]: 'error' }));
          addNotification('error', 'Refresh Failed', 
            result.error || 'Unknown error occurred during refresh');
        }
      } else {
        setRefreshStatus(prev => ({ ...prev, [statusKey]: 'error' }));
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        try {
          const errorData = await response.json();
          if (errorData.error) {
            errorMessage = errorData.error;
          }
        } catch {
          // Ignore JSON parsing errors
        }
        
        addNotification('error', 'Refresh Request Failed', errorMessage);
      }
    } catch (error: any) {
      setRefreshStatus(prev => ({ ...prev, [statusKey]: 'error' }));
      const errorMessage = error instanceof Error ? error.message : 'Connection failed';
      addNotification('error', 'Connection Error', 
        `Failed to connect to ${host.name || host.hostname}: ${errorMessage}`);
    }

    // Reset status after 3 seconds
    setTimeout(() => {
      setRefreshStatus(prev => ({ ...prev, [statusKey]: 'idle' }));
    }, 3000);
  };

  const refreshAllDisplaysOnHost = async (host: MiniPC) => {
    const hostDisplays = activeDisplays[host.id] || [];
    const activeDisplayIds = hostDisplays.filter(d => d.hasWindow).map(d => d.displayId);
    
    if (activeDisplayIds.length === 0) {
      addNotification('warning', 'No Active Displays', 
        `No active displays found on ${host.name || host.hostname}. Deploy dashboards first.`);
      return;
    }
    
    addNotification('info', 'Refreshing Active Displays', 
      `Refreshing ${activeDisplayIds.length} active displays on ${host.name || host.hostname}...`);

    const refreshPromises = activeDisplayIds.map(displayId => refreshDisplay(host, displayId));
    await Promise.all(refreshPromises);
  };

  const refreshAllDisplaysAllHosts = async () => {
    if (hosts.length === 0) {
      addNotification('warning', 'No Hosts Available', 'No hosts discovered. Make sure host-agents are running.');
      return;
    }

    addNotification('info', 'Refreshing All Displays', 
      `Refreshing all displays on ${hosts.length} hosts...`);

    const hostPromises = hosts.map(host => refreshAllDisplaysOnHost(host));
    await Promise.all(hostPromises);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'refreshing': return '🔄';
      case 'success': return '✅';
      case 'error': return '❌';
      default: return '🔄';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'refreshing': return 'text-blue-600';
      case 'success': return 'text-green-600';
      case 'error': return 'text-red-600';
      default: return 'text-gray-600';
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
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Display Refresh Controller</h2>
            <p className="text-gray-600">Refresh individual displays or all displays at once</p>
          </div>
          <button
            onClick={refreshAllDisplaysAllHosts}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
          >
            🔄 Refresh All Displays
          </button>
        </div>

        {hosts.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p className="text-lg">No hosts discovered</p>
            <p className="text-sm">Make sure host-agents are running and discoverable</p>
          </div>
        ) : (
          <div className="text-sm text-gray-600">
            {(() => {
              const totalActiveDisplays = Object.values(activeDisplays)
                .flat()
                .filter(d => d.hasWindow).length;
              const totalDisplays = hosts.length * 3;
              
              return `Found ${hosts.length} host${hosts.length !== 1 ? 's' : ''} with ${totalActiveDisplays}/${totalDisplays} active displays`;
            })()}
          </div>
        )}
      </div>

      {/* Hosts and Displays */}
      <div className="space-y-4">
        {hosts.map((host) => (
          <div key={host.id} className="bg-white rounded-lg shadow-sm border">
            <div className="p-4 border-b bg-gray-50">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {host.name || host.hostname}
                  </h3>
                  <p className="text-sm text-gray-600">
                    {host.ipAddress}:{host.port} • 
                    <span className={`ml-1 ${host.status.online ? 'text-green-600' : 'text-red-600'}`}>
                      {host.status.online ? 'Online' : 'Offline'}
                    </span>
                  </p>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => checkActiveDisplays(host)}
                    disabled={!host.status.online}
                    className="bg-gray-500 hover:bg-gray-600 disabled:bg-gray-300 text-white px-3 py-2 rounded font-medium transition-colors text-sm"
                  >
                    🔍 Check
                  </button>
                  <button
                    onClick={() => refreshAllDisplaysOnHost(host)}
                    disabled={!host.status.online}
                    className="bg-gray-600 hover:bg-gray-700 disabled:bg-gray-300 text-white px-4 py-2 rounded font-medium transition-colors"
                  >
                    🔄 Refresh All
                  </button>
                </div>
              </div>
            </div>

            <div className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {['display-1', 'display-2', 'display-3'].map((displayId) => {
                  const statusKey = `${host.id}-${displayId}`;
                  const status = refreshStatus[statusKey] || 'idle';
                  const hostDisplays = activeDisplays[host.id] || [];
                  const displayInfo = hostDisplays.find(d => d.displayId === displayId);
                  const hasWindow = displayInfo?.hasWindow || false;
                  
                  return (
                    <div
                      key={displayId}
                      className={`border rounded-lg p-4 transition-colors ${
                        hasWindow 
                          ? 'hover:bg-gray-50 border-green-200 bg-green-50' 
                          : 'border-gray-200 bg-gray-50'
                      }`}
                    >
                      <div className="flex justify-between items-center mb-3">
                        <div>
                          <h4 className="font-medium text-gray-900">
                            {displayId.replace('display-', 'Display ')}
                          </h4>
                          <p className={`text-xs ${hasWindow ? 'text-green-600' : 'text-gray-500'}`}>
                            {hasWindow ? '🟢 Active Dashboard' : '⚪ No Dashboard'}
                          </p>
                        </div>
                        <span className={`text-lg ${getStatusColor(status)}`}>
                          {getStatusIcon(status)}
                        </span>
                      </div>
                      
                      <button
                        onClick={() => refreshDisplay(host, displayId)}
                        disabled={!host.status.online || status === 'refreshing' || !hasWindow}
                        className={`w-full py-2 px-4 rounded font-medium transition-colors ${
                          hasWindow 
                            ? 'bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white'
                            : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        }`}
                      >
                        {status === 'refreshing' ? 'Refreshing...' : 
                         hasWindow ? '🔄 Refresh' : '⚪ No Dashboard'}
                      </button>
                      
                      {status !== 'idle' && (
                        <p className={`text-xs mt-2 ${getStatusColor(status)}`}>
                          {status === 'refreshing' && 'Refreshing display...'}
                          {status === 'success' && 'Refreshed successfully'}
                          {status === 'error' && 'Refresh failed'}
                        </p>
                      )}
                      
                      {!hasWindow && (
                        <p className="text-xs mt-2 text-gray-500">
                          Deploy a dashboard to enable refresh
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
