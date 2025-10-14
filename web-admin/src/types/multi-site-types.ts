// Multi-site specific types for DisplayOps Admin

export interface Site {
  id: string;
  name: string;
  location: string;
  timezone: string;
  status: 'online' | 'offline' | 'error';
  createdAt: string;
  updatedAt: string;
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
  totalHostAgents: number;
  onlineHostAgents: number;
  totalDisplays: number;
  activeDisplays: number;
  lastUpdated: string;
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
        'host-agent-connected' | 'host-agent-disconnected' |
        'display-activated' | 'display-deactivated';
  siteId?: string;
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

// Error types specific to multi-site operations
export class MultiSiteError extends Error {
  constructor(
    message: string,
    public code: string,
    public siteId?: string
  ) {
    super(message);
    this.name = 'MultiSiteError';
  }
}