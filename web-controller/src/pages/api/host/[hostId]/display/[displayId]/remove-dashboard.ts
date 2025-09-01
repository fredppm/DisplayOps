import { NextApiRequest, NextApiResponse } from 'next';
import { grpcManager } from '@/lib/server/grpc-manager';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ 
      success: false, 
      error: 'Method not allowed. Use DELETE.' 
    });
  }

  const { hostId, displayId } = req.query;

  if (!hostId || !displayId) {
    return res.status(400).json({ 
      success: false, 
      error: 'Missing hostId or displayId parameters' 
    });
  }

  try {
    // Remove dashboard using dedicated REMOVE_DASHBOARD command
    const result = await grpcManager.removeDashboard(hostId as string, displayId as string);

    if (result.success) {
      res.status(200).json({ 
        success: true, 
        message: `Dashboard removed from ${displayId}`,
        data: {
          displayId: result.remove_dashboard_result?.display_id,
          dashboardRemoved: result.remove_dashboard_result?.dashboard_removed,
          statusMessage: result.remove_dashboard_result?.status_message
        }
      });
    } else {
      res.status(400).json({ 
        success: false, 
        error: result.error || 'Failed to remove dashboard' 
      });
    }
  } catch (error) {
    console.error('Error removing dashboard:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
}