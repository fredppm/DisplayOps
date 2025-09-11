import { NextApiRequest, NextApiResponse } from 'next';
import { Dashboard } from '@/types/shared-types';
import { createContextLogger } from '@/utils/logger';
import { webSocketServerSingleton } from '@/lib/websocket-server-singleton';
import { dashboardsRepository } from '@/lib/repositories/DashboardsRepository';

const dashboardsApiLogger = createContextLogger('api-dashboards');

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
    dashboardsApiLogger.info('Dashboard sync triggered successfully');
  } catch (error) {
    dashboardsApiLogger.error('Failed to trigger dashboard sync', { 
      error: error instanceof Error ? error.message : String(error) 
    });
  }
};

async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    switch (req.method) {
      case 'GET':
        // List all dashboards
        const dashboards = await dashboardsRepository.getAll();
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

        // Check for duplicate names
        const existingDashboard = await dashboardsRepository.getByName(body.name);
        if (existingDashboard) {
          return res.status(400).json({
            success: false,
            error: 'Dashboard with this name already exists'
          });
        }

        const newDashboard = await dashboardsRepository.createWithId({
          name: body.name,
          url: body.url,
          description: body.description,
          refreshInterval: body.refreshInterval,
          requiresAuth: body.requiresAuth,
          category: body.category
        });

        // Trigger sync to all controllers
        await triggerDashboardSync();

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

        const currentDashboard = await dashboardsRepository.getById(id);
        if (!currentDashboard) {
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

        if (!updatedDashboard) {
          return res.status(500).json({
            success: false,
            error: 'Failed to update dashboard'
          });
        }

        // Trigger sync to all controllers
        await triggerDashboardSync();

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

        const dashboardToDelete = await dashboardsRepository.getById(deleteId);
        if (!dashboardToDelete) {
          return res.status(404).json({
            success: false,
            error: 'Dashboard not found'
          });
        }

        const deleteSuccess = await dashboardsRepository.delete(deleteId);
        if (!deleteSuccess) {
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

// Export with authentication and permission checking
// Requires 'dashboards:read' permission for GET, 'dashboards:write' for modifications
// TEMP: Disabled protection for testing
export default handler;