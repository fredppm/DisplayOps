import React from 'react';
import { useNotifications } from '@/contexts/NotificationContext';
import { X } from 'lucide-react';

export const GlobalNotifications: React.FC = () => {
  const { notifications, removeNotification } = useNotifications();

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'success': return 'bg-green-100 border-green-400 text-green-700';
      case 'error': return 'bg-red-100 border-red-400 text-red-700';
      case 'warning': return 'bg-yellow-100 border-yellow-400 text-yellow-700';
      case 'info': return 'bg-blue-100 border-blue-400 text-blue-700';
      default: return 'bg-gray-100 border-gray-400 text-gray-700';
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
              className="flex-shrink-0 ml-2 p-1 rounded-full hover:bg-black/10 transition-colors"
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