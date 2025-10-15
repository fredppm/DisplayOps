import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';

// Types for admin status
interface AdminHealthStatus {
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

interface SyncAlert {
  id: string;
  type: 'warning' | 'error' | 'info';
  title: string;
  message: string;
  timestamp: string;
  hostId?: string;
}

interface HealthCheck {
  timestamp: string;
  status: 'healthy' | 'warning' | 'critical';
  details: any;
}

// Compatibility types for useAdminEvents
interface HostData {
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
  hosts: string[];
}

interface SystemHealth {
  status: 'healthy' | 'degraded' | 'critical';
  hosts: {
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
  hosts: HostData[];
  sites: SiteData[];
}

const AdminStatusContext = createContext<AdminStatusContextType | undefined>(undefined);

// Global singleton to survive Next.js hot reloads
declare global {
  var __adminStatusPollingInterval: NodeJS.Timeout | undefined;
}

export function AdminStatusProvider({ children }: { children: React.ReactNode }) {
  
  const [status, setStatus] = useState<AdminHealthStatus | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localAlerts, setLocalAlerts] = useState<SyncAlert[]>([]);
  const [loading, setLoading] = useState(true);
  
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const previousStatusRef = useRef<AdminHealthStatus | null>(null);
  const isMountedRef = useRef(true);
  
  const maxReconnectAttempts = 10;
  const baseReconnectDelay = 1000; // 1 second
  const normalPollingInterval = 5000; // 5 seconds
  const slowPollingInterval = 15000; // 15 seconds when inactive
  
  const fetchAdminStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/health/status');
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const healthStatus = await response.json();
      
      // Convert HealthStatus to AdminHealthStatus format
      const adminStatus: AdminHealthStatus = {
        overall: healthStatus.sync.overall,
        hosts: {
          total: healthStatus.hosts.total,
          online: healthStatus.hosts.online,
          offline: healthStatus.hosts.offline
        },
        data: healthStatus.data,
        websocket: {
          isRunning: healthStatus.websocket.isRunning,
          connections: healthStatus.websocket.connections
        },
        alerts: healthStatus.sync.alerts
      };
      
      if (isMountedRef.current) {
        setStatus(adminStatus);
        setIsConnected(true);
        setError(null);
        setLoading(false);
        reconnectAttemptsRef.current = 0;
        
        // Generate real-time alerts similar to useSyncMonitor
        generateRealtimeAlerts(previousStatusRef.current, adminStatus);
        previousStatusRef.current = adminStatus;
      }
      
      return adminStatus;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error('❌ Error fetching admin status:', errorMessage);
      
      if (isMountedRef.current) {
        setIsConnected(false);
        setError(errorMessage);
        setLoading(false);
      }
      
      throw err;
    }
  }, []);

  const startPolling = useCallback((interval = normalPollingInterval) => {
    // Use global singleton to prevent multiple polling intervals
    if (global.__adminStatusPollingInterval) {
      clearInterval(global.__adminStatusPollingInterval);
    }
    
    // Clear local interval as well
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }
    
    // Initial fetch
    fetchAdminStatus().catch(() => {
      // Error already handled in fetchAdminStatus
    });
    
    // Set up polling interval
    const intervalId = setInterval(() => {
      if (isMountedRef.current) {
        fetchAdminStatus().catch(() => {
          // Error already handled in fetchAdminStatus
        });
      }
    }, interval);
    
    pollingIntervalRef.current = intervalId;
    global.__adminStatusPollingInterval = intervalId;
  }, [fetchAdminStatus]);

  const stopPolling = useCallback(() => {
    if (global.__adminStatusPollingInterval) {
      clearInterval(global.__adminStatusPollingInterval);
      global.__adminStatusPollingInterval = undefined;
    }
    
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    startPolling(normalPollingInterval);
  }, [startPolling]);
  
  const generateRealtimeAlerts = (prevStatus: AdminHealthStatus | null, newStatus: AdminHealthStatus) => {
    if (!prevStatus) return;

    const newAlerts: SyncAlert[] = [];

    // Check for newly online hosts
    if (newStatus.hosts.online > prevStatus.hosts.online) {
      const newOnlineCount = newStatus.hosts.online - prevStatus.hosts.online;
      newAlerts.push({
        id: `hosts-online-${Date.now()}`,
        type: 'info',
        title: 'Hosts Reconnected',
        message: `${newOnlineCount} host(s) came back online`,
        timestamp: new Date().toISOString()
      });
    }

    // Check for health status changes
    if (prevStatus.overall !== newStatus.overall) {
      if (newStatus.overall === 'healthy' && prevStatus.overall !== 'healthy') {
        newAlerts.push({
          id: `system-healthy-${Date.now()}`,
          type: 'info',
          title: 'System Health Restored',
          message: 'All systems are now operating normally',
          timestamp: new Date().toISOString()
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
    
    // Try to fetch immediately
    fetchAdminStatus()
      .then(() => {
        // Success, restart normal polling
        startPolling(normalPollingInterval);
      })
      .catch(() => {
        // Failed, implement exponential backoff
        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          const delay = Math.min(
            baseReconnectDelay * Math.pow(2, reconnectAttemptsRef.current),
            30000 // Max 30 seconds
          );
          
          reconnectTimeoutRef.current = setTimeout(() => {
            if (isMountedRef.current) {
              reconnectAttemptsRef.current++;
              reconnect();
            }
          }, delay);
        } else {
          console.error('❌ Max reconnection attempts reached for admin status');
          if (isMountedRef.current) {
            setError('Connection failed after multiple attempts');
            setLoading(false);
          }
        }
      });
  }, [fetchAdminStatus, startPolling]);
  
  const refresh = useCallback(async () => {
    // For polling, refresh means reconnect
    reconnect();
  }, [reconnect]);
  
  const clearAlerts = useCallback(() => {
    setLocalAlerts([]);
  }, []);

  const clearAlert = useCallback((alertId: string) => {
    setLocalAlerts(prev => prev.filter(alert => alert.id !== alertId));
  }, []);
  
  // Handle visibility change for smart polling
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Page is not visible, slow down polling
        startPolling(slowPollingInterval);
      } else {
        // Page is visible, use normal polling
        startPolling(normalPollingInterval);
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [startPolling]);

  useEffect(() => {
    isMountedRef.current = true;
    connect();
    
    // Cleanup on unmount
    return () => {
      isMountedRef.current = false;
      stopPolling();
      
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [connect, stopPolling]);
  
  // Create compatibility objects for existing components
  const healthChecksData = status ? {
    success: true,
    data: {
      checks: [],
      overallStatus: status.overall
    },
    timestamp: new Date().toISOString()
  } : null;
  
  // Combine SSE alerts with local alerts
  const allAlerts = [
    ...(status?.alerts || []),
    ...localAlerts
  ];
  
  // Empty hosts array - no longer tracking individual hosts in this context
  const hosts: HostData[] = [];
  
  // Create fake sites data (since SSE doesn't provide site details)
  const sites: SiteData[] = [
    {
      id: 'site-1',
      name: 'Default Site',
      status: status?.overall === 'healthy' ? 'healthy' : 
             status?.overall === 'warning' ? 'unknown' : 'unhealthy',
      hosts: [] // Empty - no individual host tracking
    }
  ];
  
  // Calculate system health in useAdminEvents format
  const systemHealth: SystemHealth | null = status ? {
    status: status.overall === 'healthy' ? 'healthy' :
            status.overall === 'warning' ? 'degraded' : 'critical',
    hosts: {
      online: status.hosts.online,
      total: status.hosts.total,
      percentage: status.hosts.total > 0 ? 
        Math.round((status.hosts.online / status.hosts.total) * 100) : 0
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
    hosts,
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
    hosts: result.hosts,
    sites: result.sites,
    isConnected: result.isConnected
  };
}

export function useAdminStatusStream() {
  return useAdminStatus();
}