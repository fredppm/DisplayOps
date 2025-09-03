import { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs/promises';
import path from 'path';
import { ApiResponse } from '@/types/multi-site-types';

const DASHBOARDS_FILE = path.join(process.cwd(), 'data', 'dashboards.json');
const CONTROLLERS_FILE = path.join(process.cwd(), 'data', 'controllers.json');

interface DashboardSyncRequest {
  controllerId: string;
  lastSyncTimestamp?: string;
}

interface DashboardSyncResponse {
  controllerId: string;
  dashboards: any[];
  lastUpdated: string;
  syncTimestamp: string;
  hasChanges: boolean;
}

interface DashboardsData {
  dashboards: any[];
}

interface ControllersData {
  controllers: Array<{
    id: string;
    siteId: string;
    name: string;
    localNetwork: string;
    mdnsService: string;
    webAdminUrl: string;
    status: string;
    lastSync: string;
    version: string;
  }>;
}

async function readDashboardsData(): Promise<DashboardsData> {
  try {
    const data = await fs.readFile(DASHBOARDS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading dashboards data:', error);
    return { dashboards: [] };
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

async function writeControllersData(data: ControllersData): Promise<void> {
  try {
    await fs.writeFile(CONTROLLERS_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error writing controllers data:', error);
    throw new Error('Failed to write controllers data');
  }
}

export default async function handler(
  req: NextApiRequest, 
  res: NextApiResponse<ApiResponse<DashboardSyncResponse>>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed',
      timestamp: new Date().toISOString()
    });
  }

  try {
    const syncRequest: DashboardSyncRequest = req.body;

    if (!syncRequest.controllerId) {
      return res.status(400).json({
        success: false,
        error: 'Controller ID is required',
        timestamp: new Date().toISOString()
      });
    }

    // Find the controller
    const controllersData = await readControllersData();
    const controllerIndex = controllersData.controllers.findIndex(
      c => c.id === syncRequest.controllerId
    );

    if (controllerIndex === -1) {
      return res.status(404).json({
        success: false,
        error: 'Controller not found',
        timestamp: new Date().toISOString()
      });
    }

    const controller = controllersData.controllers[controllerIndex];
    const now = new Date().toISOString();

    // Get dashboards data
    const dashboardsData = await readDashboardsData();
    
    // Filter dashboards for this controller/site
    const relevantDashboards = dashboardsData.dashboards.filter(dashboard => {
      // Include dashboard if:
      // 1. No site restrictions, or this controller's site is included
      // 2. No controller restrictions, or this controller is included
      const siteAllowed = !dashboard.siteRestrictions || 
        dashboard.siteRestrictions.includes(controller.siteId);
      const controllerAllowed = !dashboard.controllerRestrictions || 
        dashboard.controllerRestrictions.includes(controller.id);
      
      return siteAllowed && controllerAllowed;
    });

    // Determine if there are changes since last sync
    let hasChanges = true;
    if (syncRequest.lastSyncTimestamp) {
      const lastSyncTime = new Date(syncRequest.lastSyncTimestamp);
      
      // Check if any relevant dashboard was updated since last sync
      hasChanges = relevantDashboards.some(dashboard => {
        const dashboardUpdated = dashboard.updatedAt ? 
          new Date(dashboard.updatedAt) : 
          new Date(dashboard.createdAt || 0);
        return dashboardUpdated > lastSyncTime;
      });
    }

    // Update controller's last sync time and status
    controller.lastSync = now;
    controller.status = 'online';
    controllersData.controllers[controllerIndex] = controller;
    await writeControllersData(controllersData);

    // Find the most recent update time among relevant dashboards
    const lastUpdated = relevantDashboards.reduce((latest, dashboard) => {
      const dashboardTime = dashboard.updatedAt || dashboard.createdAt || latest;
      return dashboardTime > latest ? dashboardTime : latest;
    }, '1970-01-01T00:00:00.000Z');

    // Prepare response
    const response: DashboardSyncResponse = {
      controllerId: syncRequest.controllerId,
      dashboards: hasChanges ? relevantDashboards : [],
      lastUpdated,
      syncTimestamp: now,
      hasChanges
    };

    console.log(`Dashboard sync completed for controller ${syncRequest.controllerId}:`, {
      dashboardsCount: relevantDashboards.length,
      hasChanges,
      timestamp: now
    });

    res.status(200).json({
      success: true,
      data: response,
      timestamp: now
    });

  } catch (error: any) {
    console.error('Dashboard sync processing failed:', error);
    
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }
}