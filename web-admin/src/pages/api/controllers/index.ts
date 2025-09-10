import { NextApiResponse } from 'next';
import { Controller, ApiResponse } from '@/types/multi-site-types';
import { withPermission, ProtectedApiRequest } from '@/lib/api-protection';
import { controllersRepository } from '@/lib/repositories';

async function handler(req: ProtectedApiRequest, res: NextApiResponse<ApiResponse<Controller[] | Controller>>) {
  if (req.method === 'GET') {
    try {
      const { siteId } = req.query;
      
      let controllers;
      if (siteId && typeof siteId === 'string') {
        controllers = await controllersRepository.getBySiteId(siteId);
      } else {
        controllers = await controllersRepository.getAll();
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
  } else {
    res.setHeader('Allow', ['GET']);
    res.status(405).json({
      success: false,
      error: `Method ${req.method} not allowed`,
      timestamp: new Date().toISOString()
    });
  }
}

// Export with authentication and permission checking
// GET requires 'controllers:read' permission
export default withPermission('controllers:read')(handler);