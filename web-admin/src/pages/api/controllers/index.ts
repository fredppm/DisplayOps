import { NextApiResponse } from 'next';
import fs from 'fs/promises';
import path from 'path';
import { Controller, CreateControllerRequest, ApiResponse } from '@/types/multi-site-types';
import { CreateControllerSchema } from '@/schemas/validation';
import { withPermission, ProtectedApiRequest } from '@/lib/api-protection';

const CONTROLLERS_FILE = path.join(process.cwd(), 'data', 'controllers.json');
const SITES_FILE = path.join(process.cwd(), 'data', 'sites.json');

interface ControllersData {
  controllers: Controller[];
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

async function readSitesData(): Promise<SitesData> {
  try {
    const data = await fs.readFile(SITES_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading sites data:', error);
    return { sites: [] };
  }
}

async function writeSitesData(data: SitesData): Promise<void> {
  try {
    await fs.writeFile(SITES_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error writing sites data:', error);
    throw new Error('Failed to write sites data');
  }
}

async function handler(req: ProtectedApiRequest, res: NextApiResponse<ApiResponse<Controller[] | Controller>>) {
  if (req.method === 'GET') {
    try {
      const { siteId } = req.query;
      const data = await readControllersData();
      
      let controllers = data.controllers;
      
      // Filter by site if specified
      if (siteId && typeof siteId === 'string') {
        controllers = controllers.filter(controller => controller.siteId === siteId);
      }

      res.status(200).json({
        success: true,
        data: controllers,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch controllers',
        timestamp: new Date().toISOString()
      });
    }
  } else if (req.method === 'POST') {
    try {
      // Validate request body
      const validation = CreateControllerSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: validation.error.issues.map(e => e.message).join(', '),
          timestamp: new Date().toISOString()
        });
      }

      const createData: CreateControllerRequest = validation.data;
      
      // Verify that the site exists
      const sitesData = await readSitesData();
      const site = sitesData.sites.find(s => s.id === createData.siteId);
      
      if (!site) {
        return res.status(404).json({
          success: false,
          error: 'Site not found',
          timestamp: new Date().toISOString()
        });
      }

      const data = await readControllersData();

      // Generate controller ID based on site and name
      const controllerId = `${createData.siteId}-${createData.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
      
      // Check if controller ID already exists
      const existingController = data.controllers.find(controller => controller.id === controllerId);
      
      if (existingController) {
        return res.status(409).json({
          success: false,
          error: 'A controller with this name already exists in this site',
          timestamp: new Date().toISOString()
        });
      }

      // Create new controller
      const newController: Controller = {
        id: controllerId,
        siteId: createData.siteId,
        name: createData.name,
        localNetwork: createData.localNetwork,
        mdnsService: createData.mdnsService || '_displayops._tcp.local',
        webAdminUrl: createData.webAdminUrl || 'http://localhost:3000',
        status: 'offline',
        lastSync: new Date().toISOString(),
        version: '1.0.0'
      };

      // Add to controllers array
      data.controllers.push(newController);
      
      // Write back to file
      await writeControllersData(data);

      // Update site's controllers list
      site.controllers.push(controllerId);
      site.updatedAt = new Date().toISOString();
      await writeSitesData(sitesData);

      res.status(201).json({
        success: true,
        data: newController,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to create controller',
        timestamp: new Date().toISOString()
      });
    }
  } else {
    res.setHeader('Allow', ['GET', 'POST']);
    res.status(405).json({
      success: false,
      error: `Method ${req.method} not allowed`,
      timestamp: new Date().toISOString()
    });
  }
}

// Export with authentication and permission checking
// GET requires 'controllers:read' permission
// POST requires 'controllers:create' permission  
export default withPermission('controllers:read')(handler);