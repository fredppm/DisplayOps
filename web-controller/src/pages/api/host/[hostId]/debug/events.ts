import { NextApiRequest, NextApiResponse } from 'next';
import { grpcManager } from '@/lib/server/grpc-manager';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { hostId } = req.query;
  
  if (!['GET', 'DELETE'].includes(req.method!)) {
    res.setHeader('Allow', ['GET', 'DELETE']);
    return res.status(405).json({
      success: false,
      error: `Method ${req.method} Not Allowed`
    });
  }

  try {
    // 🚀 Use gRPC instead of direct HTTP proxy
    await grpcManager.initialize();
    
    let result;

    if (req.method === 'GET') {
      // Parse query parameters for GET requests
      const options: { limit?: number; since?: string } = {};
      
      if (req.query.limit) {
        options.limit = parseInt(req.query.limit as string);
      }
      
      if (req.query.since) {
        options.since = req.query.since as string;
      }

      result = await grpcManager.getDebugEvents(hostId as string, options);
    } else if (req.method === 'DELETE') {
      result = await grpcManager.clearDebugEvents(hostId as string);
    }

    res.status(200).json(result);

  } catch (error) {
    console.error('gRPC debug events proxy error:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('Invalid host ID format')) {
        return res.status(400).json({
          success: false,
          error: 'Invalid host ID format'
        });
      }
      
      if (error.message.includes('not connected')) {
        return res.status(503).json({
          success: false,
          error: 'Host not available via gRPC'
        });
      }
    }
    
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
}