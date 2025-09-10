import { useState, useEffect, useRef, useCallback } from 'react';

interface ControllerSyncStatus {
  controllerId: string;
  name: string;
  status: 'online' | 'offline' | 'error';
  isConnected: boolean;
  lastSync: string;
  dashboardSync: {
    pending: boolean;
    timestamp: string | null;
  };
  cookieSync: {
    pending: boolean;
    timestamp: string | null;
  };
}

interface SyncAlert {
  id: string;
  type: 'warning' | 'error' | 'info';
  title: string;
  message: string;
  timestamp: string;
  controllerId?: string;
}

interface HealthCheck {
  name: string;
  status: 'healthy' | 'warning' | 'critical' | 'unknown';
  message?: string;
  lastCheck: string;
  responseTime?: number;
}

export interface HealthStatus {
  websocket: {
    isRunning: boolean;
    connections: number;
    port: number;
  };
  controllers: {
    total: number;
    online: number;
    offline: number;
    connected: number; // conectados via WebSocket
    syncUpToDate: number;
    pendingDashboards: number;
    pendingCookies: number;
  };
  sync: {
    overall: 'healthy' | 'warning' | 'critical';
    controllers: ControllerSyncStatus[];
    alerts: SyncAlert[];
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
  healthChecks: {
    checks: HealthCheck[];
    overallStatus: 'healthy' | 'warning' | 'critical';
  };
  timestamp: string;
}

interface UseHealthStatusStreamResult {
  status: HealthStatus | null;
  isConnected: boolean;
  error: string | null;
  reconnect: () => void;
  loading: boolean;
}

export function useHealthStatusStream(): UseHealthStatusStreamResult {
  const [status, setStatus] = useState<HealthStatus | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const isMountedRef = useRef(true);
  
  const maxReconnectAttempts = 10;
  const baseReconnectDelay = 1000; // 1 second
  const normalPollingInterval = 5000; // 5 seconds
  const slowPollingInterval = 15000; // 15 seconds when inactive
  
  const fetchHealthStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/health/status');
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const healthStatus: HealthStatus = await response.json();
      
      if (isMountedRef.current) {
        setStatus(healthStatus);
        setIsConnected(true);
        setError(null);
        setLoading(false);
        reconnectAttemptsRef.current = 0;
      }
      
      return healthStatus;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error('❌ Error fetching health status:', errorMessage);
      
      if (isMountedRef.current) {
        setIsConnected(false);
        setError(errorMessage);
        setLoading(false);
      }
      
      throw err;
    }
  }, []);
  
  const startPolling = useCallback((interval = normalPollingInterval) => {
    // Clear existing interval
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }
    
    // Initial fetch
    fetchHealthStatus().catch(() => {
      // Error already handled in fetchHealthStatus
    });
    
    // Set up polling interval
    pollingIntervalRef.current = setInterval(() => {
      if (isMountedRef.current) {
        fetchHealthStatus().catch(() => {
          // Error already handled in fetchHealthStatus
        });
      }
    }, interval);
  }, [fetchHealthStatus]);
  
  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  }, []);
  
  const reconnect = useCallback(() => {
    reconnectAttemptsRef.current = 0;
    setError(null);
    setLoading(true);
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    
    // Try to fetch immediately
    fetchHealthStatus()
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
          console.error('❌ Max reconnection attempts reached for health status');
          if (isMountedRef.current) {
            setError('Connection failed after multiple attempts');
            setLoading(false);
          }
        }
      });
  }, [fetchHealthStatus, startPolling]);
  
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
    
    // Start polling
    startPolling(normalPollingInterval);
    
    // Cleanup on unmount
    return () => {
      isMountedRef.current = false;
      stopPolling();
      
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [startPolling, stopPolling]);
  
  return {
    status,
    isConnected,
    error,
    reconnect,
    loading
  };
}