import React from 'react';
import { clsx } from 'clsx';

interface StatusBadgeProps {
  status: 'online' | 'offline' | 'error' | 'warning' | 'unknown' | 'idle';
  children?: React.ReactNode;
  showDot?: boolean;
  size?: 'sm' | 'md';
}

const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  children,
  showDot = true,
  size = 'md'
}) => {
  const statusConfig = {
    online: {
      bg: 'bg-green-100',
      text: 'text-green-800',
      dot: 'bg-green-500',
      label: 'Online'
    },
    offline: {
      bg: 'bg-gray-100',
      text: 'text-gray-800',
      dot: 'bg-gray-500',
      label: 'Offline'
    },
    error: {
      bg: 'bg-red-100',
      text: 'text-red-800',
      dot: 'bg-red-500',
      label: 'Error'
    },
    warning: {
      bg: 'bg-yellow-100',
      text: 'text-yellow-800',
      dot: 'bg-yellow-500',
      label: 'Warning'
    },
    unknown: {
      bg: 'bg-gray-100',
      text: 'text-gray-800',
      dot: 'bg-gray-400',
      label: 'Unknown'
    },
    idle: {
      bg: 'bg-blue-100',
      text: 'text-blue-800',
      dot: 'bg-blue-500',
      label: 'Idle'
    }
  };

  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1 text-sm'
  };

  const dotSizeClasses = {
    sm: 'w-1.5 h-1.5',
    md: 'w-2 h-2'
  };

  const config = statusConfig[status];

  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full font-medium',
        config.bg,
        config.text,
        sizeClasses[size]
      )}
    >
      {showDot && (
        <span
          className={clsx(
            'rounded-full mr-2',
            config.dot,
            dotSizeClasses[size]
          )}
        />
      )}
      {children || config.label}
    </span>
  );
};

export default StatusBadge;