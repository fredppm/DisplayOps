// Shared TypeScript types for Office TV Management System
// Local copy from shared directory for Next.js compatibility

export interface Dashboard {
  id: string;
  name: string;
  url: string;
  description?: string;
  refreshInterval?: number; // in seconds
  requiresAuth: boolean;
  category?: string;
}


export interface MiniPC {
  id: string;
  name: string;
  hostname: string; // DNS name (e.g., 'VTEX-B9LH6Z3')
  ipAddress: string; // IP address (e.g., '192.168.1.227')
  port: number;
  metrics: HostMetrics;
  debugEnabled?: boolean;
  lastHeartbeat: Date;
  lastDiscovered: Date;
  version: string;
  displays: string[]; // Display IDs (e.g., ['display-1', 'display-2', 'display-3'])
  displayStates?: DisplayState[]; // Detailed display states from gRPC heartbeats
  mdnsService?: MDNSServiceInfo;
}

export interface MDNSServiceInfo {
  serviceName: string; // "_officetv._tcp.local"
  instanceName: string; // "Office-TV-Agent-01._officetv._tcp.local"
  txtRecord: Record<string, string>; // Additional metadata
  addresses: string[]; // IP addresses
  port: number;
}

export interface HostMetrics {
  online: boolean;
  cpuUsage: number;
  memoryUsage: number;
  browserProcesses: number;
  lastError?: string;
}


// Display Status type for individual displays
export interface DisplayStatus {
  active: boolean;
  currentUrl?: string;
  lastRefresh: Date;
  isResponsive: boolean;
  errorCount: number;
  lastError?: string;
  windowId?: string; // ID of the Electron window managing this display
}

// mDNS Discovery Types
export interface DiscoveryEvent {
  type: 'service-up' | 'service-down' | 'service-updated';
  service: MDNSServiceInfo;
  timestamp: Date;
}

export interface DiscoveryService {
  serviceName: string;
  isActive: boolean;
  discoveredAgents: Map<string, MiniPC>;
  onServiceUp: (service: MDNSServiceInfo) => void;
  onServiceDown: (service: MDNSServiceInfo) => void;
  onServiceUpdated: (service: MDNSServiceInfo) => void;
}

// API Command Types
export interface ApiCommand {
  type: CommandType;
  targetTv: string;
  targetDisplay?: string; // Add targetDisplay property
  payload: any;
  timestamp: Date;
}

// Display State from gRPC heartbeats
export interface DisplayState {
  id: string;
  isActive: boolean;
  assignedDashboard?: {
    dashboardId: string;
    url: string;
  } | null;
}

export enum CommandType {
  OPEN_DASHBOARD = 'open_dashboard',
  REFRESH_PAGE = 'refresh_page',
  SYNC_COOKIES = 'sync_cookies',
  HEALTH_CHECK = 'health_check',
  UPDATE_AGENT = 'update_agent',
  RESTART_BROWSER = 'restart_browser',
  TAKE_SCREENSHOT = 'take_screenshot',
  IDENTIFY_DISPLAYS = 'identify_displays'
}

export interface OpenDashboardCommand {
  display_id: string;
  dashboard_id: string;
  url: string;
  fullscreen: boolean;
  refresh_interval_ms?: number;
}

export interface SyncCookiesCommand {
  cookies: CookieData[];
  domain: string;
}

export interface IdentifyDisplaysCommand {
  duration?: number; // Duration in seconds to show identification
  pattern?: 'blink' | 'highlight' | 'message'; // Visual pattern to use
  fontSize?: number; // Font size for identification text
  backgroundColor?: string; // Background color for identification overlay
}

export interface CookieData {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires?: number;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'Strict' | 'Lax' | 'None';
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: Date;
}

export interface HealthCheckResponse {
  hostMetrics: HostMetrics;
  displayStatuses: DisplayStatus[];
  systemInfo: {
    uptime: number;
    platform: string;
    nodeVersion: string;
    agentVersion: string;
  };
}

// Configuration Types
export interface SystemConfiguration {
  dashboards: Dashboard[];
  miniPCs: MiniPC[];
  settings: SystemSettings;
}

export interface SystemSettings {
  defaultRefreshInterval: number;
  healthCheckInterval: number;
  cookieSyncInterval: number;
  maxErrorCount: number;
  screenshotEnabled: boolean;
  autoUpdateEnabled: boolean;
}

// Error Types
export class OfficetvError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'OfficetvError';
  }
}

export class BrowserError extends OfficetvError {
  constructor(message: string, details?: any) {
    super(message, 'BROWSER_ERROR', details);
  }
}

export class NetworkError extends OfficetvError {
  constructor(message: string, details?: any) {
    super(message, 'NETWORK_ERROR', details);
  }
}

export class ConfigurationError extends OfficetvError {
  constructor(message: string, details?: any) {
    super(message, 'CONFIG_ERROR', details);
  }
}