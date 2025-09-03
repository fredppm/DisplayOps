import { NextApiResponse } from 'next';
import fs from 'fs/promises';
import path from 'path';
import { SystemHealth, ApiResponse } from '@/types/multi-site-types';
import { withPermission, ProtectedApiRequest } from '@/lib/api-protection';

const SITES_FILE = path.join(process.cwd(), 'data', 'sites.json');
const CONTROLLERS_FILE = path.join(process.cwd(), 'data', 'controllers.json');

interface SitesData {
  sites: Array<{
    id: string;
    name: string;
    location: string;
    timezone: string;
    controllers: string[];
    createdAt: string;
    updatedAt: string;
  }>;
}

interface ControllersData {
  controllers: Array<{
    id: string;
    siteId: string;
    name: string;
    localNetwork: string;
    mdnsService: string;
    controllerUrl: string;
    status: 'online' | 'offline' | 'error';
    lastSync: string;
    version: string;
  }>;
}

async function readSitesData(): Promise<SitesData> {
  try {
    const data = await fs.readFile(SITES_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading sites data:', error);
    return { sites: [] };
  }
}

async function readControllersData(): Promise<ControllersData> {
  try {
    const data = await fs.readFile(CONTROLLERS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading controllers data:', error);
    return { controllers: [] };
  }
}

function getHealthStatus(onlineCount: number, totalCount: number): 'healthy' | 'warning' | 'critical' {
  if (totalCount === 0) return 'healthy';
  
  const percentage = onlineCount / totalCount;
  
  if (percentage >= 0.9) return 'healthy';      // 90% or more
  if (percentage >= 0.7) return 'warning';      // 70-89%
  return 'critical';                            // Less than 70%
}

function isControllerRecent(lastSync: string, thresholdMinutes: number = 15): boolean {
  const lastSyncTime = new Date(lastSync);
  const threshold = new Date(Date.now() - thresholdMinutes * 60 * 1000);
  return lastSyncTime > threshold;
}

async function handler(
  req: ProtectedApiRequest,
  res: NextApiResponse<ApiResponse<SystemHealth>>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed',
      timestamp: new Date().toISOString()
    });
  }

  try {
    const sitesData = await readSitesData();
    const controllersData = await readControllersData();
    
    // Analyze sites health
    const totalSites = sitesData.sites.length;
    const sitesWithControllers = sitesData.sites.filter(site => 
      site.controllers && site.controllers.length > 0
    );
    
    // Categorize sites based on their controllers' health
    let healthySites = 0;
    let warningSites = 0;
    let criticalSites = 0;

    sitesData.sites.forEach(site => {
      const siteControllers = controllersData.controllers.filter(c => c.siteId === site.id);
      const onlineControllers = siteControllers.filter(c => 
        c.status === 'online' && isControllerRecent(c.lastSync)
      );
      
      const siteHealth = getHealthStatus(onlineControllers.length, siteControllers.length);
      
      switch (siteHealth) {
        case 'healthy':
          healthySites++;
          break;
        case 'warning':
          warningSites++;
          break;
        case 'critical':
          criticalSites++;
          break;
      }
    });

    // Analyze controllers health
    const totalControllers = controllersData.controllers.length;
    const onlineControllers = controllersData.controllers.filter(c => 
      c.status === 'online' && isControllerRecent(c.lastSync)
    );
    const offlineControllers = controllersData.controllers.filter(c => 
      c.status === 'offline' || !isControllerRecent(c.lastSync)
    );
    const errorControllers = controllersData.controllers.filter(c => 
      c.status === 'error'
    );

    // Simulate host agents data (in real implementation, this would come from controllers)
    const estimatedHostAgents = Math.floor(totalControllers * 2.5); // Average 2.5 hosts per controller
    const estimatedOnlineHosts = Math.floor(onlineControllers.length * 2.3); // Slightly lower

    // Simulate displays data (in real implementation, this would come from host agents)
    const estimatedDisplays = Math.floor(estimatedHostAgents * 1.8); // Average 1.8 displays per host
    const estimatedActiveDisplays = Math.floor(estimatedOnlineHosts * 1.6); // Active displays

    // Calculate overall system health
    const controllersHealth = getHealthStatus(onlineControllers.length, totalControllers);
    const sitesHealth = getHealthStatus(healthySites, totalSites);
    const hostAgentsHealth = getHealthStatus(estimatedOnlineHosts, estimatedHostAgents);
    
    // Overall health is the worst of all components
    const overallHealth: 'healthy' | 'warning' | 'critical' = 
      [controllersHealth, sitesHealth, hostAgentsHealth].includes('critical') ? 'critical' :
      [controllersHealth, sitesHealth, hostAgentsHealth].includes('warning') ? 'warning' :
      'healthy';

    const systemHealth: SystemHealth = {
      overall: overallHealth,
      sites: {
        total: totalSites,
        healthy: healthySites,
        warning: warningSites,
        critical: criticalSites,
      },
      controllers: {
        total: totalControllers,
        online: onlineControllers.length,
        offline: offlineControllers.length,
        error: errorControllers.length,
      },
      hostAgents: {
        total: estimatedHostAgents,
        online: estimatedOnlineHosts,
        offline: estimatedHostAgents - estimatedOnlineHosts,
      },
      displays: {
        total: estimatedDisplays,
        active: estimatedActiveDisplays,
        inactive: estimatedDisplays - estimatedActiveDisplays,
      },
      lastUpdated: new Date().toISOString(),
    };

    console.log('System health check completed:', {
      overall: overallHealth,
      sites: `${healthySites}/${totalSites} healthy`,
      controllers: `${onlineControllers.length}/${totalControllers} online`,
      timestamp: systemHealth.lastUpdated
    });

    res.status(200).json({
      success: true,
      data: systemHealth,
      timestamp: systemHealth.lastUpdated
    });

  } catch (error: any) {
    console.error('Health check failed:', error);
    
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get system health',
      timestamp: new Date().toISOString()
    });
  }
}

// Export with authentication and permission checking
// Requires 'health:read' permission
export default withPermission('health:read')(handler);