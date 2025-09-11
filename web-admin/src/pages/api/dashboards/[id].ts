import { NextApiRequest, NextApiResponse } from 'next';
import { Dashboard } from '@/types/shared-types';
import { createContextLogger } from '@/utils/logger';
import { webSocketServerSingleton } from '@/lib/websocket-server-singleton';
import fs from 'fs';
import path from 'path';

const DASHBOARDS_FILE = path.join(process.cwd(), 'data', 'dashboards.json');

const dashboardsByIdLogger = createContextLogger('api-dashboards-by-id');

// Load dashboards from file
const loadDashboards = (): Dashboard[] => {
  try {
    if (!fs.existsSync(DASHBOARDS_FILE)) {
      return [];
    }
    
    const data = fs.readFileSync(DASHBOARDS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading dashboards:', error);
    return [];
  }
};

// Save dashboards to file
const saveDashboards = (dashboards: Dashboard[]): void => {
  try {
    const dataDir = path.dirname(DASHBOARDS_FILE);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    fs.writeFileSync(DASHBOARDS_FILE, JSON.stringify(dashboards, null, 2), 'utf8');
  } catch (error) {
    console.error('Error saving dashboards:', error);
    throw new Error('Failed to save dashboards');
  }
};

// Validate dashboard data
const validateDashboard = (data: any): data is Omit<Dashboard, 'id'> => {
  return (
    typeof data.name === 'string' &&
    typeof data.url === 'string' &&
    typeof data.description === 'string' &&
    typeof data.refreshInterval === 'number' &&
    typeof data.requiresAuth === 'boolean' &&
    (typeof data.category === 'string' || data.category === undefined)
  );
};

// Trigger dashboard sync to all controllers
const triggerDashboardSync = async (): Promise<void> => {
  try {
    await webSocketServerSingleton.triggerDashboardSync();
    dashboardsByIdLogger.info('Dashboard sync triggered successfully');
  } catch (error) {
    dashboardsByIdLogger.error('Failed to trigger dashboard sync', { 
      error: error instanceof Error ? error.message : String(error) 
    });
  }
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'Dashboard ID is required'
    });
  }

  try {
    switch (req.method) {
      case 'GET':
        // Get specific dashboard
        const dashboards = loadDashboards();
        const dashboard = dashboards.find(d => d.id === id);
        
        if (!dashboard) {
          return res.status(404).json({
            success: false,
            error: 'Dashboard not found'
          });
        }

        return res.status(200).json({
          success: true,
          data: dashboard
        });

      case 'PUT':
        // Update specific dashboard
        const updateData = req.body;
        
        if (!validateDashboard(updateData)) {
          return res.status(400).json({
            success: false,
            error: 'Invalid dashboard data. Required fields: name, url, description, refreshInterval, requiresAuth'
          });
        }

        const dashboardsToUpdate = loadDashboards();
        const dashboardIndex = dashboardsToUpdate.findIndex(d => d.id === id);
        
        if (dashboardIndex === -1) {
          return res.status(404).json({
            success: false,
            error: 'Dashboard not found'
          });
        }

        // Check for duplicate names (excluding current dashboard)
        if (dashboardsToUpdate.some((d, index) => 
            index !== dashboardIndex && d.name === updateData.name)) {
          return res.status(400).json({
            success: false,
            error: 'Dashboard with this name already exists'
          });
        }

        const updatedDashboard: Dashboard = {
          ...dashboardsToUpdate[dashboardIndex],
          name: updateData.name,
          url: updateData.url,
          description: updateData.description,
          refreshInterval: updateData.refreshInterval,
          requiresAuth: updateData.requiresAuth,
          category: updateData.category
        };

        dashboardsToUpdate[dashboardIndex] = updatedDashboard;
        saveDashboards(dashboardsToUpdate);

        // Trigger sync to all controllers
        await triggerDashboardSync();

        return res.status(200).json({
          success: true,
          data: updatedDashboard
        });

      case 'DELETE':
        // Delete specific dashboard
        const dashboardsToDelete = loadDashboards();
        const deleteIndex = dashboardsToDelete.findIndex(d => d.id === id);
        
        if (deleteIndex === -1) {
          return res.status(404).json({
            success: false,
            error: 'Dashboard not found'
          });
        }

        const deletedDashboard = dashboardsToDelete[deleteIndex];
        dashboardsToDelete.splice(deleteIndex, 1);
        saveDashboards(dashboardsToDelete);

        // Trigger sync to all controllers
        await triggerDashboardSync();

        return res.status(200).json({
          success: true,
          data: deletedDashboard
        });

      default:
        res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
        return res.status(405).json({
          success: false,
          error: `Method ${req.method} Not Allowed`
        });
    }
  } catch (error: any) {
    console.error('Dashboard API error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
}