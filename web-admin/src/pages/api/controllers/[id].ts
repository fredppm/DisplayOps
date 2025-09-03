import { NextApiResponse } from 'next';
import fs from 'fs/promises';
import path from 'path';
import { Controller, UpdateControllerRequest, ApiResponse } from '@/types/multi-site-types';
import { UpdateControllerSchema } from '@/schemas/validation';
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

async function handler(req: ProtectedApiRequest, res: NextApiResponse<ApiResponse<Controller>>) {
  const { id } = req.query;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'Controller ID is required',
      timestamp: new Date().toISOString()
    });
  }

  if (req.method === 'GET') {
    try {
      const data = await readControllersData();
      const controller = data.controllers.find(c => c.id === id);

      if (!controller) {
        return res.status(404).json({
          success: false,
          error: 'Controller not found',
          timestamp: new Date().toISOString()
        });
      }

      res.status(200).json({
        success: true,
        data: controller,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch controller',
        timestamp: new Date().toISOString()
      });
    }
  } else if (req.method === 'PUT') {
    try {
      // Validate request body
      const validation = UpdateControllerSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: validation.error.issues.map(e => e.message).join(', '),
          timestamp: new Date().toISOString()
        });
      }

      const updateData: UpdateControllerRequest = validation.data;
      const data = await readControllersData();
      
      const controllerIndex = data.controllers.findIndex(c => c.id === id);
      if (controllerIndex === -1) {
        return res.status(404).json({
          success: false,
          error: 'Controller not found',
          timestamp: new Date().toISOString()
        });
      }

      const currentController = data.controllers[controllerIndex];

      // If name is being updated, check for conflicts with new ID
      if (updateData.name && updateData.name !== currentController.name) {
        const newControllerId = `${currentController.siteId}-${updateData.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
        const existingController = data.controllers.find(controller => controller.id === newControllerId && controller.id !== id);
        
        if (existingController) {
          return res.status(409).json({
            success: false,
            error: 'A controller with this name already exists in this site',
            timestamp: new Date().toISOString()
          });
        }

        // Update controller ID and sites reference if name changed
        const sitesData = await readSitesData();
        const site = sitesData.sites.find(s => s.id === currentController.siteId);
        
        if (site) {
          const controllerIndex = site.controllers.indexOf(id);
          if (controllerIndex !== -1) {
            site.controllers[controllerIndex] = newControllerId;
            site.updatedAt = new Date().toISOString();
            await writeSitesData(sitesData);
          }
        }
      }

      // Update controller
      const updatedController: Controller = {
        ...currentController,
        ...updateData,
        // If name changed, update the ID
        ...(updateData.name && updateData.name !== currentController.name 
          ? { id: `${currentController.siteId}-${updateData.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}` }
          : {}
        ),
        lastSync: new Date().toISOString()
      };

      data.controllers[controllerIndex] = updatedController;
      
      // Write back to file
      await writeControllersData(data);

      res.status(200).json({
        success: true,
        data: updatedController,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to update controller',
        timestamp: new Date().toISOString()
      });
    }
  } else if (req.method === 'DELETE') {
    try {
      const data = await readControllersData();
      
      const controllerIndex = data.controllers.findIndex(c => c.id === id);
      if (controllerIndex === -1) {
        return res.status(404).json({
          success: false,
          error: 'Controller not found',
          timestamp: new Date().toISOString()
        });
      }

      const controller = data.controllers[controllerIndex];

      // Remove controller from array
      data.controllers.splice(controllerIndex, 1);
      
      // Write back to file
      await writeControllersData(data);

      // Remove controller from site's controllers list
      const sitesData = await readSitesData();
      const site = sitesData.sites.find(s => s.id === controller.siteId);
      
      if (site) {
        const controllerIndex = site.controllers.indexOf(id);
        if (controllerIndex !== -1) {
          site.controllers.splice(controllerIndex, 1);
          site.updatedAt = new Date().toISOString();
          await writeSitesData(sitesData);
        }
      }

      res.status(200).json({
        success: true,
        data: controller,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to delete controller',
        timestamp: new Date().toISOString()
      });
    }
  } else {
    res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
    res.status(405).json({
      success: false,
      error: `Method ${req.method} not allowed`,
      timestamp: new Date().toISOString()
    });
  }
}

// Export with authentication and permission checking
// All methods require 'controllers:read' permission minimum
export default withPermission('controllers:read')(handler);