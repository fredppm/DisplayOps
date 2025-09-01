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

// Circuit breaker configuration
const CIRCUIT_BREAKER_CONFIG = {
  MAX_CONSECUTIVE_FAILURES: 10,    // Stop after 10 consecutive failures
  OFFLINE_RETRY_DELAY: 300000,     // Wait 5 minutes before retry when offline
  CONNECTION_REFUSED_MAX_ATTEMPTS: 3, // Stop quickly for CONNECTION_REFUSED
};

export const useSSEHostDiscovery = (): UseSSEHostDiscoveryReturn => {
  // State
  const [discoveredHosts, setDiscoveredHosts] = useState<MiniPC[]>([]);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [isCircuitBreakerOpen, setIsCircuitBreakerOpen] = useState(false);
  const [consecutiveFailures, setConsecutiveFailures] = useState(0);
  
  // Update discovered hosts
  const setDiscoveredHostsWithLog = useCallback((hosts: MiniPC[]) => {
    setDiscoveredHosts(hosts);
  }, []);

  // Refs
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isConnectingRef = useRef(false);

  const connect = useCallback(() => {
    // Circuit breaker check
    if (isCircuitBreakerOpen) {
      console.log('🔴 Circuit breaker open - not attempting connection');
      return;
    }

    // Prevent multiple simultaneous connection attempts
    if (isConnectingRef.current) {
      console.log('🔄 Already attempting to connect');
      return;
    }

    if (eventSourceRef.current?.readyState === EventSource.OPEN) {
      console.log('🔄 SSE already connected');
      return;
    }

    isConnectingRef.current = true;
    const endpoint = '/api/discovery/events';
    setIsDiscovering(true);
    setConnectionError(null);

    const eventSource = new EventSource(endpoint);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      isConnectingRef.current = false;
      setIsConnected(true);
      setIsDiscovering(false);
      setReconnectAttempts(0);
      setConsecutiveFailures(0); // Reset circuit breaker
      setIsCircuitBreakerOpen(false);
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
      isConnectingRef.current = false;
      setIsConnected(false);
      setIsDiscovering(false);
      setConnectionError('Connection error');

      // Update failure counters
      setConsecutiveFailures(prev => {
        const newFailures = prev + 1;
        
        // Check if we should open circuit breaker
        if (newFailures >= CIRCUIT_BREAKER_CONFIG.MAX_CONSECUTIVE_FAILURES) {
          console.log('🔴 Circuit breaker opened - too many consecutive failures');
          setIsCircuitBreakerOpen(true);
          
          // Schedule a retry after offline delay
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log('🟡 Circuit breaker retry attempt after offline period');
            setIsCircuitBreakerOpen(false);
            setConsecutiveFailures(0);
            connect();
          }, CIRCUIT_BREAKER_CONFIG.OFFLINE_RETRY_DELAY);
          
          return newFailures;
        }
        
        return newFailures;
      });

      // Auto-reconnect with exponential backoff (only if circuit breaker is closed)
      setReconnectAttempts(prev => {
        const newAttempts = prev + 1;
        
        // Don't reconnect if circuit breaker is about to open
        if (consecutiveFailures + 1 >= CIRCUIT_BREAKER_CONFIG.MAX_CONSECUTIVE_FAILURES) {
          return newAttempts;
        }

        // Exponential backoff: 1s, 2s, 5s, 10s, 30s, 60s
        const delays = [1000, 2000, 5000, 10000, 30000, 60000];
        const delay = delays[Math.min(newAttempts - 1, delays.length - 1)];
        
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

    isConnectingRef.current = false;
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

  // Auto-connect on mount (with debounce to prevent multiple calls)
  useEffect(() => {
    // Small delay to prevent multiple rapid calls during React strict mode
    const connectTimeout = setTimeout(() => {
      connect();
    }, 100);

    // Cleanup on page unload
    const handleBeforeUnload = () => {
      disconnect();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      clearTimeout(connectTimeout);
      disconnect();
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []); // Empty deps array to only run once on mount

  // HTTP fallback when disconnected (with delay to avoid race conditions)
  useEffect(() => {
    if (!isConnected && !isCircuitBreakerOpen) {
      const fallbackTimeout = setTimeout(() => {
        requestHostsUpdate();
      }, 2000); // Wait 2s before fallback
      
      return () => clearTimeout(fallbackTimeout);
    }
  }, [isConnected, isCircuitBreakerOpen, requestHostsUpdate]);

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