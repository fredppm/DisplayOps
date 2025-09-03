import { useEffect } from 'react';
import { useToastStore } from '@/stores/toastStore';
import { useToastContext } from '@/contexts/ToastContext';

export const usePendingToasts = () => {
  const { consumePendingToasts } = useToastStore();
  const toast = useToastContext();

  useEffect(() => {
    // Só roda no client-side (evita problemas SSR)
    if (typeof window !== 'undefined') {
      const pendingToasts = consumePendingToasts();
      
      pendingToasts.forEach((pendingToast) => {
        switch (pendingToast.type) {
          case 'success':
            toast.success(pendingToast.message);
            break;
          case 'error':
            toast.error(pendingToast.message);
            break;
          case 'warning':
            toast.warning(pendingToast.message);
            break;
        }
      });
    }
  }, []); // Roda só uma vez no mount
};