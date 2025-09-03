import { NextApiRequest, NextApiResponse } from 'next';
import { syncProtocol } from '@/lib/sync-protocol';
import { ApiResponse } from '@/types/multi-site-types';

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<any>>
) {
  if (req.method === 'GET') {
    try {
      const orderingStats = syncProtocol.getOrderingStats();
      
      res.status(200).json({
        success: true,
        data: orderingStats,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get ordering stats',
        timestamp: new Date().toISOString()
      });
    }
  } else {
    res.setHeader('Allow', ['GET']);
    res.status(405).json({
      success: false,
      error: 'Method not allowed',
      timestamp: new Date().toISOString()
    });
  }
}