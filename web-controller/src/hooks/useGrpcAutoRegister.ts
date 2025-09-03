import { useEffect, useState } from 'react';
import { grpcClientSingleton } from '../lib/grpc-client-singleton';
import { logger } from '../lib/logger';

export interface GrpcAutoRegisterStatus {
  isConnected: boolean;
  isConnecting: boolean;
  isRegistered: boolean;
  error: string | null;
  controllerId: string | null;
  reconnectAttempts: number;
}

export function useGrpcAutoRegister(): GrpcAutoRegisterStatus {
  const [status, setStatus] = useState<GrpcAutoRegisterStatus>({
    isConnected: false,
    isConnecting: false,
    isRegistered: false,
    error: null,
    controllerId: null,
    reconnectAttempts: 0
  });

  useEffect(() => {
    let mounted = true;

    const startGrpcClient = async () => {
      if (!mounted) return;

      setStatus(prev => ({ ...prev, isConnecting: true, error: null }));

      try {
        const client = await grpcClientSingleton.start();
        
        if (mounted) {
          setStatus(prev => ({
            ...prev,
            isConnecting: false,
            controllerId: client.id
          }));
        }
      } catch (error) {
        logger.error('gRPC auto-register hook error:', error);
        
        if (mounted) {
          setStatus(prev => ({
            ...prev,
            isConnecting: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          }));
        }
      }
    };

    // Set up event listeners to update status
    const updateStatus = () => {
      if (!mounted) return;
      
      const currentStatus = grpcClientSingleton.getStatus();
      setStatus(prev => ({
        ...prev,
        isConnected: currentStatus.connected,
        isRegistered: currentStatus.registered,
        controllerId: currentStatus.controllerId || null,
        reconnectAttempts: currentStatus.reconnectAttempts
      }));
    };

    // Initial status update
    updateStatus();

    // Set up periodic status updates
    const statusInterval = setInterval(updateStatus, 2000); // Update every 2 seconds

    // Check if gRPC is enabled - default to true if not explicitly disabled
    const grpcEnabled = process.env.GRPC_ADMIN_ENABLED !== 'false' && 
                       process.env.CONTROLLER_AUTO_REGISTER !== 'false';
    
    logger.info('gRPC auto-register check:', {
      GRPC_ADMIN_ENABLED: process.env.GRPC_ADMIN_ENABLED,
      CONTROLLER_AUTO_REGISTER: process.env.CONTROLLER_AUTO_REGISTER,
      grpcEnabled
    });
    
    if (grpcEnabled) {
      logger.info('gRPC auto-registration enabled, starting client');
      startGrpcClient();
    } else {
      logger.info('gRPC auto-registration disabled');
      setStatus(prev => ({ 
        ...prev, 
        isRegistered: true, // Mark as "done" to avoid UI confusion
        controllerId: 'disabled'
      })); 
    }

    return () => {
      mounted = false;
      clearInterval(statusInterval);
    };
  }, []);

  return status;
}

// Hook for getting current gRPC client status
export function useGrpcClientStatus() {
  const [clientStatus, setClientStatus] = useState(() => grpcClientSingleton.getStatus());

  useEffect(() => {
    const updateStatus = () => {
      setClientStatus(grpcClientSingleton.getStatus());
    };

    // Update status periodically
    const interval = setInterval(updateStatus, 1000);

    return () => clearInterval(interval);
  }, []);

  return clientStatus;
}

// Hook for manually controlling gRPC client
export function useGrpcClientControl() {
  const [loading, setLoading] = useState(false);

  const start = async () => {
    setLoading(true);
    try {
      await grpcClientSingleton.start();
      logger.info('gRPC client started manually');
    } catch (error) {
      logger.error('Failed to start gRPC client manually:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const stop = () => {
    setLoading(true);
    try {
      grpcClientSingleton.stop();
      logger.info('gRPC client stopped manually');
    } finally {
      setLoading(false);
    }
  };

  const restart = async () => {
    setLoading(true);
    try {
      await grpcClientSingleton.restart();
      logger.info('gRPC client restarted manually');
    } catch (error) {
      logger.error('Failed to restart gRPC client manually:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return {
    start,
    stop,
    restart,
    loading
  };
}