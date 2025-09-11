import { NextApiRequest, NextApiResponse } from 'next';
import { Dashboard } from '@/types/shared-types';
import { createContextLogger } from '@/utils/logger';
import { webSocketServerSingleton } from '@/lib/websocket-server-singleton';
import { dashboardsRepository } from '@/lib/repositories/DashboardsRepository';

const dashboardsByIdLogger = createContextLogger('api-dashboards-by-id');


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
        const dashboard = await dashboardsRepository.getById(id);
        
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

        const existingDashboard = await dashboardsRepository.getById(id);
        
        if (!existingDashboard) {
          return res.status(404).json({
            success: false,
            error: 'Dashboard not found'
          });
        }

        // Check for duplicate names (excluding current dashboard)
        const duplicateNameCheck = await dashboardsRepository.getByName(updateData.name);
        if (duplicateNameCheck && duplicateNameCheck.id !== id) {
          return res.status(400).json({
            success: false,
            error: 'Dashboard with this name already exists'
          });
        }

        const updatedDashboard = await dashboardsRepository.update(id, {
          name: updateData.name,
          url: updateData.url,
          description: updateData.description,
          refreshInterval: updateData.refreshInterval,
          requiresAuth: updateData.requiresAuth,
          category: updateData.category
        });

        // Trigger sync to all controllers
        await triggerDashboardSync();

        return res.status(200).json({
          success: true,
          data: updatedDashboard
        });

      case 'DELETE':
        // Delete specific dashboard
        const dashboardToDelete = await dashboardsRepository.getById(id);
        
        if (!dashboardToDelete) {
          return res.status(404).json({
            success: false,
            error: 'Dashboard not found'
          });
        }

        const deleted = await dashboardsRepository.delete(id);
        
        if (!deleted) {
          return res.status(500).json({
            success: false,
            error: 'Failed to delete dashboard'
          });
        }

        // Trigger sync to all controllers
        await triggerDashboardSync();

        return res.status(200).json({
          success: true,
          data: dashboardToDelete
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