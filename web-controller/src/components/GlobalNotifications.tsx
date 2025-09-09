import React from 'react';
import { useNotifications } from '@/contexts/NotificationContext';
import { X } from 'lucide-react';

export const GlobalNotifications: React.FC = () => {
  const { notifications, removeNotification } = useNotifications();

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'success': return 'bg-green-100 dark:bg-green-900 border-green-400 dark:border-green-600 text-green-700 dark:text-green-300';
      case 'error': return 'bg-red-100 dark:bg-red-900 border-red-400 dark:border-red-600 text-red-700 dark:text-red-300';
      case 'warning': return 'bg-yellow-100 dark:bg-yellow-900 border-yellow-400 dark:border-yellow-600 text-yellow-700 dark:text-yellow-300';
      case 'info': return 'bg-blue-100 dark:bg-blue-900 border-blue-400 dark:border-blue-600 text-blue-700 dark:text-blue-300';
      default: return 'bg-gray-100 dark:bg-gray-800 border-gray-400 dark:border-gray-600 text-gray-700 dark:text-gray-300';
    }
  };

  if (notifications.length === 0) {
    return null;
  }

  return (
    <div className="fixed top-20 right-4 z-[9999] space-y-3 max-w-sm">
      {notifications.map((notification, index) => (
        <div
          key={notification.id}
          className={`
            border-l-4 p-4 rounded-lg shadow-lg backdrop-blur-sm 
            transform transition-all duration-300 ease-in-out
            animate-in slide-in-from-right-5 fade-in
            ${getNotificationColor(notification.type)}
          `}
          style={{ 
            animationDelay: `${index * 100}ms`,
            zIndex: 10000 + index
          }}
        >
          <div className="flex justify-between items-start">
            <div className="flex-1 pr-3">
              <p className="font-semibold text-sm">{notification.title}</p>
              <p className="text-sm mt-1 opacity-90">{notification.message}</p>
            </div>
            <button
              onClick={() => removeNotification(notification.id)}
              className="flex-shrink-0 ml-2 p-1 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
              aria-label="Close notification"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};