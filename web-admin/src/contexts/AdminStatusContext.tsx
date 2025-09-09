import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { AdminHealthStatus, ControllerSyncStatus, SyncAlert, HealthCheck } from '@/hooks/useAdminStatusStream';

// Compatibility types for useAdminEvents
interface ControllerData {
  id: string;
  name: string;
  lastHeartbeat: string;
  status: 'online' | 'offline';
  location?: string;
}

interface SiteData {
  id: string;
  name: string;
  status: 'healthy' | 'unhealthy' | 'unknown';
  controllers: string[];
}

interface SystemHealth {
  status: 'healthy' | 'degraded' | 'critical';
  controllers: {
    online: number;
    total: number;
    percentage: number;
  };
  sites: {
    healthy: number;
    total: number;
    percentage: number;
  };
}

interface AdminStatusContextType {
  // Core SSE status
  status: AdminHealthStatus | null;
  isConnected: boolean;
  error: string | null;
  reconnect: () => void;
  
  // Compatibility methods for existing hooks
  syncStatus: AdminHealthStatus | null;
  alerts: SyncAlert[];
  loading: boolean;
  refresh: () => Promise<void>;
  clearAlerts: () => void;
  clearAlert: (alertId: string) => void;
  
  // Health dashboard data compatibility
  healthChecksData: {
    success: boolean;
    data: {
      checks: HealthCheck[];
      overallStatus: 'healthy' | 'warning' | 'critical';
    };
    timestamp: string;
  } | null;
  
  // useAdminEvents compatibility
  systemHealth: SystemHealth | null;
  controllers: ControllerData[];
  sites: SiteData[];
}

const AdminStatusContext = createContext<AdminStatusContextType | undefined>(undefined);

// Global singleton to survive Next.js hot reloads
declare global {
  var __adminStatusEventSource: EventSource | undefined;
}

export function AdminStatusProvider({ children }: { children: React.ReactNode }) {
  
  const [status, setStatus] = useState<AdminHealthStatus | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localAlerts, setLocalAlerts] = useState<SyncAlert[]>([]);
  const [loading, setLoading] = useState(true);
  
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const previousStatusRef = useRef<AdminHealthStatus | null>(null);
  
  const maxReconnectAttempts = 10;
  const baseReconnectDelay = 1000; // 1 second
  
  const connect = useCallback(() => {
    // Use global singleton to prevent multiple connections
    if (global.__adminStatusEventSource && global.__adminStatusEventSource.readyState !== EventSource.CLOSED) {
      eventSourceRef.current = global.__adminStatusEventSource;
      setIsConnected(global.__adminStatusEventSource.readyState === EventSource.OPEN);
      
      // Wait for connection to open if it's still connecting
      if (global.__adminStatusEventSource.readyState === EventSource.CONNECTING) {
        global.__adminStatusEventSource.onopen = () => {
          setIsConnected(true);
          setError(null);
          setLoading(false);
        };
      }
      
      // Re-attach event listeners to the existing connection
      global.__adminStatusEventSource.onmessage = (event) => {
        try {
          const adminStatus: AdminHealthStatus = JSON.parse(event.data);
          setStatus(adminStatus);
          generateRealtimeAlerts(previousStatusRef.current, adminStatus);
          previousStatusRef.current = adminStatus;
        } catch (err) {
          console.error('Error parsing admin status data:', err);
          setError('Error parsing status data');
        }
      };
      
      return;
    }
    
    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }
    
    const eventSource = new EventSource('/api/health/status-stream');
    eventSourceRef.current = eventSource;
    global.__adminStatusEventSource = eventSource;
    
    eventSource.onopen = () => {
      setIsConnected(true);
      setError(null);
      setLoading(false);
      reconnectAttemptsRef.current = 0;
    };
    
    eventSource.onmessage = (event) => {
      try {
        const adminStatus: AdminHealthStatus = JSON.parse(event.data);
        setStatus(adminStatus);
        
        // Generate real-time alerts similar to useSyncMonitor
        generateRealtimeAlerts(previousStatusRef.current, adminStatus);
        previousStatusRef.current = adminStatus;
      } catch (err) {
        console.error('Error parsing admin status data:', err);
        setError('Error parsing status data');
      }
    };
    
    eventSource.onerror = (event) => {
      console.error('Admin status stream error:', event);
      setIsConnected(false);
      
      // Implement exponential backoff reconnection
      if (reconnectAttemptsRef.current < maxReconnectAttempts) {
        const delay = Math.min(
          baseReconnectDelay * Math.pow(2, reconnectAttemptsRef.current),
          30000 // Max 30 seconds
        );
        
        reconnectTimeoutRef.current = setTimeout(() => {
          reconnectAttemptsRef.current++;
          connect();
        }, delay);
      } else {
        console.error('Max reconnection attempts reached for admin status stream');
        setError('Connection failed after multiple attempts');
        setLoading(false);
      }
    };
  }, []);
  
  const generateRealtimeAlerts = (prevStatus: AdminHealthStatus | null, newStatus: AdminHealthStatus) => {
    if (!prevStatus) return;

    const newAlerts: SyncAlert[] = [];

    // Check for newly completed syncs
    if (prevStatus.controllers.pendingDashboards > newStatus.controllers.pendingDashboards) {
      const completedCount = prevStatus.controllers.pendingDashboards - newStatus.controllers.pendingDashboards;
      newAlerts.push({
        id: `dashboard-sync-completed-${Date.now()}`,
        type: 'info',
        title: 'Dashboard Sync Completed',
        message: `${completedCount} controller(s) completed dashboard sync`,
        timestamp: new Date().toISOString()
      });
    }

    if (prevStatus.controllers.pendingCookies > newStatus.controllers.pendingCookies) {
      const completedCount = prevStatus.controllers.pendingCookies - newStatus.controllers.pendingCookies;
      newAlerts.push({
        id: `cookie-sync-completed-${Date.now()}`,
        type: 'info',
        title: 'Cookie Sync Completed',
        message: `${completedCount} controller(s) completed cookie sync`,
        timestamp: new Date().toISOString()
      });
    }

    // Check for newly online controllers - DISABLED notification
    // if (newStatus.controllers.online > prevStatus.controllers.online) {
    //   const newOnlineCount = newStatus.controllers.online - prevStatus.controllers.online;
    //   newAlerts.push({
    //     id: `controllers-online-${Date.now()}`,
    //     type: 'info',
    //     title: 'Controllers Reconnected',
    //     message: `${newOnlineCount} controller(s) came back online`,
    //     timestamp: new Date().toISOString()
    //   });
    // }

    // Check for gRPC server status changes - DISABLED notification
    // if (!prevStatus.grpc.isRunning && newStatus.grpc.isRunning) {
    //   newAlerts.push({
    //     id: `grpc-server-online-${Date.now()}`,
    //     type: 'info',
    //     title: 'gRPC Server Online',
    //     message: 'gRPC server is back online. Automatic sync is restored.',
    //     timestamp: new Date().toISOString()
    //   });
    // }

    // Check for health status changes
    if (prevStatus.sync.overall !== newStatus.sync.overall) {
      if (newStatus.sync.overall === 'healthy' && prevStatus.sync.overall !== 'healthy') {
        newAlerts.push({
          id: `system-healthy-${Date.now()}`,
          type: 'info',
          title: 'System Health Restored',
          message: 'All systems are now operating normally',
          timestamp: new Date().toISOString()
        });
      } else if (newStatus.sync.overall === 'critical') {
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
      setLocalAlerts(prev => {
        const combined = [...prev, ...newAlerts];
        // Keep only the most recent alerts
        const sorted = combined.sort((a, b) => 
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
        return sorted.slice(0, 10);
      });
    }
  };
  
  const reconnect = useCallback(() => {
    reconnectAttemptsRef.current = 0;
    setError(null);
    setLoading(true);
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    
    connect();
  }, [connect]);
  
  const refresh = useCallback(async () => {
    // For SSE, refresh means reconnect
    reconnect();
  }, [reconnect]);
  
  const clearAlerts = useCallback(() => {
    setLocalAlerts([]);
  }, []);

  const clearAlert = useCallback((alertId: string) => {
    setLocalAlerts(prev => prev.filter(alert => alert.id !== alertId));
  }, []);
  
  useEffect(() => {
    // Initialize gRPC server on first provider mount (server-side only)
    if (typeof window === 'undefined') {
      import('@/lib/grpc-server-init').then(({ initializeGrpcServer }) => {
        initializeGrpcServer().catch((error) => {
          console.error('Failed to initialize gRPC server from AdminStatusProvider:', error);
        });
      });
    }
    
    connect();
    
    // Cleanup on unmount - but don't close global connection
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      
      // Don't close the global connection, just remove local reference
      eventSourceRef.current = null;
    };
  }, [connect]);
  
  // Create compatibility objects for existing components
  const healthChecksData = status ? {
    success: true,
    data: {
      checks: status.healthChecks.checks,
      overallStatus: status.healthChecks.overallStatus
    },
    timestamp: status.timestamp
  } : null;
  
  // Combine SSE alerts with local alerts
  const allAlerts = [
    ...(status?.sync.alerts || []),
    ...localAlerts
  ];
  
  // Convert SSE data to useAdminEvents format
  const controllers: ControllerData[] = status?.sync.controllers.map(controller => ({
    id: controller.controllerId,
    name: controller.name,
    lastHeartbeat: controller.lastSync,
    status: controller.status === 'online' ? 'online' : 'offline',
    location: undefined // Not available in sync data
  })) || [];
  
  // Create fake sites data (since SSE doesn't provide site details)
  const sites: SiteData[] = [
    {
      id: 'site-1',
      name: 'Default Site',
      status: status?.sync.overall === 'healthy' ? 'healthy' : 
             status?.sync.overall === 'warning' ? 'unknown' : 'unhealthy',
      controllers: controllers.map(c => c.id)
    }
  ];
  
  // Calculate system health in useAdminEvents format
  const systemHealth: SystemHealth | null = status ? {
    status: status.sync.overall === 'healthy' ? 'healthy' :
            status.sync.overall === 'warning' ? 'degraded' : 'critical',
    controllers: {
      online: status.controllers.online,
      total: status.controllers.total,
      percentage: status.controllers.total > 0 ? 
        Math.round((status.controllers.online / status.controllers.total) * 100) : 0
    },
    sites: {
      healthy: sites.filter(s => s.status === 'healthy').length,
      total: sites.length,
      percentage: sites.length > 0 ? 
        Math.round((sites.filter(s => s.status === 'healthy').length / sites.length) * 100) : 0
    }
  } : null;
  
  const contextValue: AdminStatusContextType = {
    // Core SSE status
    status,
    isConnected,
    error,
    reconnect,
    
    // Compatibility for useSyncMonitor/useHealthDashboard
    syncStatus: status,
    alerts: allAlerts,
    loading,
    refresh,
    clearAlerts,
    clearAlert,
    
    // Compatibility for useDashboardData (health checks part)
    healthChecksData,
    
    // Compatibility for useAdminEvents
    systemHealth,
    controllers,
    sites
  };
  
  return (
    <AdminStatusContext.Provider value={contextValue}>
      {children}
    </AdminStatusContext.Provider>
  );
}

export function useAdminStatus() {
  const context = useContext(AdminStatusContext);
  if (context === undefined) {
    throw new Error('useAdminStatus must be used within an AdminStatusProvider');
  }
  return context;
}

// Specialized hook aliases for backward compatibility
export function useHealthDashboard() {
  return useAdminStatus();
}

export function useGlobalSyncMonitor() {
  return useAdminStatus();
}

export function useAdminEvents() {
  const result = useAdminStatus();
  return {
    systemHealth: result.systemHealth,
    controllers: result.controllers,
    sites: result.sites,
    isConnected: result.isConnected
  };
}

export function useAdminStatusStream() {
  return useAdminStatus();
}