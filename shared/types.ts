// Shared TypeScript types for ScreenFleet Management System

export interface Dashboard {
  id: string;
  name: string;
  url: string;
  description?: string;
  refreshInterval?: number; // in seconds
  requiresAuth: boolean;
  category?: string;
}

export interface DisplayConfiguration {
  id: string;
  name: string;
  miniPcId: string;
  monitorIndex: number; // 0 or 1 for dual monitor setup
  assignedDashboard?: string; // Dashboard ID
  status: DisplayStatus;
  lastUpdate: Date;
}

export interface MiniPC {
  id: string;
  name: string;
  hostname: string;
  ipAddress: string;
  port: number;
  status: HostStatus;
  lastHeartbeat: Date;
  lastDiscovered: Date;
  version: string;
  displays_legacy: string[]; // Display IDs (legacy - deprecated, use displays instead)
  displays: string[]; // Display IDs (e.g., ['display-1', 'display-2', 'display-3'])
  displayStates?: DisplayState[]; // Detailed display states from gRPC heartbeats
  mdnsService?: MDNSServiceInfo;
}

export interface MDNSServiceInfo {
  serviceName: string; // "_screenfleet._tcp.local"
  instanceName: string; // "ScreenFleet-Agent-01._screenfleet._tcp.local"
  txtRecord: Record<string, string>; // Additional metadata
  addresses: string[]; // IP addresses
  port: number;
}

export interface HostStatus {
  online: boolean;
  cpuUsage: number;
  memoryUsage: number;
  browserProcesses: number;
  lastError?: string;
  debugEnabled?: boolean;
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
  assignedDashboard?: {
    dashboardId: string;
    url: string;
    refreshInterval?: number;
    deployedAt?: string;
  };
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
  targetDisplay: string;
  payload: any;
  timestamp: Date;
}

export enum CommandType {
  OPEN_DASHBOARD = 'open_dashboard',
  REFRESH_PAGE = 'refresh_page',
  SYNC_COOKIES = 'sync_cookies',
  HEALTH_CHECK = 'health_check',
  UPDATE_AGENT = 'update_agent',
  RESTART_BROWSER = 'restart_browser',
  TAKE_SCREENSHOT = 'take_screenshot',
  IDENTIFY_DISPLAYS = 'identify_displays',
  DEBUG_ENABLE = 'debug_enable',
  DEBUG_DISABLE = 'debug_disable'
}

export interface OpenDashboardCommand {
  dashboardId: string;
  url: string;
  monitorIndex: number;
  fullscreen: boolean;
  refreshInterval?: number; // in milliseconds
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
  hostStatus: HostStatus;
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
  displays: DisplayConfiguration[];
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
export class ScreenFleetError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'ScreenFleetError';
  }
}

export class BrowserError extends ScreenFleetError {
  constructor(message: string, details?: any) {
    super(message, 'BROWSER_ERROR', details);
  }
}

export class NetworkError extends ScreenFleetError {
  constructor(message: string, details?: any) {
    super(message, 'NETWORK_ERROR', details);
  }
}

export class ConfigurationError extends ScreenFleetError {
  constructor(message: string, details?: any) {
    super(message, 'CONFIG_ERROR', details);
  }
}
