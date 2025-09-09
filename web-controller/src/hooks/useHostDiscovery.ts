import { useEffect, useState, useRef } from 'react';
import { MiniPC, ApiResponse } from '@/types/shared-types';
import { sseService, HostDiscoveryUpdate } from '@/lib/sse-singleton';
import { createContextLogger } from '@/utils/logger';

export interface UseHostDiscoveryReturn {
  discoveredHosts: MiniPC[];
  isConnected: boolean;
  isDiscovering: boolean;
  lastUpdate: Date | null;
  connectionError: string | null;
  reconnectAttempts: number;
  requestHostsUpdate: () => void;
}

const hostDiscoveryLogger = createContextLogger('use-host-discovery');

export const useHostDiscovery = (): UseHostDiscoveryReturn => {
  const [discoveredHosts, setDiscoveredHosts] = useState<MiniPC[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  
  const initializationRef = useRef(false);
  const handlerRef = useRef<((update: HostDiscoveryUpdate) => void) | null>(null);

  useEffect(() => {
    hostDiscoveryLogger.debug('useHostDiscovery effect starting', { location: window.location.href });
    
    // Create handler function
    const handleUpdate = (update: HostDiscoveryUpdate) => {
      hostDiscoveryLogger.debug('Received hosts update via SSE', { 
        hostCount: update.data?.length || 0,
        changeType: update.changeType,
        hostDetails: update.data?.map(h => `${h.id} (${h.ipAddress}:${h.port})`)
      });
      
      setDiscoveredHosts(update.data || []);
      setLastUpdate(new Date(update.timestamp));
      
      // Log specific changes
      if (update.changeType && update.changedHost) {
        switch (update.changeType) {
          case 'host_added':
            hostDiscoveryLogger.info('New host discovered', { hostId: update.changedHost.id });
            break;
          case 'host_updated':
            hostDiscoveryLogger.debug('Host updated', { hostId: update.changedHost.id });
            break;
          case 'host_removed':
            hostDiscoveryLogger.info('Host removed', { hostId: update.changedHost.id });
            break;
          case 'initial_load':
            console.log('📋 Initial hosts loaded:', update.data?.length || 0);
            break;
        }
      }
    };
    
    handlerRef.current = handleUpdate;
    
    // Connect to SSE service
    setIsDiscovering(true);
    sseService.connect().then((connected) => {
      console.log('🔗 SSE connection result:', connected);
      setIsConnected(connected);
      setIsDiscovering(false);
      if (!connected) {
        setConnectionError('Failed to connect to SSE service');
      } else {
        setConnectionError(null);
      }
    }).catch((error) => {
      console.error('❌ SSE connection failed with exception:', error);
      setIsConnected(false);
      setIsDiscovering(false);
      setConnectionError(`SSE connection error: ${error.message}`);
    });
    
    // Add handler
    sseService.addHandler(handleUpdate);
    
    // Cleanup function
    return () => {
      console.log('🧹 Cleanup function called');
      if (handlerRef.current) {
        sseService.removeHandler(handlerRef.current);
      }
    };
  }, []);

  const requestHostsUpdate = () => {
    console.log('📡 SSE Singleton connection is active, hosts update automatically');
    const status = sseService.getStatus();
    console.log('📊 SSE Status:', status);
  };

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
