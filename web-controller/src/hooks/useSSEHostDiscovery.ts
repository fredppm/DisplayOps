import { useEffect, useState, useCallback, useRef } from 'react';
import { MiniPC } from '@/types/shared-types';

export interface UseSSEHostDiscoveryReturn {
  discoveredHosts: MiniPC[];
  isConnected: boolean;
  isDiscovering: boolean;
  lastUpdate: Date | null;
  connectionError: string | null;
  reconnectAttempts: number;
  requestHostsUpdate: () => void;
}

export const useSSEHostDiscovery = (): UseSSEHostDiscoveryReturn => {
  // State
  const [discoveredHosts, setDiscoveredHosts] = useState<MiniPC[]>([]);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  
  // Update discovered hosts
  const setDiscoveredHostsWithLog = useCallback((hosts: MiniPC[]) => {
    setDiscoveredHosts(hosts);
  }, []);

  // Refs
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(() => {
    if (eventSourceRef.current?.readyState === EventSource.OPEN) {
      console.log('🔄 SSE already connected');
      return;
    }

    const endpoint = '/api/discovery/events';
    setIsDiscovering(true);
    setConnectionError(null);

    const eventSource = new EventSource(endpoint);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setIsConnected(true);
      setIsDiscovering(false);
      setReconnectAttempts(0);
      setConnectionError(null);
    };

    // Handle all messages, not just specific events
    eventSource.onmessage = (event) => {
      // Generic message handler (not used for typed events)
    };

    // Handle hosts_update events specifically
    const handleHostsUpdate = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.success && Array.isArray(data.data)) {
          setDiscoveredHostsWithLog([...data.data]); // Force array copy
          setLastUpdate(new Date(data.timestamp || new Date()));
          setIsDiscovering(false);
        }
      } catch (error) {
        console.error('Error parsing SSE hosts_update:', error);
      }
    };
    
    eventSource.addEventListener('hosts_update', handleHostsUpdate);
    
    // Also listen for any errors in event handling
    eventSource.addEventListener('error', (event) => {
      console.error('❌ SSE error event:', event);
    });

    eventSource.addEventListener('heartbeat', (event) => {
      // Heartbeat received - connection alive
    });

    eventSource.onerror = (error) => {
      setIsConnected(false);
      setIsDiscovering(false);
      setConnectionError('Connection error');

      // Auto-reconnect
      setReconnectAttempts(prev => {
        const newAttempts = prev + 1;
        const delay = Math.min(newAttempts * 3000, 30000); // Max 30s delay
        
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, delay);
        
        return newAttempts;
      });
    };

  }, []);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    setIsConnected(false);
    setIsDiscovering(false);
  }, []);

  // HTTP fallback when SSE is not connected
  const requestHostsUpdate = useCallback(async () => {
    if (isConnected) {
      return;
    }

    setIsDiscovering(true);
    try {
      const response = await fetch('/api/discovery/hosts');
      const data = await response.json();
      
      if (data.success && Array.isArray(data.data)) {
        setDiscoveredHostsWithLog(data.data);
        setLastUpdate(new Date());
      }
    } catch (error) {
      console.error('HTTP discovery fallback failed:', error);
    } finally {
      setIsDiscovering(false);
    }
  }, [isConnected]);

  // Auto-connect on mount
  useEffect(() => {
    connect();

    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  // HTTP fallback when disconnected (with delay to avoid race conditions)
  useEffect(() => {
    if (!isConnected) {
      const fallbackTimeout = setTimeout(() => {
        requestHostsUpdate();
      }, 2000); // Wait 2s before fallback
      
      return () => clearTimeout(fallbackTimeout);
    }
  }, [isConnected, requestHostsUpdate]);

  return {
    discoveredHosts,
    isConnected,
    isDiscovering,
    lastUpdate,
    connectionError,
    reconnectAttempts,
    requestHostsUpdate
  };
};