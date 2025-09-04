import { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs/promises';
import path from 'path';
import { createContextLogger } from '@/utils/logger';
import { grpcServerSingleton } from '@/lib/grpc-server-singleton';

const syncStatusLogger = createContextLogger('api-sync-status');

const CONTROLLERS_FILE = path.join(process.cwd(), 'data', 'controllers.json');
const DASHBOARDS_FILE = path.join(process.cwd(), 'data', 'dashboards.json');
const COOKIES_FILE = path.join(process.cwd(), 'data', 'cookies.json');

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

interface SyncHealthSummary {
  overall: 'healthy' | 'warning' | 'critical';
  controllers: {
    total: number;
    online: number;
    syncUpToDate: number;
    pendingDashboards: number;
    pendingCookies: number;
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
  grpc: {
    isRunning: boolean;
    connections: number;
  };
  controllers: ControllerSyncStatus[];
  alerts: Array<{
    id: string;
    type: 'warning' | 'error' | 'info';
    title: string;
    message: string;
    timestamp: string;
    controllerId?: string;
  }>;
}

async function readControllersData(): Promise<any> {
  try {
    const data = await fs.readFile(CONTROLLERS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    syncStatusLogger.error('Error reading controllers data', { error });
    return { controllers: [] };
  }
}

async function readDashboardsData(): Promise<any> {
  try {
    const data = await fs.readFile(DASHBOARDS_FILE, 'utf-8');
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : parsed.dashboards || [];
  } catch (error) {
    return [];
  }
}

async function readCookiesData(): Promise<any> {
  try {
    const data = await fs.readFile(COOKIES_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    return { domains: {}, lastUpdated: null };
  }
}

function generateAlerts(controllers: ControllerSyncStatus[]): Array<any> {
  const alerts: Array<any> = [];
  
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
  
  // Controllers offline for too long
  // Suppressed: No longer generating controller offline alerts
  // const now = Date.now();
  // const staleControllers = controllers.filter(c => {
  //   if (c.status === 'online') return false;
  //   const lastSyncTime = new Date(c.lastSync).getTime();
  //   const hoursSinceSync = (now - lastSyncTime) / (1000 * 60 * 60);
  //   return hoursSinceSync > 24; // Offline for more than 24 hours
  // });
  // 
  // if (staleControllers.length > 0) {
  //   alerts.push({
  //     id: `stale-controllers-${Date.now()}`,
  //     type: 'error',
  //     title: 'Controllers Long Offline',
  //     message: `${staleControllers.length} controller(s) offline for more than 24h: ${staleControllers.map(c => c.name).join(', ')}`,
  //     timestamp: new Date().toISOString()
  //   });
  // }
  
  // gRPC server status - suppressed (no longer generating alerts about gRPC status)
  const grpcRunning = grpcServerSingleton.isRunning();
  
  syncStatusLogger.debug('gRPC status check', { 
    grpcRunning, 
    port: grpcServerSingleton.getPort(),
    connectionStats: grpcServerSingleton.getConnectionStats()
  });
  
  // Suppressed: No longer generating gRPC down alerts
  // if (!grpcRunning && grpcServerSingleton.getConnectionStats().connected === 0) {
  //   alerts.push({
  //     id: `grpc-down-${Date.now()}`,
  //     type: 'warning',
  //     title: 'gRPC Server Down',
  //     message: 'gRPC Controller-Admin server is not running. Controllers cannot sync automatically.',
  //     timestamp: new Date().toISOString()
  //   });
  // }
  
  return alerts;
}

function calculateOverallHealth(controllers: ControllerSyncStatus[], grpcRunning: boolean): 'healthy' | 'warning' | 'critical' {
  // Suppressed: No longer considering gRPC status in overall health calculation
  // if (!grpcRunning) return 'critical';
  
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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    });
  }

  try {
    const controllersData = await readControllersData();
    const dashboards = await readDashboardsData();
    const cookiesData = await readCookiesData();
    
    // Get gRPC connection info
    const grpcRunning = grpcServerSingleton.isRunning();
    const grpcConnections = grpcRunning ? grpcServerSingleton.getConnectionStats() : { connected: 0 };
    
    // Build controller sync status
    const controllerStatuses: ControllerSyncStatus[] = controllersData.controllers.map((controller: any) => ({
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
    
    // Calculate statistics
    const onlineControllers = controllerStatuses.filter(c => c.status === 'online').length;
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
    const alerts = generateAlerts(controllerStatuses);
    
    // Calculate overall health
    const overallHealth = calculateOverallHealth(controllerStatuses, grpcRunning);
    
    const syncStatus: SyncHealthSummary = {
      overall: overallHealth,
      controllers: {
        total: controllerStatuses.length,
        online: onlineControllers,
        syncUpToDate,
        pendingDashboards,
        pendingCookies
      },
      data: {
        dashboards: {
          total: dashboards.length,
          lastUpdated: dashboards.length > 0 ? new Date().toISOString() : null // In real implementation, track actual last update
        },
        cookies: {
          domains: cookieDomains.length,
          totalCookies,
          lastUpdated: cookiesData.lastUpdated
        }
      },
      grpc: {
        isRunning: grpcRunning,
        connections: grpcConnections.connected
      },
      controllers: controllerStatuses,
      alerts
    };
    
    syncStatusLogger.debug('Sync status calculated', {
      overall: overallHealth,
      totalControllers: controllerStatuses.length,
      onlineControllers,
      pendingDashboards,
      pendingCookies,
      alertsCount: alerts.length
    });
    
    res.status(200).json({
      success: true,
      data: syncStatus,
      timestamp: new Date().toISOString()
    });
    
  } catch (error: any) {
    syncStatusLogger.error('Failed to get sync status', { error: error.message });
    
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
}