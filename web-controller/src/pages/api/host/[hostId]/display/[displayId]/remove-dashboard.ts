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
    const client = grpcManager.getClient(hostId as string);
    if (!client) {
      return res.status(404).json({ 
        success: false, 
        error: 'Host not found or not connected' 
      });
    }

    // Remove dashboard by restarting browser for specific display
    const result = await client.restartBrowser(hostId as string, [displayId as string], false);

    if (result.success) {
      res.status(200).json({ 
        success: true, 
        message: `Dashboard removed from ${displayId}`,
        data: {
          restartedDisplays: result.restarted_displays || [],
          failedDisplays: result.failed_displays || []
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