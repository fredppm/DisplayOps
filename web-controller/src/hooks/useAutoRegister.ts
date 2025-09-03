import { useEffect, useState } from 'react';
import { autoRegisterService } from '../lib/auto-register';
import { logger } from '../lib/logger';

export interface AutoRegisterStatus {
  isRegistered: boolean;
  isRegistering: boolean;
  error: string | null;
  retryCount: number;
}

export function useAutoRegister(): AutoRegisterStatus {
  const [status, setStatus] = useState<AutoRegisterStatus>({
    isRegistered: false,
    isRegistering: false,
    error: null,
    retryCount: 0
  });

  useEffect(() => {
    let mounted = true;

    const performRegistration = async () => {
      if (!mounted) return;

      setStatus(prev => ({ ...prev, isRegistering: true, error: null }));

      try {
        const success = await autoRegisterService.register();
        
        if (mounted) {
          setStatus(prev => ({
            ...prev,
            isRegistered: success,
            isRegistering: false,
            error: success ? null : 'Registration failed'
          }));
        }
      } catch (error) {
        logger.error('Auto-register hook error:', error);
        
        if (mounted) {
          setStatus(prev => ({
            ...prev,
            isRegistering: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          }));
        }
      }
    };

    // Only attempt registration if auto-register is enabled
    const autoRegisterEnabled = process.env.CONTROLLER_AUTO_REGISTER === 'true';
    
    if (autoRegisterEnabled) {
      logger.info('Auto-registration enabled, starting registration process');
      performRegistration();
    } else {
      logger.info('Auto-registration disabled');
      setStatus(prev => ({ ...prev, isRegistered: true })); // Mark as "done" to avoid UI confusion
    }

    return () => {
      mounted = false;
    };
  }, []);

  return status;
}