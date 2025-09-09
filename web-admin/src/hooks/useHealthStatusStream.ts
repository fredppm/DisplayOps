import { useState, useEffect, useRef } from 'react';

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
  grpc: {
    isRunning: boolean;
    connections: number;
    port: number;
  };
  controllers: {
    total: number;
    online: number;
    offline: number;
    connected: number; // conectados via gRPC
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
}

export function useHealthStatusStream(): UseHealthStatusStreamResult {
  const [status, setStatus] = useState<HealthStatus | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  
  const maxReconnectAttempts = 10;
  const baseReconnectDelay = 1000; // 1 second
  
  const connect = () => {
    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }
    
    const eventSource = new EventSource('/api/health/status-stream');
    eventSourceRef.current = eventSource;
    
    eventSource.onopen = () => {
      setIsConnected(true);
      setError(null);
      reconnectAttemptsRef.current = 0;
    };
    
    eventSource.onmessage = (event) => {
      try {
        const healthStatus: HealthStatus = JSON.parse(event.data);
        setStatus(healthStatus);
      } catch (err) {
        console.error('❌ Error parsing health status data:', err);
        setError('Error parsing status data');
      }
    };
    
    eventSource.onerror = (event) => {
      console.error('❌ Health status stream error:', event);
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
        console.error('❌ Max reconnection attempts reached for health status stream');
        setError('Connection failed after multiple attempts');
      }
    };
  };
  
  const reconnect = () => {
    reconnectAttemptsRef.current = 0;
    setError(null);
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    
    connect();
  };
  
  useEffect(() => {
    connect();
    
    // Cleanup on unmount
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, []);
  
  return {
    status,
    isConnected,
    error,
    reconnect
  };
}