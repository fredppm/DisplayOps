import { NextApiResponse } from 'next';
import fs from 'fs/promises';
import path from 'path';
import { ApiResponse } from '@/types/multi-site-types';
import { withPermission, ProtectedApiRequest } from '@/lib/api-protection';

const CONTROLLERS_FILE = path.join(process.cwd(), 'data', 'controllers.json');
const SITES_FILE = path.join(process.cwd(), 'data', 'sites.json');
const DASHBOARDS_FILE = path.join(process.cwd(), 'data', 'dashboards.json');

interface SyncRequest {
  controllerId: string;
  lastSyncTimestamp?: string;
  requestType: 'full' | 'incremental';
  currentVersion?: string;
}

interface SyncResponse {
  controllerId: string;
  syncType: 'full' | 'incremental' | 'no-changes';
  timestamp: string;
  version: string;
  data?: {
    dashboards?: any[];
    configuration?: any;
    commands?: any[];
  };
  nextSyncInterval?: number;
}

interface ControllersData {
  controllers: Array<{
    id: string;
    siteId: string;
    name: string;
    localNetwork: string;
    mdnsService: string;
    controllerUrl: string;
    status: string;
    lastSync: string;
    version: string;
  }>;
}

interface DashboardsData {
  dashboards: any[];
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

async function readDashboardsData(): Promise<DashboardsData> {
  try {
    const data = await fs.readFile(DASHBOARDS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading dashboards data:', error);
    return { dashboards: [] };
  }
}

async function handler(
  req: ProtectedApiRequest, 
  res: NextApiResponse<ApiResponse<SyncResponse>>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed',
      timestamp: new Date().toISOString()
    });
  }

  try {
    const syncRequest: SyncRequest = req.body;

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
    
    // Determine sync type
    let syncType: 'full' | 'incremental' = 'incremental';
    
    // Force full sync if:
    // 1. Explicitly requested
    // 2. No lastSyncTimestamp provided
    // 3. Last sync was more than 1 hour ago
    // 4. Version mismatch
    const lastSyncTime = syncRequest.lastSyncTimestamp ? 
      new Date(syncRequest.lastSyncTimestamp) : 
      new Date(0);
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    
    if (
      syncRequest.requestType === 'full' ||
      !syncRequest.lastSyncTimestamp ||
      lastSyncTime < oneHourAgo ||
      syncRequest.currentVersion !== controller.version
    ) {
      syncType = 'full';
    }

    // Prepare sync data
    let syncData: any = {};
    
    if (syncType === 'full' || syncType === 'incremental') {
      // Get dashboards data
      const dashboardsData = await readDashboardsData();
      
      // Filter dashboards for this controller/site (if applicable)
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

      syncData = {
        dashboards: relevantDashboards,
        configuration: {
          siteId: controller.siteId,
          controllerId: controller.id,
          localNetwork: controller.localNetwork,
          mdnsService: controller.mdnsService,
          controllerUrl: controller.controllerUrl,
          healthCheckInterval: 30000,  // 30 seconds
          syncInterval: 300000,        // 5 minutes
          cookieSyncInterval: 60000,   // 1 minute
          maxRetries: 3,
          retryDelay: 5000,           // 5 seconds
        },
        commands: [] // Could contain pending commands for this controller
      };
    }

    // Update controller's last sync time and status
    controller.lastSync = now;
    controller.status = 'online';
    controllersData.controllers[controllerIndex] = controller;
    await writeControllersData(controllersData);

    // Prepare response
    const response: SyncResponse = {
      controllerId: syncRequest.controllerId,
      syncType,
      timestamp: now,
      version: controller.version,
      data: syncData,
      nextSyncInterval: 300000 // 5 minutes
    };

    console.log(`Sync completed for controller ${syncRequest.controllerId}:`, {
      type: syncType,
      dashboardsCount: syncData.dashboards?.length || 0,
      timestamp: now
    });

    res.status(200).json({
      success: true,
      data: response,
      timestamp: now
    });

  } catch (error: any) {
    console.error('Sync processing failed:', error);
    
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }
}

// Export with authentication and permission checking
// Requires 'sync:write' permission for controller synchronization
export default withPermission('sync:write')(handler);