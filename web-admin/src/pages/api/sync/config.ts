import { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs/promises';
import path from 'path';
import { ApiResponse } from '@/types/multi-site-types';

const CONTROLLERS_FILE = path.join(process.cwd(), 'data', 'controllers.json');

interface ConfigSyncRequest {
  controllerId: string;
  configData: {
    mdnsService?: string;
    localNetwork?: string;
    healthCheckInterval?: number;
    syncInterval?: number;
    cookieSyncInterval?: number;
    maxRetries?: number;
    retryDelay?: number;
  };
}

interface ConfigSyncResponse {
  controllerId: string;
  configReceived: boolean;
  appliedAt: string;
  acknowledgment: string;
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
  res: NextApiResponse<ApiResponse<ConfigSyncResponse>>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed',
      timestamp: new Date().toISOString()
    });
  }

  try {
    const syncRequest: ConfigSyncRequest = req.body;

    if (!syncRequest.controllerId) {
      return res.status(400).json({
        success: false,
        error: 'Controller ID is required',
        timestamp: new Date().toISOString()
      });
    }

    if (!syncRequest.configData) {
      return res.status(400).json({
        success: false,
        error: 'Configuration data is required',
        timestamp: new Date().toISOString()
      });
    }

    // Find and update the controller
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
    
    // Update controller configuration if provided
    if (syncRequest.configData.mdnsService) {
      controller.mdnsService = syncRequest.configData.mdnsService;
    }
    if (syncRequest.configData.localNetwork) {
      controller.localNetwork = syncRequest.configData.localNetwork;
    }

    // Update last sync time and status
    controller.lastSync = now;
    controller.status = 'online';
    controllersData.controllers[controllerIndex] = controller;
    await writeControllersData(controllersData);

    // Prepare response
    const response: ConfigSyncResponse = {
      controllerId: syncRequest.controllerId,
      configReceived: true,
      appliedAt: now,
      acknowledgment: `Configuration updated for controller ${syncRequest.controllerId}`
    };

    console.log(`Config sync completed for controller ${syncRequest.controllerId}:`, {
      configKeys: Object.keys(syncRequest.configData),
      timestamp: now
    });

    res.status(200).json({
      success: true,
      data: response,
      timestamp: now
    });

  } catch (error: any) {
    console.error('Config sync processing failed:', error);
    
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }
}