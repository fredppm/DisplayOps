// Multi-site specific types for DisplayOps Admin

export interface Site {
  id: string;
  name: string;
  location: string;
  timezone: string;
  status: 'online' | 'offline' | 'error';
  controllers: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Controller {
  id: string;
  siteId: string;
  name: string;
  localNetwork: string;
  mdnsService: string;
  controllerUrl: string;
  status: 'online' | 'offline' | 'error';
  lastSync: string;
  version: string;
}

// Dashboard configuration for multi-site
export interface MultiSiteDashboard {
  id: string;
  name: string;
  url: string;
  description?: string;
  category?: string;
  requiresAuth: boolean;
  refreshInterval?: number;
  siteRestrictions?: string[]; // Site IDs where this dashboard can be used
  controllerRestrictions?: string[]; // Controller IDs where this dashboard can be used
}

// User management for multi-site
export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'site-manager' | 'viewer';
  siteAccess: string[]; // Site IDs the user can access
  createdAt: string;
  updatedAt: string;
  lastLogin?: string;
}

// Site statistics and health metrics
export interface SiteMetrics {
  siteId: string;
  totalControllers: number;
  onlineControllers: number;
  totalHostAgents: number;
  onlineHostAgents: number;
  totalDisplays: number;
  activeDisplays: number;
  lastUpdated: string;
}

// Controller health and synchronization status
export interface ControllerHealth {
  controllerId: string;
  status: 'online' | 'offline' | 'error' | 'syncing';
  lastHeartbeat?: string;
  lastSync?: string;
  syncStatus: 'success' | 'failed' | 'pending';
  hostAgents: number;
  displays: number;
  version: string;
  uptime?: number;
  errors?: string[];
}

// Synchronization logs and audit trail
export interface SyncLog {
  id: string;
  controllerId: string;
  timestamp: string;
  type: 'configuration' | 'dashboards' | 'commands' | 'heartbeat';
  status: 'success' | 'failed' | 'pending';
  data?: any;
  error?: string;
  duration?: number;
}

// Configuration management
export interface ConfigurationProfile {
  id: string;
  name: string;
  description?: string;
  dashboards: MultiSiteDashboard[];
  settings: {
    defaultRefreshInterval: number;
    healthCheckInterval: number;
    cookieSyncInterval: number;
    maxErrorCount: number;
    screenshotEnabled: boolean;
  };
  appliedToSites: string[];
  createdAt: string;
  updatedAt: string;
  version: number;
}

// API request/response types for multi-site operations
export interface CreateSiteRequest {
  name: string;
  location: string;
  timezone: string;
}

export interface UpdateSiteRequest {
  name?: string;
  location?: string;
  timezone?: string;
}

export interface CreateControllerRequest {
  siteId: string;
  name: string;
  localNetwork: string;
  mdnsService?: string;
  controllerUrl?: string;
}

export interface UpdateControllerRequest {
  name?: string;
  localNetwork?: string;
  mdnsService?: string;
  controllerUrl?: string;
}

// Response wrappers
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Health check aggregation
export interface SystemHealth {
  overall: 'healthy' | 'warning' | 'critical';
  sites: {
    total: number;
    healthy: number;
    warning: number;
    critical: number;
  };
  controllers: {
    total: number;
    online: number;
    offline: number;
    error: number;
  };
  hostAgents: {
    total: number;
    online: number;
    offline: number;
  };
  displays: {
    total: number;
    active: number;
    inactive: number;
  };
  lastUpdated: string;
}

// Event types for real-time updates
export interface SystemEvent {
  id: string;
  type: 'site-added' | 'site-updated' | 'site-deleted' | 
        'controller-online' | 'controller-offline' | 'controller-error' |
        'host-agent-connected' | 'host-agent-disconnected' |
        'display-activated' | 'display-deactivated' |
        'sync-completed' | 'sync-failed';
  siteId?: string;
  controllerId?: string;
  hostAgentId?: string;
  displayId?: string;
  data?: any;
  timestamp: string;
}

// Form validation schemas (for use with libraries like Zod)
export interface SiteFormData {
  name: string;
  location: string;
  timezone: string;
}

export interface ControllerFormData {
  siteId: string;
  name: string;
  localNetwork: string;
  mdnsService: string;
}

// Error types specific to multi-site operations
export class MultiSiteError extends Error {
  constructor(
    message: string,
    public code: string,
    public siteId?: string,
    public controllerId?: string
  ) {
    super(message);
    this.name = 'MultiSiteError';
  }
}

export class SynchronizationError extends MultiSiteError {
  constructor(message: string, controllerId: string) {
    super(message, 'SYNC_ERROR', undefined, controllerId);
  }
}

export class ControllerConnectionError extends MultiSiteError {
  constructor(message: string, controllerId: string) {
    super(message, 'CONTROLLER_CONNECTION_ERROR', undefined, controllerId);
  }
}