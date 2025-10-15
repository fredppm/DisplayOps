import { AuthUser } from './auth-postgres';

export type Permission = 
  // Sites permissions
  | 'sites:read'
  | 'sites:create'
  | 'sites:update' 
  | 'sites:delete'
  
  // Hosts permissions
  | 'hosts:read'
  | 'hosts:create'
  | 'hosts:update'
  | 'hosts:delete'
  | 'hosts:command'
  
  // Dashboard permissions
  | 'dashboards:read'
  | 'dashboards:create'
  | 'dashboards:update'
  | 'dashboards:delete'
  | 'dashboards:assign'
  
  // Admin permissions
  | 'admin:users'
  | 'admin:system'
  | 'admin:audit'
  | 'admin:settings'
  | 'audit:read'
  | 'health:read'
  | 'sync:write'
  
  // Monitoring permissions
  | 'monitoring:read'
  | 'monitoring:metrics'
  | 'monitoring:logs'
  | 'metrics:read'
  | 'metrics:write'
  
  // Alerts permissions
  | 'alerts:read'
  | 'alerts:write'
  | 'alerts:acknowledge';

export type Role = 'admin' | 'site-manager' | 'viewer';

// Role-based permissions matrix
const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  admin: [
    // All permissions for admin
    'sites:read', 'sites:create', 'sites:update', 'sites:delete',
    'hosts:read', 'hosts:create', 'hosts:update', 'hosts:delete', 'hosts:command',
    'dashboards:read', 'dashboards:create', 'dashboards:update', 'dashboards:delete', 'dashboards:assign',
    'admin:users', 'admin:system', 'admin:audit', 'admin:settings',
    'monitoring:read', 'monitoring:metrics', 'monitoring:logs',
    'metrics:read', 'metrics:write',
    'alerts:read', 'alerts:write', 'alerts:acknowledge'
  ],
  
  'site-manager': [
    // Site managers can manage their assigned sites
    'sites:read',
    'hosts:read', 'hosts:update', 'hosts:command',
    'dashboards:read', 'dashboards:create', 'dashboards:update', 'dashboards:delete', 'dashboards:assign',
    'monitoring:read', 'monitoring:metrics', 'monitoring:logs',
    'metrics:read',
    'alerts:read', 'alerts:acknowledge'
  ],
  
  viewer: [
    // Viewers can only read
    'sites:read',
    'hosts:read',
    'dashboards:read',
    'monitoring:read', 'monitoring:metrics',
    'alerts:read'
  ]
};

/**
 * Check if user has a specific permission
 */
export function hasPermission(user: AuthUser, permission: Permission): boolean {
  const rolePermissions = ROLE_PERMISSIONS[user.role as Role];
  return rolePermissions?.includes(permission) || false;
}

/**
 * Check if user has permission for a specific site
 */
export function hasSitePermission(user: AuthUser, siteId: string, permission: Permission): boolean {
  // First check if user has the base permission
  if (!hasPermission(user, permission)) {
    return false;
  }

  // Admin has access to all sites
  if (user.role === 'admin' || user.sites.includes('*')) {
    return true;
  }

  // Check if user has access to the specific site
  return user.sites.includes(siteId);
}

/**
 * Filter sites that user has access to
 */
export function getAccessibleSites(user: AuthUser, allSites: string[]): string[] {
  if (user.role === 'admin' || user.sites.includes('*')) {
    return allSites;
  }

  return allSites.filter(siteId => user.sites.includes(siteId));
}

/**
 * Check if user can manage other users
 */
export function canManageUsers(user: AuthUser): boolean {
  return hasPermission(user, 'admin:users');
}

/**
 * Check if user can access system settings
 */
export function canAccessAdmin(user: AuthUser): boolean {
  return hasPermission(user, 'admin:system');
}

/**
 * Get user role display information
 */
export function getRoleInfo(role: Role) {
  const roleInfo = {
    admin: {
      name: 'Administrator',
      description: 'Full system access',
      color: 'red',
      icon: '👑'
    },
    'site-manager': {
      name: 'Site Manager',
      description: 'Manages specific sites',
      color: 'blue',
      icon: '👨‍💼'
    },
    viewer: {
      name: 'Viewer',
      description: 'Read-only access',
      color: 'green',
      icon: '👁️'
    }
  };

  return roleInfo[role];
}

/**
 * Get all available permissions for a role
 */
export function getRolePermissions(role: Role): Permission[] {
  return ROLE_PERMISSIONS[role] || [];
}

/**
 * Validate if user can perform action on resource
 */
export function validateAction(
  user: AuthUser,
  action: Permission,
  resource?: { siteId?: string }
): { allowed: boolean; reason?: string } {
  // Check base permission
  if (!hasPermission(user, action)) {
    return {
      allowed: false,
      reason: `Role '${user.role}' does not have permission '${action}'`
    };
  }

  // Check site-specific permission if needed
  if (resource?.siteId && !hasSitePermission(user, resource.siteId, action)) {
    return {
      allowed: false,
      reason: `User does not have access to site '${resource.siteId}'`
    };
  }

  return { allowed: true };
}