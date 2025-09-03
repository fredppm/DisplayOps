import { NextApiResponse } from 'next';
import { Controller, ApiResponse } from '@/types/multi-site-types';
import { withPermission, ProtectedApiRequest } from '@/lib/api-protection';
import { controllersRepository, sitesRepository } from '@/lib/repositories';


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
      const controller = await controllersRepository.getById(id);

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
  } else if (req.method === 'DELETE') {
    try {
      const controller = await controllersRepository.getById(id);
      
      if (!controller) {
        return res.status(404).json({
          success: false,
          error: 'Controller not found',
          timestamp: new Date().toISOString()
        });
      }

      // Delete controller using repository
      await controllersRepository.delete(id);

      // Remove controller from site's controllers list if it has a siteId
      if (controller.siteId) {
        const site = await sitesRepository.getById(controller.siteId);
        if (site) {
          const updatedControllers = site.controllers.filter(cId => cId !== id);
          await sitesRepository.update(controller.siteId, {
            controllers: updatedControllers
          });
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
    res.setHeader('Allow', ['GET', 'DELETE']);
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