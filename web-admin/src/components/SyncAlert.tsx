import React, { useState, useEffect } from 'react';

interface SyncAlert {
  id: string;
  type: 'warning' | 'error' | 'info' | 'success';
  title: string;
  message: string;
  timestamp: string;
  controllerId?: string;
  autoHide?: boolean;
  duration?: number; // milliseconds
}

interface SyncAlertProps {
  alert: SyncAlert;
  onClose: (id: string) => void;
}

const getAlertStyles = (type: SyncAlert['type']) => {
  switch (type) {
    case 'success':
      return {
        container: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
        icon: '✅',
        title: 'text-green-800 dark:text-green-200',
        message: 'text-green-700 dark:text-green-300',
        button: 'text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-200'
      };
    case 'warning':
      return {
        container: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800',
        icon: '⚠️',
        title: 'text-yellow-800 dark:text-yellow-200',
        message: 'text-yellow-700 dark:text-yellow-300',
        button: 'text-yellow-600 hover:text-yellow-800 dark:text-yellow-400 dark:hover:text-yellow-200'
      };
    case 'error':
      return {
        container: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
        icon: '❌',
        title: 'text-red-800 dark:text-red-200',
        message: 'text-red-700 dark:text-red-300',
        button: 'text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-200'
      };
    case 'info':
    default:
      return {
        container: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
        icon: 'ℹ️',
        title: 'text-blue-800 dark:text-blue-200',
        message: 'text-blue-700 dark:text-blue-300',
        button: 'text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200'
      };
  }
};

const formatTimeAgo = (timestamp: string): string => {
  const now = new Date().getTime();
  const alertTime = new Date(timestamp).getTime();
  const diffMs = now - alertTime;
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 1) return 'agora mesmo';
  if (diffMins === 1) return '1 minuto atrás';
  if (diffMins < 60) return `${diffMins} minutos atrás`;
  
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours === 1) return '1 hora atrás';
  if (diffHours < 24) return `${diffHours} horas atrás`;
  
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return '1 dia atrás';
  return `${diffDays} dias atrás`;
};

export function SyncAlert({ alert, onClose }: SyncAlertProps) {
  const [isVisible, setIsVisible] = useState(true);
  const styles = getAlertStyles(alert.type);

  useEffect(() => {
    if (alert.autoHide && alert.duration) {
      const timer = setTimeout(() => {
        setIsVisible(false);
        setTimeout(() => onClose(alert.id), 300); // Allow fade-out animation
      }, alert.duration);

      return () => clearTimeout(timer);
    }
  }, [alert.autoHide, alert.duration, alert.id, onClose]);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(() => onClose(alert.id), 300); // Allow fade-out animation
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div className={`
      border rounded-lg p-4 shadow-sm transition-all duration-300 ease-in-out
      ${styles.container}
      ${isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}
    `}>
      <div className="flex items-start gap-3">
        <span className="text-lg flex-shrink-0">{styles.icon}</span>
        <div className="flex-1 min-w-0">
          <div className={`font-medium ${styles.title}`}>
            {alert.title}
          </div>
          <div className={`text-sm mt-1 ${styles.message}`}>
            {alert.message}
          </div>
          <div className="flex items-center justify-between mt-2">
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {formatTimeAgo(alert.timestamp)}
              {alert.controllerId && (
                <span className="ml-2">• Controller: {alert.controllerId}</span>
              )}
            </div>
          </div>
        </div>
        <button
          onClick={handleClose}
          className={`
            flex-shrink-0 text-lg hover:bg-black/5 dark:hover:bg-white/5 
            rounded p-1 transition-colors ${styles.button}
          `}
          aria-label="Fechar alerta"
        >
          ×
        </button>
      </div>
    </div>
  );
}

// Container component for managing multiple alerts
interface SyncAlertManagerProps {
  alerts: SyncAlert[];
  maxAlerts?: number;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
}

const getPositionStyles = (position: SyncAlertManagerProps['position']) => {
  switch (position) {
    case 'top-left':
      return 'top-4 left-4';
    case 'bottom-right':
      return 'bottom-4 right-4';
    case 'bottom-left':
      return 'bottom-4 left-4';
    case 'top-right':
    default:
      return 'top-4 right-4';
  }
};

export function SyncAlertManager({ 
  alerts, 
  maxAlerts = 5, 
  position = 'top-right' 
}: SyncAlertManagerProps) {
  const [visibleAlerts, setVisibleAlerts] = useState<SyncAlert[]>([]);

  useEffect(() => {
    // Show only the most recent alerts up to maxAlerts
    const recentAlerts = alerts
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, maxAlerts);
    
    setVisibleAlerts(recentAlerts);
  }, [alerts, maxAlerts]);

  const handleCloseAlert = (alertId: string) => {
    setVisibleAlerts(prev => prev.filter(alert => alert.id !== alertId));
  };

  if (visibleAlerts.length === 0) {
    return null;
  }

  return (
    <div className={`
      fixed z-50 w-80 max-w-sm
      ${getPositionStyles(position)}
    `}>
      <div className="space-y-3">
        {visibleAlerts.map((alert) => (
          <SyncAlert
            key={alert.id}
            alert={alert}
            onClose={handleCloseAlert}
          />
        ))}
      </div>
    </div>
  );
}

// Utility function to create different types of sync alerts
export const createSyncAlert = {
  dashboardSyncComplete: (controllerId: string, dashboardCount: number): SyncAlert => ({
    id: `dashboard-sync-${controllerId}-${Date.now()}`,
    type: 'success',
    title: 'Dashboard Sync Completo',
    message: `${dashboardCount} dashboard(s) sincronizado(s) com ${controllerId}`,
    timestamp: new Date().toISOString(),
    controllerId,
    autoHide: true,
    duration: 5000
  }),

  cookieSyncComplete: (controllerId: string, domainCount: number): SyncAlert => ({
    id: `cookie-sync-${controllerId}-${Date.now()}`,
    type: 'success',
    title: 'Cookie Sync Completo',
    message: `Cookies de ${domainCount} domínio(s) sincronizado(s) com ${controllerId}`,
    timestamp: new Date().toISOString(),
    controllerId,
    autoHide: true,
    duration: 5000
  }),

  controllerOffline: (controllerId: string, name: string): SyncAlert => {
    // Suppressed: No longer showing controller offline alerts
    return null as any;
  },

  grpcServerDown: (): SyncAlert => {
    // Suppressed: No longer showing gRPC server down alerts
    return null as any;
  },

  syncPending: (controllerId: string, name: string, syncTypes: string[]): SyncAlert => ({
    id: `sync-pending-${controllerId}-${Date.now()}`,
    type: 'info',
    title: 'Sync Pendente',
    message: `${name} tem sync pendente: ${syncTypes.join(', ')}`,
    timestamp: new Date().toISOString(),
    controllerId
  })
};