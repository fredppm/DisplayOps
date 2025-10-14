import { z } from 'zod';

// Site validation schemas
export const SiteSchema = z.object({
  id: z.string().min(1, 'Site ID is required'),
  name: z.string().min(1, 'Site name is required').max(100, 'Site name is too long'),
  location: z.string().min(1, 'Location is required').max(100, 'Location is too long'),
  timezone: z.string().min(1, 'Timezone is required'),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const CreateSiteSchema = z.object({
  name: z.string().min(1, 'Site name is required').max(100, 'Site name is too long'),
  location: z.string().min(1, 'Location is required').max(100, 'Location is too long'),
  timezone: z.string().min(1, 'Timezone is required'),
});

export const UpdateSiteSchema = z.object({
  name: z.string().min(1, 'Site name is required').max(100, 'Site name is too long').optional(),
  location: z.string().min(1, 'Location is required').max(100, 'Location is too long').optional(),
  timezone: z.string().min(1, 'Timezone is required').optional(),
});

// Multi-site dashboard schema
export const MultiSiteDashboardSchema = z.object({
  id: z.string().min(1, 'Dashboard ID is required'),
  name: z.string().min(1, 'Dashboard name is required').max(100, 'Dashboard name is too long'),
  url: z.string().url('Invalid URL format'),
  description: z.string().max(500, 'Description is too long').optional(),
  category: z.string().max(50, 'Category is too long').optional(),
  requiresAuth: z.boolean(),
  refreshInterval: z.number().min(1000, 'Refresh interval must be at least 1 second').optional(),
  siteRestrictions: z.array(z.string()).optional(),
});

// User schema
export const UserSchema = z.object({
  id: z.string().min(1, 'User ID is required'),
  email: z.string().email('Invalid email format'),
  name: z.string().min(1, 'Name is required').max(100, 'Name is too long'),
  role: z.enum(['admin', 'site-manager', 'viewer']),
  siteAccess: z.array(z.string()),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  lastLogin: z.string().datetime().optional(),
});

// System health schema
export const SystemHealthSchema = z.object({
  overall: z.enum(['healthy', 'warning', 'critical']),
  sites: z.object({
    total: z.number().min(0),
    healthy: z.number().min(0),
    warning: z.number().min(0),
    critical: z.number().min(0),
  }),
  controllers: z.object({
    total: z.number().min(0),
    online: z.number().min(0),
    offline: z.number().min(0),
    error: z.number().min(0),
  }),
  hostAgents: z.object({
    total: z.number().min(0),
    online: z.number().min(0),
    offline: z.number().min(0),
  }),
  displays: z.object({
    total: z.number().min(0),
    active: z.number().min(0),
    inactive: z.number().min(0),
  }),
  lastUpdated: z.string().datetime(),
});

// API response schemas
export const ApiResponseSchema = z.object({
  success: z.boolean(),
  data: z.any().optional(),
  error: z.string().optional(),
  timestamp: z.string().datetime(),
});

export const PaginatedResponseSchema = z.object({
  data: z.array(z.any()),
  pagination: z.object({
    page: z.number().min(1),
    limit: z.number().min(1).max(100),
    total: z.number().min(0),
    totalPages: z.number().min(0),
  }),
});

// Common validation utilities
export const validateEmail = (email: string): boolean => {
  return z.string().email().safeParse(email).success;
};

export const validateUrl = (url: string): boolean => {
  return z.string().url().safeParse(url).success;
};

export const validateNetworkCIDR = (network: string): boolean => {
  return z.string().regex(/^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/).safeParse(network).success;
};

// Form validation helper
export const createFormValidator = <T>(schema: z.ZodSchema<T>) => {
  return (data: unknown): { success: boolean; data?: T; errors?: Record<string, string> } => {
    const result = schema.safeParse(data);
    
    if (result.success) {
      return { success: true, data: result.data };
    } else {
      const errors: Record<string, string> = {};
      result.error.issues.forEach((error) => {
        const path = error.path.join('.');
        errors[path] = error.message;
      });
      return { success: false, errors };
    }
  };
};

// Type inference from schemas
export type Site = z.infer<typeof SiteSchema>;
export type CreateSiteRequest = z.infer<typeof CreateSiteSchema>;
export type UpdateSiteRequest = z.infer<typeof UpdateSiteSchema>;
export type Controller = z.infer<typeof ControllerSchema>;
export type CreateControllerRequest = z.infer<typeof CreateControllerSchema>;
export type UpdateControllerRequest = z.infer<typeof UpdateControllerSchema>;
export type AutoRegisterControllerRequest = z.infer<typeof AutoRegisterControllerSchema>;
export type MultiSiteDashboard = z.infer<typeof MultiSiteDashboardSchema>;
export type User = z.infer<typeof UserSchema>;
export type SystemHealth = z.infer<typeof SystemHealthSchema>;
export type ApiResponse<T = any> = z.infer<typeof ApiResponseSchema> & { data?: T };
export type PaginatedResponse<T> = z.infer<typeof PaginatedResponseSchema> & { data: T[] };

// Validation constants
export const TIMEZONES = [
  'America/Sao_Paulo',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Australia/Sydney',
] as const;

export const USER_ROLES = ['admin', 'site-manager', 'viewer'] as const;
export const CONTROLLER_STATUSES = ['online', 'offline', 'error'] as const;
export const HEALTH_STATUSES = ['healthy', 'warning', 'critical'] as const;