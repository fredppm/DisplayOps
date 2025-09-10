import { NextApiRequest, NextApiResponse } from 'next';
import { grpcServerSingleton } from '@/lib/grpc-server-singleton';
import { createContextLogger } from '@/utils/logger';
import { loadControllers, loadDashboards } from '@/lib/data-adapter';
import { db } from '@/lib/database';

const logger = createContextLogger('health-api');

interface ControllerSyncStatus {
  controllerId: string;
  name: string;
  status: 'online' | 'offline' | 'error';
  isConnected: boolean;
  lastSync: string;
  dashboardSync: {
    pending: boolean;
    timestamp: string | null;
  };
  cookieSync: {
    pending: boolean;
    timestamp: string | null;
  };
}

interface SyncAlert {
  id: string;
  type: 'warning' | 'error' | 'info';
  title: string;
  message: string;
  timestamp: string;
  controllerId?: string;
}

interface HealthCheck {
  name: string;
  status: 'healthy' | 'warning' | 'critical' | 'unknown';
  message?: string;
  lastCheck: string;
  responseTime?: number;
}

interface HealthStatus {
  grpc: {
    isRunning: boolean;
    connections: number;
    port: number;
  };
  controllers: {
    total: number;
    online: number;
    offline: number;
    connected: number; // conectados via gRPC
    syncUpToDate: number;
    pendingDashboards: number;
    pendingCookies: number;
  };
  sync: {
    overall: 'healthy' | 'warning' | 'critical';
    controllers: ControllerSyncStatus[];
    alerts: SyncAlert[];
  };
  data: {
    dashboards: {
      total: number;
      lastUpdated: string | null;
    };
    cookies: {
      domains: number;
      totalCookies: number;
      lastUpdated: string | null;
    };
  };
  healthChecks: {
    checks: HealthCheck[];
    overallStatus: 'healthy' | 'warning' | 'critical';
  };
  timestamp: string;
}

async function readControllersData(): Promise<any> {
  try {
    const controllers = await loadControllers();
    
    // Apply the same status calculation logic as ControllersRepository
    const { calculateControllersStatus } = await import('@/lib/controller-status');
    const controllersWithStatus = calculateControllersStatus(controllers as any || []);
    
    return { controllers: controllersWithStatus };
  } catch (error) {
    logger.error('Error reading controllers data', { error: (error as Error).message });
    return { controllers: [] };
  }
}

async function readDashboardsData(): Promise<any> {
  try {
    const dashboards = await loadDashboards();
    return dashboards || [];
  } catch (error) {
    logger.error('Error reading dashboards data', { error: (error as Error).message });
    return [];
  }
}

async function readCookiesData(): Promise<any> {
  try {
    // Query cookies from PostgreSQL
    const result = await db.query(`
      SELECT domain, name, value, path, secure, http_only, same_site, 
             expiration_date, description, created_at, updated_at
      FROM cookies 
      ORDER BY domain, name
    `);
    
    // Group cookies by domain
    const domains: any = {};
    result.rows.forEach((cookie: any) => {
      if (!domains[cookie.domain]) {
        domains[cookie.domain] = {
          domain: cookie.domain,
          description: `Cookies for ${cookie.domain}`,
          cookies: [],
          lastUpdated: cookie.updated_at?.toISOString() || cookie.created_at?.toISOString()
        };
      }
      
      domains[cookie.domain].cookies.push({
        name: cookie.name,
        value: cookie.value,
        domain: cookie.domain,
        path: cookie.path,
        secure: cookie.secure,
        httpOnly: cookie.http_only,
        sameSite: cookie.same_site,
        expirationDate: cookie.expiration_date,
        description: cookie.description
      });
    });
    
    return { domains, lastUpdated: new Date().toISOString() };
  } catch (error) {
    logger.error('Error reading cookies data', { error: (error as Error).message });
    return { domains: {}, lastUpdated: null };
  }
}

function generateAlerts(controllers: ControllerSyncStatus[]): SyncAlert[] {
  const alerts: SyncAlert[] = [];
  
  // Controllers with pending sync
  const pendingDashboards = controllers.filter(c => c.dashboardSync.pending);
  const pendingCookies = controllers.filter(c => c.cookieSync.pending);
  
  if (pendingDashboards.length > 0) {
    alerts.push({
      id: `pending-dashboards-${Date.now()}`,
      type: 'warning',
      title: 'Dashboards Sync Pending',
      message: `${pendingDashboards.length} controller(s) have pending dashboard sync: ${pendingDashboards.map(c => c.name).join(', ')}`,
      timestamp: new Date().toISOString(),
      controllerId: pendingDashboards.length === 1 ? pendingDashboards[0].controllerId : undefined
    });
  }
  
  if (pendingCookies.length > 0) {
    alerts.push({
      id: `pending-cookies-${Date.now()}`,
      type: 'warning',
      title: 'Cookies Sync Pending',
      message: `${pendingCookies.length} controller(s) have pending cookie sync: ${pendingCookies.map(c => c.name).join(', ')}`,
      timestamp: new Date().toISOString(),
      controllerId: pendingCookies.length === 1 ? pendingCookies[0].controllerId : undefined
    });
  }
  
  return alerts;
}

function calculateOverallHealth(controllers: ControllerSyncStatus[], grpcRunning: boolean): 'healthy' | 'warning' | 'critical' {
  const totalControllers = controllers.length;
  if (totalControllers === 0) return 'healthy';
  
  const onlineControllers = controllers.filter(c => c.status === 'online').length;
  const controllersWithPendingSync = controllers.filter(c => 
    c.dashboardSync.pending || c.cookieSync.pending
  ).length;
  
  // Critical: More than 50% controllers offline
  if (onlineControllers / totalControllers < 0.5) return 'critical';
  
  // Warning: Any controllers have pending sync
  if (controllersWithPendingSync > 0) return 'warning';
  
  // Warning: Less than 80% controllers online
  if (onlineControllers / totalControllers < 0.8) return 'warning';
  
  return 'healthy';
}

async function getHealthStatus(): Promise<HealthStatus> {
  // Get gRPC status
  const grpcRunning = grpcServerSingleton.isRunning();
  const grpcStats = grpcServerSingleton.getConnectionStats();
  
  // Read all data files
  const controllersData = await readControllersData();
  const dashboards = await readDashboardsData();
  const cookiesData = await readCookiesData();
  
  const controllers = controllersData.controllers || [];
  const totalControllers = controllers.length;
  const onlineControllers = controllers.filter((c: any) => c.status === 'online').length;
  const offlineControllers = totalControllers - onlineControllers;
  
  // Count controllers connected via gRPC
  const connectedViaGrpc = controllers.filter((c: any) => 
    grpcServerSingleton.isControllerConnected(c.id)
  ).length;
  
  // Build controller sync status
  const controllerStatuses: ControllerSyncStatus[] = controllers.map((controller: any) => ({
    controllerId: controller.id,
    name: controller.name,
    status: controller.status,
    isConnected: grpcServerSingleton.isControllerConnected(controller.id),
    lastSync: controller.lastSync,
    dashboardSync: {
      pending: controller.pendingDashboardSync || false,
      timestamp: controller.dashboardSyncTimestamp || null
    },
    cookieSync: {
      pending: controller.pendingCookieSync || false,
      timestamp: controller.cookieSyncTimestamp || null
    }
  }));
  
  // Calculate sync statistics
  const syncUpToDate = controllerStatuses.filter(c => 
    !c.dashboardSync.pending && !c.cookieSync.pending
  ).length;
  const pendingDashboards = controllerStatuses.filter(c => c.dashboardSync.pending).length;
  const pendingCookies = controllerStatuses.filter(c => c.cookieSync.pending).length;
  
  // Count cookies
  const cookieDomains = Object.keys(cookiesData.domains || {});
  const totalCookies = cookieDomains.reduce((total, domain) => {
    return total + (cookiesData.domains[domain]?.cookies?.length || 0);
  }, 0);
  
  // Generate alerts
  const syncAlerts = generateAlerts(controllerStatuses);
  
  // Calculate overall health
  const overallHealth = calculateOverallHealth(controllerStatuses, grpcRunning);
  
  // Generate health checks
  const healthChecks: HealthCheck[] = [
    {
      name: 'gRPC Service',
      status: grpcRunning ? 'healthy' : 'critical',
      message: grpcRunning 
        ? `Running on port ${grpcServerSingleton.getPort()} with ${grpcStats.connected} active connections`
        : 'gRPC server is not running',
      lastCheck: new Date().toISOString()
    },
    {
      name: 'Controllers Sync',
      status: grpcStats.connected > 0 ? 'healthy' : 
              controllers.length === 0 ? 'healthy' : 'warning',
      message: grpcStats.connected > 0 
        ? `${grpcStats.connected} controller(s) connected`
        : controllers.length === 0 
          ? 'No controllers registered'
          : `${onlineControllers}/${controllers.length} controllers online, none connected via gRPC`,
      lastCheck: new Date().toISOString()
    }
  ];
  
  // Determine overall health check status
  const hasAnyUnhealthy = healthChecks.some(check => 
    check.status === 'critical' || check.status === 'unknown'
  );
  const hasAnyWarning = healthChecks.some(check => check.status === 'warning');
  
  const overallHealthCheckStatus: 'healthy' | 'warning' | 'critical' = 
    hasAnyUnhealthy ? 'critical' :
    hasAnyWarning ? 'warning' : 'healthy';
  
  const result = {
    grpc: {
      isRunning: grpcRunning,
      connections: grpcStats.connected,
      port: grpcServerSingleton.getPort()
    },
    controllers: {
      total: totalControllers,
      online: onlineControllers,
      offline: offlineControllers,
      connected: connectedViaGrpc,
      syncUpToDate,
      pendingDashboards,
      pendingCookies
    },
    sync: {
      overall: overallHealth,
      controllers: controllerStatuses,
      alerts: syncAlerts
    },
    data: {
      dashboards: {
        total: dashboards.length,
        lastUpdated: dashboards.length > 0 ? new Date().toISOString() : null
      },
      cookies: {
        domains: cookieDomains.length,
        totalCookies,
        lastUpdated: cookiesData.lastUpdated
      }
    },
    healthChecks: {
      checks: healthChecks,
      overallStatus: overallHealthCheckStatus
    },
    timestamp: new Date().toISOString()
  };
  
  return result;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const status = await getHealthStatus();
    
    // Set cache headers for efficient polling
    res.setHeader('Cache-Control', 'no-cache, must-revalidate');
    res.setHeader('Content-Type', 'application/json');
    
    return res.status(200).json(status);
  } catch (error) {
    logger.error('Error getting health status:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}