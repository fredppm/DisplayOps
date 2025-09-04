import { useState, useEffect, useCallback, useRef } from 'react';
import { createSyncAlert } from '@/components/SyncAlert';

interface SyncStatus {
  overall: 'healthy' | 'warning' | 'critical';
  controllers: {
    total: number;
    online: number;
    syncUpToDate: number;
    pendingDashboards: number;
    pendingCookies: number;
  };
  grpc: {
    isRunning: boolean;
    connections: number;
  };
  alerts: any[];
}

interface UseSyncMonitorOptions {
  pollInterval?: number; // milliseconds
  enableRealTimeAlerts?: boolean;
  maxAlerts?: number;
}

interface UseSyncMonitorReturn {
  syncStatus: SyncStatus | null;
  alerts: any[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  clearAlerts: () => void;
  clearAlert: (alertId: string) => void;
}

export function useSyncMonitor(options: UseSyncMonitorOptions = {}): UseSyncMonitorReturn {
  const {
    pollInterval = 30000,
    enableRealTimeAlerts = true,
    maxAlerts = 5
  } = options;

  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const previousStatusRef = useRef<SyncStatus | null>(null);

  const fetchSyncStatus = useCallback(async (): Promise<void> => {
    try {
      const response = await fetch('/api/health/sync-status');
      const data = await response.json();
      
      if (data.success) {
        const newStatus = data.data;
        setSyncStatus(newStatus);
        
        // Generate real-time alerts if enabled
        if (enableRealTimeAlerts) {
          generateRealtimeAlerts(previousStatusRef.current, newStatus);
        }
        
        previousStatusRef.current = newStatus;
        setError(null);
      } else {
        setError(data.error || 'Failed to fetch sync status');
      }
    } catch (err) {
      setError('Network error fetching sync status');
      console.error('Sync monitor error:', err);
    } finally {
      setLoading(false);
    }
  }, [enableRealTimeAlerts]);

  const generateRealtimeAlerts = (prevStatus: SyncStatus | null, newStatus: SyncStatus) => {
    if (!prevStatus) return;

    const newAlerts: any[] = [];

    // Check for newly completed syncs
    if (prevStatus.controllers.pendingDashboards > newStatus.controllers.pendingDashboards) {
      const completedCount = prevStatus.controllers.pendingDashboards - newStatus.controllers.pendingDashboards;
      newAlerts.push({
        id: `dashboard-sync-completed-${Date.now()}`,
        type: 'success',
        title: 'Dashboard Sync Completed',
        message: `${completedCount} controller(s) completed dashboard sync`,
        timestamp: new Date().toISOString(),
        autoHide: true,
        duration: 5000
      });
    }

    if (prevStatus.controllers.pendingCookies > newStatus.controllers.pendingCookies) {
      const completedCount = prevStatus.controllers.pendingCookies - newStatus.controllers.pendingCookies;
      newAlerts.push({
        id: `cookie-sync-completed-${Date.now()}`,
        type: 'success',
        title: 'Cookie Sync Completed',
        message: `${completedCount} controller(s) completed cookie sync`,
        timestamp: new Date().toISOString(),
        autoHide: true,
        duration: 5000
      });
    }

    // Check for newly online controllers
    if (newStatus.controllers.online > prevStatus.controllers.online) {
      const newOnlineCount = newStatus.controllers.online - prevStatus.controllers.online;
      newAlerts.push({
        id: `controllers-online-${Date.now()}`,
        type: 'success',
        title: 'Controllers Reconnected',
        message: `${newOnlineCount} controller(s) came back online`,
        timestamp: new Date().toISOString(),
        autoHide: true,
        duration: 5000
      });
    }

    // Check for newly offline controllers
    // Suppressed: No longer showing controller offline alerts
    // if (newStatus.controllers.online < prevStatus.controllers.online) {
    //   const offlineCount = prevStatus.controllers.online - newStatus.controllers.online;
    //   newAlerts.push({
    //     id: `controllers-offline-${Date.now()}`,
    //     type: 'warning',
    //     title: 'Controllers Went Offline',
    //     message: `${offlineCount} controller(s) went offline`,
    //     timestamp: new Date().toISOString()
    //   });
    // }

    // Check for gRPC server status changes
    // Suppressed: No longer showing gRPC server down alerts
    // if (prevStatus.grpc.isRunning && !newStatus.grpc.isRunning) {
    //   newAlerts.push(createSyncAlert.grpcServerDown());
    // }

    if (!prevStatus.grpc.isRunning && newStatus.grpc.isRunning) {
      newAlerts.push({
        id: `grpc-server-online-${Date.now()}`,
        type: 'success',
        title: 'gRPC Server Online',
        message: 'gRPC server is back online. Automatic sync is restored.',
        timestamp: new Date().toISOString(),
        autoHide: true,
        duration: 5000
      });
    }

    // Check for health status changes
    if (prevStatus.overall !== newStatus.overall) {
      if (newStatus.overall === 'healthy' && prevStatus.overall !== 'healthy') {
        newAlerts.push({
          id: `system-healthy-${Date.now()}`,
          type: 'success',
          title: 'System Health Restored',
          message: 'All systems are now operating normally',
          timestamp: new Date().toISOString(),
          autoHide: true,
          duration: 5000
        });
      } else if (newStatus.overall === 'critical') {
        newAlerts.push({
          id: `system-critical-${Date.now()}`,
          type: 'error',
          title: 'Critical System Issues',
          message: 'System health is critical. Immediate attention required.',
          timestamp: new Date().toISOString()
        });
      }
    }

    if (newAlerts.length > 0) {
      setAlerts(prev => {
        const combined = [...prev, ...newAlerts];
        // Keep only the most recent alerts
        const sorted = combined.sort((a, b) => 
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
        return sorted.slice(0, maxAlerts);
      });
    }
  };

  const clearAlerts = useCallback(() => {
    setAlerts([]);
  }, []);

  const clearAlert = useCallback((alertId: string) => {
    setAlerts(prev => prev.filter(alert => alert.id !== alertId));
  }, []);

  // Start polling
  useEffect(() => {
    fetchSyncStatus();

    if (pollInterval > 0) {
      intervalRef.current = setInterval(fetchSyncStatus, pollInterval);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [fetchSyncStatus, pollInterval]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return {
    syncStatus,
    alerts,
    loading,
    error,
    refresh: fetchSyncStatus,
    clearAlerts,
    clearAlert
  };
}

// Specialized hook for health dashboard
export function useHealthDashboard() {
  return useSyncMonitor({
    pollInterval: 15000, // More frequent for health dashboard
    enableRealTimeAlerts: true,
    maxAlerts: 10
  });
}

// Specialized hook for global layout monitoring  
export function useGlobalSyncMonitor() {
  return useSyncMonitor({
    pollInterval: 60000, // Less frequent for global monitoring
    enableRealTimeAlerts: true,
    maxAlerts: 3
  });
}