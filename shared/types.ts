// Shared TypeScript types for Office TV Management System

export interface Dashboard {
  id: string;
  name: string;
  url: string;
  description?: string;
  refreshInterval?: number; // in seconds
  requiresAuth: boolean;
  category?: string;
}

export interface TVConfiguration {
  id: string;
  name: string;
  miniPcId: string;
  monitorIndex: number; // 0 or 1 for dual monitor setup
  assignedDashboard?: string; // Dashboard ID
  status: TVStatus;
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
  tvs: string[]; // TV IDs
  mdnsService?: MDNSServiceInfo;
}

export interface MDNSServiceInfo {
  serviceName: string; // "_officetv._tcp.local"
  instanceName: string; // "Office-TV-Agent-01._officetv._tcp.local"
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
}

export interface TVStatus {
  active: boolean;
  currentUrl?: string;
  lastRefresh: Date;
  isResponsive: boolean;
  errorCount: number;
  lastError?: string;
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
  TAKE_SCREENSHOT = 'take_screenshot'
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
  tvStatuses: TVStatus[];
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
  tvs: TVConfiguration[];
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
