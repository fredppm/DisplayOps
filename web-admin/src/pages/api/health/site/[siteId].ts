import { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs/promises';
import path from 'path';
import { ApiResponse } from '@/types/multi-site-types';

const SITES_FILE = path.join(process.cwd(), 'data', 'sites.json');
const CONTROLLERS_FILE = path.join(process.cwd(), 'data', 'controllers.json');

interface SiteHealthResponse {
  siteId: string;
  siteName: string;
  status: 'healthy' | 'warning' | 'critical';
  controllers: Array<{
    id: string;
    name: string;
    status: 'online' | 'offline' | 'error';
    lastSync: string;
    health: 'healthy' | 'warning' | 'critical';
    uptime?: number;
    estimatedHosts?: number;
    estimatedDisplays?: number;
  }>;
  metrics: {
    totalControllers: number;
    onlineControllers: number;
    offlineControllers: number;
    errorControllers: number;
    estimatedHosts: number;
    estimatedOnlineHosts: number;
    estimatedDisplays: number;
    estimatedActiveDisplays: number;
  };
  lastUpdated: string;
}

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
    webAdminUrl: string;
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

function isControllerRecent(lastSync: string, thresholdMinutes: number = 15): boolean {
  const lastSyncTime = new Date(lastSync);
  const threshold = new Date(Date.now() - thresholdMinutes * 60 * 1000);
  return lastSyncTime > threshold;
}

function getControllerHealth(
  status: 'online' | 'offline' | 'error',
  lastSync: string
): 'healthy' | 'warning' | 'critical' {
  if (status === 'error') return 'critical';
  if (status === 'offline') return 'critical';
  if (status === 'online' && !isControllerRecent(lastSync, 10)) return 'warning';
  return 'healthy';
}

function getSiteHealth(controllers: Array<{ health: string }>): 'healthy' | 'warning' | 'critical' {
  const totalControllers = controllers.length;
  if (totalControllers === 0) return 'healthy';
  
  const healthyControllers = controllers.filter(c => c.health === 'healthy').length;
  const percentage = healthyControllers / totalControllers;
  
  if (percentage >= 0.8) return 'healthy';      // 80% or more
  if (percentage >= 0.5) return 'warning';      // 50-79%
  return 'critical';                            // Less than 50%
}

function calculateUptime(lastSync: string, createdAt?: string): number {
  const now = Date.now();
  const lastSyncTime = new Date(lastSync).getTime();
  const startTime = createdAt ? new Date(createdAt).getTime() : now - 24 * 60 * 60 * 1000; // Default to 24h ago
  
  // Simple uptime calculation - if recently synced, assume good uptime
  if (isControllerRecent(lastSync, 10)) {
    return Math.min(99.9, ((now - startTime) / (24 * 60 * 60 * 1000)) * 98 + 95);
  }
  
  // If not recent, reduce uptime based on how long ago
  const hoursOffline = (now - lastSyncTime) / (60 * 60 * 1000);
  return Math.max(0, 95 - (hoursOffline * 2));
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<SiteHealthResponse>>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed',
      timestamp: new Date().toISOString()
    });
  }

  const { siteId } = req.query;

  if (!siteId || typeof siteId !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'Site ID is required',
      timestamp: new Date().toISOString()
    });
  }

  try {
    const sitesData = await readSitesData();
    const controllersData = await readControllersData();
    
    // Find the site
    const site = sitesData.sites.find(s => s.id === siteId);
    if (!site) {
      return res.status(404).json({
        success: false,
        error: 'Site not found',
        timestamp: new Date().toISOString()
      });
    }

    // Get controllers for this site
    const siteControllers = controllersData.controllers.filter(c => c.siteId === siteId);
    
    // Calculate health for each controller
    const controllersWithHealth = siteControllers.map(controller => {
      const health = getControllerHealth(controller.status, controller.lastSync);
      const uptime = calculateUptime(controller.lastSync);
      const estimatedHosts = Math.floor(Math.random() * 5) + 1; // 1-5 hosts
      const estimatedDisplays = Math.floor(estimatedHosts * 1.8); // ~1.8 displays per host
      
      return {
        id: controller.id,
        name: controller.name,
        status: controller.status,
        lastSync: controller.lastSync,
        health,
        uptime: Math.round(uptime * 100) / 100,
        estimatedHosts,
        estimatedDisplays
      };
    });

    // Calculate site metrics
    const totalControllers = controllersWithHealth.length;
    const onlineControllers = controllersWithHealth.filter(c => c.status === 'online').length;
    const offlineControllers = controllersWithHealth.filter(c => c.status === 'offline').length;
    const errorControllers = controllersWithHealth.filter(c => c.status === 'error').length;
    
    const estimatedHosts = controllersWithHealth.reduce((sum, c) => sum + (c.estimatedHosts || 0), 0);
    const estimatedOnlineHosts = Math.floor(estimatedHosts * (onlineControllers / Math.max(1, totalControllers)));
    const estimatedDisplays = controllersWithHealth.reduce((sum, c) => sum + (c.estimatedDisplays || 0), 0);
    const estimatedActiveDisplays = Math.floor(estimatedDisplays * (estimatedOnlineHosts / Math.max(1, estimatedHosts)));

    // Calculate overall site health
    const siteHealth = getSiteHealth(controllersWithHealth);

    const siteHealthResponse: SiteHealthResponse = {
      siteId: site.id,
      siteName: site.name,
      status: siteHealth,
      controllers: controllersWithHealth,
      metrics: {
        totalControllers,
        onlineControllers,
        offlineControllers,
        errorControllers,
        estimatedHosts,
        estimatedOnlineHosts,
        estimatedDisplays,
        estimatedActiveDisplays
      },
      lastUpdated: new Date().toISOString()
    };

    console.log(`Site health check completed for ${siteId}:`, {
      status: siteHealth,
      controllers: `${onlineControllers}/${totalControllers} online`,
      timestamp: siteHealthResponse.lastUpdated
    });

    res.status(200).json({
      success: true,
      data: siteHealthResponse,
      timestamp: siteHealthResponse.lastUpdated
    });

  } catch (error: any) {
    console.error(`Site health check failed for ${siteId}:`, error);
    
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get site health',
      timestamp: new Date().toISOString()
    });
  }
}