export interface DebugOverlayConfig {
  enabled: boolean;
  position: 'left' | 'right';
  opacity: number;
  hotkey: string;
}

export interface DebugOverlayState {
  visible: boolean;
  pinned: boolean;
  collapsed: boolean;
  activeTab: 'events' | 'metrics' | 'system';
}

export interface CommandDebugInfo {
  commandId: string;
  type: string;
  targetTv?: string;
  payload?: any;
  startTime: Date;
  endTime?: Date;
  success?: boolean;
  error?: string;
  duration?: number;
}

export interface WindowDebugInfo {
  windowId: string;
  url?: string;
  status: 'creating' | 'loading' | 'ready' | 'error' | 'closed';
  display?: string;
  bounds?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  lastActivity?: Date;
}

export interface PerformanceMetrics {
  memoryUsage: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
  };
  cpuUsage: {
    user: number;
    system: number;
  };
  eventLoopDelay: number;
  uptime: number;
  loadAverage: number[];
}

export interface DebugNotification {
  id: string;
  type: 'info' | 'warning' | 'error' | 'success';
  title: string;
  message: string;
  timestamp: Date;
  autoHide?: boolean;
  duration?: number;
}
