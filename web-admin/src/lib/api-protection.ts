import { NextApiRequest, NextApiResponse } from 'next';
import { verifyToken, AuthUser } from './auth';
import { hasPermission, Permission } from './permissions';

export interface ProtectedApiRequest extends NextApiRequest {
  user: AuthUser;
}

export type ApiHandler = (req: ProtectedApiRequest, res: NextApiResponse) => Promise<void> | void;

/**
 * Middleware to protect API routes with authentication
 */
export function withAuth(handler: ApiHandler) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    // Get token from cookie
    const token = req.cookies['auth-token'];
    
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Verify token
    const user = verifyToken(token);
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // Add user to request
    (req as ProtectedApiRequest).user = user;

    return handler(req as ProtectedApiRequest, res);
  };
}

/**
 * Middleware to protect API routes with specific permission
 */
export function withPermission(permission: Permission) {
  return function(handler: ApiHandler) {
    return withAuth(async (req: ProtectedApiRequest, res: NextApiResponse) => {
      const user = req.user;

      // Check permission
      if (!hasPermission(user, permission)) {
        return res.status(403).json({ 
          error: 'Insufficient permissions',
          required: permission,
          userRole: user.role
        });
      }

      return handler(req, res);
    });
  };
}

/**
 * Middleware to protect API routes with multiple permissions (user needs at least one)
 */
export function withAuthAndPermissions(permissions: Permission[], handler: ApiHandler) {
  return withAuth(async (req: ProtectedApiRequest, res: NextApiResponse) => {
    const user = req.user;

    // Check if user has at least one of the required permissions
    const hasAnyPermission = permissions.some(permission => hasPermission(user, permission));
    
    if (!hasAnyPermission) {
      return res.status(403).json({ 
        error: 'Insufficient permissions',
        required: permissions,
        userRole: user.role
      });
    }

    return handler(req, res);
  });
}

/**
 * Middleware to protect API routes for admin only
 */
export function withAdminOnly(handler: ApiHandler) {
  return withAuth(async (req: ProtectedApiRequest, res: NextApiResponse) => {
    const user = req.user;

    if (user.role !== 'admin') {
      return res.status(403).json({ 
        error: 'Admin privileges required',
        userRole: user.role
      });
    }

    return handler(req, res);
  });
}

/**
 * Middleware to protect API routes with site-specific permission
 */
export function withSitePermission(permission: Permission) {
  return function(handler: ApiHandler) {
    return withAuth(async (req: ProtectedApiRequest, res: NextApiResponse) => {
      const user = req.user;
      const siteId = req.query.siteId as string;

      // Check base permission
      if (!hasPermission(user, permission)) {
        return res.status(403).json({ 
          error: 'Insufficient permissions',
          required: permission,
          userRole: user.role
        });
      }

      // Check site access if siteId is provided
      if (siteId && user.role !== 'admin' && !user.sites.includes('*')) {
        if (!user.sites.includes(siteId)) {
          return res.status(403).json({ 
            error: 'Site access denied',
            siteId,
            userSites: user.sites
          });
        }
      }

      return handler(req, res);
    });
  };
}

/**
 * Helper to get current user from request (must be used after withAuth)
 */
export function getCurrentUser(req: ProtectedApiRequest): AuthUser {
  return req.user;
}

/**
 * Rate limiting helper (basic implementation)
 */
const requestCounts = new Map<string, { count: number; timestamp: number }>();

export function withRateLimit(maxRequests: number = 100, windowMs: number = 60000) {
  return function(handler: ApiHandler) {
    return async (req: ProtectedApiRequest, res: NextApiResponse) => {
      const clientIp = req.headers['x-forwarded-for'] || req.connection?.remoteAddress || 'unknown';
      const key = `${clientIp}:${req.user?.id || 'anonymous'}`;
      
      const now = Date.now();
      const record = requestCounts.get(key);
      
      if (!record || now - record.timestamp > windowMs) {
        // Reset window
        requestCounts.set(key, { count: 1, timestamp: now });
      } else if (record.count >= maxRequests) {
        return res.status(429).json({ 
          error: 'Rate limit exceeded',
          retryAfter: Math.ceil((windowMs - (now - record.timestamp)) / 1000)
        });
      } else {
        record.count++;
      }

      return handler(req, res);
    };
  };
}