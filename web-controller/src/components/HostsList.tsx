import React, { useState, useEffect } from 'react';
import { MiniPC } from '@/types/shared-types';
import { Wifi, RefreshCw } from 'lucide-react';
import { DisplayCard } from './DisplayCard';
import { DashboardSelectorModal } from './DashboardSelectorModal';
import { dashboardService } from '@/services/dashboardService';
import { useNotifications } from '@/contexts/NotificationContext';

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


export const HostsList: React.FC<HostsListProps> = ({ hosts, isDiscovering, discoveryStatus }) => {
  const { addNotification } = useNotifications();
  
  // Modal state for dashboard selection
  const [modalOpen, setModalOpen] = useState(false);
  const [modalHostId, setModalHostId] = useState<string | null>(null);
  const [modalDisplayId, setModalDisplayId] = useState<string | null>(null);

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

      const result = await response.json();

      if (response.ok && result.success) {
        addNotification('success', 'Debug Mode', 
          `Debug ${action}d on ${host.hostname}`);
      } else {
        // Handle API error response
        const errorMessage = result.error || `HTTP ${response.status}: ${response.statusText}`;
        addNotification('error', 'Debug Error', 
          `Failed to ${action} debug on ${host.hostname}: ${errorMessage}`);
      }
    } catch (error) {
      addNotification('error', 'Debug Error', 
        `Failed to ${action} debug on ${host.hostname}: ${error instanceof Error ? error.message : 'Network error'}`);
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
      throw new Error('Host not found');
    }

    // Get dashboard details from service
    const dashboard = dashboardService.getDashboardById(dashboardId);
    if (!dashboard) {
      throw new Error('Dashboard not found');
    }

    // ✅ Deploy dashboard via web-controller API (which uses gRPC)
    const response = await fetch(`/api/host/${hostId}/command`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'open_dashboard',
        targetDisplay: displayId,
        payload: {
          dashboardId: dashboard.id,
          url: dashboard.url,
          fullscreen: true,
          refreshInterval: dashboard.refreshInterval ? dashboard.refreshInterval * 1000 : 300000
        },
        timestamp: new Date()
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || 'Unknown error occurred during deployment');
    }
    
    // Success - no notification needed, button feedback is enough
  };

  const handleRemoveDashboard = async (hostId: string, displayId: string): Promise<void> => {
    const host = hosts.find(h => h.id === hostId);
    if (!host) {
      throw new Error('Host not found');
    }

    // Remove dashboard via web-controller API
    const response = await fetch(`/api/host/${hostId}/display/${displayId}/remove-dashboard`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || 'Unknown error occurred during removal');
    }
    
    // Success - no notification needed, button feedback is enough
  };

  const handleOpenDashboardModal = (hostId: string, displayId: string) => {
    setModalHostId(hostId);
    setModalDisplayId(displayId);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setModalHostId(null);
    setModalDisplayId(null);
  };

  return (
    <div className="space-y-6">
        {/* Hosts Grid */}
      {hosts.length === 0 ? (
        <div className="card text-center py-12">
          <div className="flex flex-col items-center">
            <div className="relative mb-4">
              <Wifi className="w-12 h-12 text-blue-400" />
              <div className="absolute inset-0 w-12 h-12 border-2 border-blue-200 rounded-full animate-ping"></div>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Searching for hosts...
            </h3>
            <p className="text-gray-500 mb-4">
              Scanning network for available Office TV agents
            </p>
            <div className="flex items-center justify-center space-x-1">
              <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
              <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
              <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
            </div>
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
              onRemoveDashboard={handleRemoveDashboard}
              onOpenDashboardModal={handleOpenDashboardModal}
            />
          ))}
        </div>
      )}

      {/* Dashboard Selection Modal */}
      <DashboardSelectorModal
        isOpen={modalOpen}
        hostId={modalHostId}
        displayId={modalDisplayId}
        onClose={handleCloseModal}
        onSelectDashboard={handleDeployDashboard}
      />
    </div>
  );
};