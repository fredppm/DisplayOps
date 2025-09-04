import { useState, useEffect, useRef } from 'react';

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

interface AdminEventsData {
  systemHealth: SystemHealth | null;
  controllers: ControllerData[];
  sites: SiteData[];
  isConnected: boolean;
  error: string | null;
}

export function useAdminEvents(): AdminEventsData {
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [controllers, setControllers] = useState<ControllerData[]>([]);
  const [sites, setSites] = useState<SiteData[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const connect = () => {
    try {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      const eventSource = new EventSource('/api/admin/events');
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        console.log('Admin SSE connected');
        setIsConnected(true);
        setError(null);
      };

      eventSource.addEventListener('health-update', (event) => {
        try {
          const data = JSON.parse(event.data);
          setSystemHealth(data);
        } catch (err) {
          console.error('Error parsing health update:', err);
        }
      });

      eventSource.addEventListener('controllers-update', (event) => {
        try {
          const data = JSON.parse(event.data);
          setControllers(data);
        } catch (err) {
          console.error('Error parsing controllers update:', err);
        }
      });

      eventSource.addEventListener('sites-update', (event) => {
        try {
          const data = JSON.parse(event.data);
          setSites(data);
        } catch (err) {
          console.error('Error parsing sites update:', err);
        }
      });

      eventSource.onerror = (event) => {
        console.error('Admin SSE error:', event);
        setIsConnected(false);
        setError('Connection lost. Attempting to reconnect...');
        
        // Reconnect after 3 seconds
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }
        
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log('Attempting to reconnect admin SSE...');
          connect();
        }, 3000);
      };

    } catch (err) {
      console.error('Error creating EventSource:', err);
      setError('Failed to establish connection');
      setIsConnected(false);
    }
  };

  useEffect(() => {
    connect();

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
    systemHealth,
    controllers,
    sites,
    isConnected,
    error
  };
}