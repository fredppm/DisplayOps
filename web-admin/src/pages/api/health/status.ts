import { NextApiRequest, NextApiResponse } from 'next';
import { webSocketServerSingleton } from '@/lib/websocket-server-singleton';
import { createContextLogger } from '@/utils/logger';
import { hostsRepository } from '@/lib/repositories/HostsRepository';
import { dashboardsRepository } from '@/lib/repositories/DashboardsRepository';
import { cookiesRepository } from '@/lib/repositories/CookiesRepository';
import { db } from '@/lib/database';

const logger = createContextLogger('health-api');

interface HealthCheck {
  name: string;
  status: 'healthy' | 'warning' | 'critical' | 'unknown';
  message?: string;
  lastCheck: string;
  responseTime?: number;
}

interface HealthStatus {
  hosts: {
    total: number;
    online: number;
    offline: number;
  };
  websocket: {
    isRunning: boolean;
    connections: number;
    port: number;
  };
  sync: {
    overall: 'healthy' | 'warning' | 'critical';
    alerts: any[];
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

async function readHostsData(): Promise<any> {
  try {
    const hosts = await hostsRepository.getAll();
    return { hosts };
  } catch (error) {
    logger.error('Error reading hosts data', { error: (error as Error).message });
    return { hosts: [] };
  }
}

async function readDashboardsData(): Promise<any> {
  try {
    const dashboards = await dashboardsRepository.getAll();
    return dashboards || [];
  } catch (error) {
    logger.error('Error reading dashboards data', { error: (error as Error).message });
    return [];
  }
}

async function readCookiesData(): Promise<any> {
  try {
    const cookiesData = await cookiesRepository.getAllAsApiFormat();
    return cookiesData;
  } catch (error) {
    logger.error('Error reading cookies data', { error: (error as Error).message });
    return { domains: {}, lastUpdated: null };
  }
}

async function getHealthStatus(): Promise<HealthStatus> {
  
  // Read all data files
  const hostsData = await readHostsData();
  const dashboards = await readDashboardsData();
  const cookiesData = await readCookiesData();
  
  const hosts = hostsData.hosts || [];
  const totalHosts = hosts.length;
  const onlineHosts = hosts.filter((h: any) => h.status === 'online').length;
  const offlineHosts = totalHosts - onlineHosts;
  
  // Count cookies
  const cookieDomains = Object.keys(cookiesData.domains || {});
  const totalCookies = cookieDomains.reduce((total, domain) => {
    return total + (cookiesData.domains[domain]?.cookies?.length || 0);
  }, 0);
  
  // Calculate overall health
  const overallHealth = totalHosts > 0 && onlineHosts / totalHosts < 0.5 ? 'critical' 
    : totalHosts > 0 && onlineHosts / totalHosts < 0.8 ? 'warning' 
    : 'healthy';
  
  // Generate health checks
  const healthChecks: HealthCheck[] = [
    {
      name: 'Hosts Status',
      status: overallHealth,
      message: totalHosts === 0 
        ? 'No hosts registered yet'
        : `${onlineHosts}/${totalHosts} hosts online`,
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
  
  // Get WebSocket status
  const websocketStatus = {
    isRunning: webSocketServerSingleton.isRunning(),
    connections: 0, // We don't track individual connections anymore
    port: 3001
  };

  const result = {
    hosts: {
      total: totalHosts,
      online: onlineHosts,
      offline: offlineHosts
    },
    websocket: websocketStatus,
    sync: {
      overall: overallHealth,
      alerts: [] // No sync alerts in new architecture
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

async function ensureWebSocketInitialized() {
  // Trigger WebSocket initialization if not already done
  if (!webSocketServerSingleton.isRunning()) {
    try {
      logger.info('Initializing WebSocket server on health check');
      // Make a request to websocket endpoint to initialize it
      await fetch('http://localhost:3000/api/websocket').catch(() => {
        // Ignore fetch errors, just trying to trigger initialization
      });
    } catch (error) {
      logger.warn('Could not trigger WebSocket initialization:', error);
    }
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Ensure WebSocket is initialized
    await ensureWebSocketInitialized();
    
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