export interface DebugOverlayConfig {
  enabled: boolean;
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  opacity: number;
  width: number;
  height: number;
  alwaysOnTop: boolean;
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

export interface MdnsDebugInfo {
  serviceStatus: 'advertising' | 'stopped' | 'error';
  discoveredHosts: number;
  lastAdvertisement?: Date;
  networkInterface?: string;
  serviceData?: {
    name: string;
    type: string;
    port: number;
    txt: Record<string, string>;
  };
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
