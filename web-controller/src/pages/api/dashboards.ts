import { NextApiRequest, NextApiResponse } from 'next';
import { Dashboard } from '@/types/shared-types';
import { createContextLogger } from '@/utils/logger';
import fs from 'fs';
import path from 'path';

const DASHBOARDS_FILE = path.join(process.cwd(), 'data', 'dashboards.json');

const dashboardsApiLogger = createContextLogger('api-dashboards');

// Ensure data directory exists
const ensureDataDirectory = () => {
  const dataDir = path.dirname(DASHBOARDS_FILE);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
};

// Load dashboards from file
const loadDashboards = (): Dashboard[] => {
  try {
    ensureDataDirectory();
    
    if (!fs.existsSync(DASHBOARDS_FILE)) {
      // Initialize with default dashboards
      const defaultDashboards: Dashboard[] = [
        {
          id: 'common-dashboard',
          name: 'Grafana VTEX', 
          url: 'https://grafana.vtex.com/d/d7e7051f-42a2-4798-af93-cf2023dd2e28/home?orgId=1&from=now-3h&to=now&timezone=browser&var-Origin=argocd&refresh=10s',
          description: 'Common dashboard for all systems',
          refreshInterval: 300,
          requiresAuth: true,
          category: 'Monitoring'
        },
        {
          id: 'health-monitor',
          name: 'Health Monitor',
          url: 'https://healthmonitor.vtex.com/',
          description: 'Health monitor for all systems',
          refreshInterval: 600,
          requiresAuth: true,
          category: 'Business Intelligence'
        }
      ];
      
      saveDashboards(defaultDashboards);
      return defaultDashboards;
    }
    
    const data = fs.readFileSync(DASHBOARDS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    dashboardsApiLogger.error('Error loading dashboards', { error: error instanceof Error ? error.message : String(error) });
    return [];
  }
};

// Save dashboards to file
const saveDashboards = (dashboards: Dashboard[]): void => {
  try {
    ensureDataDirectory();
    fs.writeFileSync(DASHBOARDS_FILE, JSON.stringify(dashboards, null, 2), 'utf8');
  } catch (error) {
    dashboardsApiLogger.error('Error saving dashboards', { error: error instanceof Error ? error.message : String(error) });
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

// Generate unique ID
const generateId = (): string => {
  return `dashboard-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    switch (req.method) {
      case 'GET':
        // List all dashboards
        const dashboards = loadDashboards();
        return res.status(200).json({
          success: true,
          data: dashboards
        });

      case 'POST':
        // Create new dashboard
        const { body } = req;
        
        if (!validateDashboard(body)) {
          return res.status(400).json({
            success: false,
            error: 'Invalid dashboard data. Required fields: name, url, description, refreshInterval, requiresAuth'
          });
        }

        const newDashboard: Dashboard = {
          id: generateId(),
          name: body.name,
          url: body.url,
          description: body.description,
          refreshInterval: body.refreshInterval,
          requiresAuth: body.requiresAuth,
          category: body.category
        };

        const currentDashboards = loadDashboards();
        
        // Check for duplicate names
        if (currentDashboards.some(d => d.name === newDashboard.name)) {
          return res.status(400).json({
            success: false,
            error: 'Dashboard with this name already exists'
          });
        }

        currentDashboards.push(newDashboard);
        saveDashboards(currentDashboards);

        return res.status(201).json({
          success: true,
          data: newDashboard
        });

      case 'PUT':
        // Update dashboard
        const { id } = req.query;
        const updateData = req.body;
        
        if (!id || typeof id !== 'string') {
          return res.status(400).json({
            success: false,
            error: 'Dashboard ID is required'
          });
        }

        if (!validateDashboard(updateData)) {
          return res.status(400).json({
            success: false,
            error: 'Invalid dashboard data'
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

        return res.status(200).json({
          success: true,
          data: updatedDashboard
        });

      case 'DELETE':
        // Delete dashboard
        const { id: deleteId } = req.query;
        
        if (!deleteId || typeof deleteId !== 'string') {
          return res.status(400).json({
            success: false,
            error: 'Dashboard ID is required'
          });
        }

        const dashboardsToDelete = loadDashboards();
        const deleteIndex = dashboardsToDelete.findIndex(d => d.id === deleteId);
        
        if (deleteIndex === -1) {
          return res.status(404).json({
            success: false,
            error: 'Dashboard not found'
          });
        }

        const deletedDashboard = dashboardsToDelete[deleteIndex];
        dashboardsToDelete.splice(deleteIndex, 1);
        saveDashboards(dashboardsToDelete);

        return res.status(200).json({
          success: true,
          data: deletedDashboard
        });

      default:
        res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
        return res.status(405).json({
          success: false,
          error: `Method ${req.method} Not Allowed`
        });
    }
  } catch (error: any) {
    dashboardsApiLogger.error('Dashboards API error', { error: error instanceof Error ? error.message : String(error) });
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
}