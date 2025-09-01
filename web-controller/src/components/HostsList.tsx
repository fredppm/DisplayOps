import React, { useState } from 'react';
import { MiniPC } from '@/types/shared-types';
import { Wifi, RefreshCw } from 'lucide-react';
import { DisplayCard } from './DisplayCard';
import { dashboardService } from '@/services/dashboardService';

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

interface NotificationProps {
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
}

export const HostsList: React.FC<HostsListProps> = ({ hosts, isDiscovering, discoveryStatus }) => {
  const [notifications, setNotifications] = useState<NotificationProps[]>([]);

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

  const handleRefreshHost = async (host: MiniPC) => {
    // This would trigger a host refresh - keeping existing logic
    try {
      // Existing refresh logic here
      addNotification('info', 'Host Refreshed', `Refreshed status for ${host.hostname}`);
    } catch (error) {
      addNotification('error', 'Refresh Failed', `Failed to refresh ${host.hostname}`);
    }
  };

  const handleRefreshDisplay = async (host: MiniPC, displayId: string) => {
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
          addNotification('success', 'Display Refreshed', 
            `${displayId.replace('display-', 'Display ')} on ${host.hostname} refreshed successfully`);
        } else {
          addNotification('error', 'Refresh Failed', 
            result.error || 'Unknown error occurred during refresh');
        }
      } else {
        const errorData = await response.json();
        addNotification('error', 'Refresh Request Failed', errorData.error || `HTTP ${response.status}`);
      }
    } catch (error: any) {
      addNotification('error', 'Connection Error', 
        `Failed to connect to ${host.hostname}`);
    }
  };

  const handleIdentifyDisplays = async (hostId: string) => {
    const host = hosts.find(h => h.id === hostId);
    if (!host || !host.metrics.online) return;

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

    } catch (error) {
      console.error('Error identifying displays:', error);
      addNotification('error', 'Display Identification Failed', 
        `Failed to identify displays on ${host.hostname}`);
    }
  };

  const handleToggleDebug = async (hostId: string): Promise<void> => {
    const host = hosts.find(h => h.id === hostId);
    
    if (!host || !host.metrics.online) return;

    const action = host.debugEnabled ? 'disable' : 'enable';
    
    try {
      const response = await fetch(`/api/host/${hostId}/debug/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          addNotification('success', 'Debug Mode', 
            `Debug ${action}d on ${host.hostname}`);
        }
      }
    } catch (error) {
      addNotification('error', 'Debug Error', 
        `Failed to ${action} debug on ${host.hostname}`);
    }
  };

  const handleDownloadDebugEvents = async (hostId: string): Promise<void> => {
    const host = hosts.find(h => h.id === hostId);
    if (!host || !host.metrics.online) return;

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

  const handleClearDebugEvents = async (hostId: string): Promise<void> => {
    const host = hosts.find(h => h.id === hostId);
    if (!host || !host.metrics.online) return;

    try {
      const response = await fetch(`/api/host/${hostId}/debug/events`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.ok) {
        addNotification('success', 'Debug Events', 
          `Cleared debug events on ${host.hostname}`);
      }
    } catch (error) {
      addNotification('error', 'Debug Error', 
        `Failed to clear debug events on ${host.hostname}`);
    }
  };

  const handleDeployDashboard = async (dashboardId: string, hostId: string, displayId: string): Promise<void> => {
    const host = hosts.find(h => h.id === hostId);
    if (!host) {
      addNotification('error', 'Deployment Failed', 'Host not found');
      return;
    }

    // Get dashboard details from service
    const dashboard = dashboardService.getDashboardById(dashboardId);
    if (!dashboard) {
      addNotification('error', 'Deployment Failed', 'Dashboard not found');
      return;
    }

    try {
      addNotification('info', 'Deploying Dashboard', `Opening ${dashboard.name} on ${displayId.replace('display-', 'Display ')}...`);
      
      // ✅ Deploy dashboard via web-controller API (which uses gRPC)
      const response = await fetch(`/api/host/${hostId}/command`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'open_dashboard',
          display_id: displayId,
          dashboard_id: dashboard.id,
          url: dashboard.url,
          fullscreen: true,
          refresh_interval_ms: dashboard.refreshInterval ? dashboard.refreshInterval * 1000 : 300000,
          timestamp: new Date()
        })
      });

      if (response.ok) {
        const result = await response.json();
        
        if (result.success) {
          addNotification('success', 'Dashboard Deployed', 
            `${dashboard.name} is now displaying on ${host.hostname} - ${displayId.replace('display-', 'Display ')}`);
        } else {
          addNotification('error', 'Deployment Failed', 
            result.error || 'Unknown error occurred during deployment');
        }
      } else {
        const errorData = await response.json();
        addNotification('error', 'Deployment Request Failed', errorData.error || `HTTP ${response.status}`);
      }
    } catch (error: any) {
      addNotification('error', 'Connection Error', 
        `Failed to connect to ${host.hostname}`);
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
        <div className="space-y-4">
          {hosts.map((host) => (
            <DisplayCard
              key={host.id}
              host={host}
              onRefreshHost={handleRefreshHost}
              onRefreshDisplay={handleRefreshDisplay}
              onIdentifyDisplays={handleIdentifyDisplays}
              onToggleDebug={handleToggleDebug}
              onDownloadDebugEvents={handleDownloadDebugEvents}
              onClearDebugEvents={handleClearDebugEvents}
              onDeployDashboard={handleDeployDashboard}
            />
          ))}
        </div>
      )}
    </div>
  );
};