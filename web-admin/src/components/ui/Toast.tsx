import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, AlertTriangle, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning';

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

interface ToastComponentProps {
  toast: Toast;
  onRemove: (id: string) => void;
}

const ToastComponent: React.FC<ToastComponentProps> = ({ toast, onRemove }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);

  useEffect(() => {
    // Animate in
    setTimeout(() => setIsVisible(true), 100);

    // Auto remove
    const duration = toast.duration || 5000;
    const timer = setTimeout(() => {
      handleRemove();
    }, duration);

    return () => clearTimeout(timer);
  }, []);

  const handleRemove = () => {
    setIsRemoving(true);
    setTimeout(() => {
      onRemove(toast.id);
    }, 300);
  };

  const getIcon = () => {
    const iconClass = `h-5 w-5 ${getIconStyles()}`;
    switch (toast.type) {
      case 'success':
        return <CheckCircle className={iconClass} />;
      case 'error':
        return <XCircle className={iconClass} />;
      case 'warning':
        return <AlertTriangle className={iconClass} />;
    }
  };

  const getStyles = () => {
    switch (toast.type) {
      case 'success':
        return "bg-green-100 border border-green-200 dark:bg-green-900 dark:border-green-700";
      case 'error':
        return "bg-red-100 border border-red-200 dark:bg-red-900 dark:border-red-700";
      case 'warning':
        return "bg-yellow-100 border border-yellow-200 dark:bg-yellow-900 dark:border-yellow-700";
    }
  };

  const getIconStyles = () => {
    switch (toast.type) {
      case 'success':
        return "text-green-600 dark:text-green-400";
      case 'error':
        return "text-red-600 dark:text-red-400";
      case 'warning':
        return "text-yellow-600 dark:text-yellow-400";
    }
  };

  const getTextStyles = () => {
    switch (toast.type) {
      case 'success':
        return "text-green-800 dark:text-green-200";
      case 'error':
        return "text-red-800 dark:text-red-200";
      case 'warning':
        return "text-yellow-800 dark:text-yellow-200";
    }
  };

  return (
    <div
      className={`
        w-96 rounded-lg shadow-lg pointer-events-auto overflow-hidden transition-all duration-300 ease-in-out transform
        ${isVisible && !isRemoving ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}
        ${getStyles()}
      `}
    >
      <div className="p-4">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            {getIcon()}
          </div>
          <div className="ml-3 w-0 flex-1">
            <p className={`text-sm font-medium ${getTextStyles()}`}>
              {toast.title}
            </p>
            {toast.message && (
              <p className={`mt-1 text-sm ${getTextStyles()}`}>
                {toast.message}
              </p>
            )}
          </div>
          <div className="ml-4 flex-shrink-0 flex">
            <button
              className={`rounded-md inline-flex ${getTextStyles()} hover:opacity-75 focus:outline-none focus:ring-2 focus:ring-offset-2`}
              onClick={handleRemove}
            >
              <span className="sr-only">Close</span>
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

interface ToastContainerProps {
  toasts: Toast[];
  onRemove: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onRemove }) => {
  return (
    <div className="fixed top-4 right-4 z-50 space-y-4 pointer-events-none">
      {toasts.map((toast) => (
        <ToastComponent 
          key={toast.id} 
          toast={toast} 
          onRemove={onRemove} 
        />
      ))}
    </div>
  );
};

export default ToastComponent;