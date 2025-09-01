import { NextApiRequest, NextApiResponse } from 'next';
import { grpcClientService } from '@/lib/server/grpc-client-service';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { hostId } = req.query;
  const { action } = req.body; // 'enable' or 'disable'
  
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({
      success: false,
      error: `Method ${req.method} Not Allowed`
    });
  }

  if (!action || !['enable', 'disable'].includes(action)) {
    return res.status(400).json({
      success: false,
      error: 'Action must be "enable" or "disable"'
    });
  }

  try {
    // Use gRPC client service instead of HTTP proxy
    let result;
    if (action === 'enable') {
      result = await grpcClientService.enableDebugMode(hostId as string);
    } else {
      result = await grpcClientService.disableDebugMode(hostId as string);
    }

    res.status(200).json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Debug toggle gRPC error:', error);
    
    if (error instanceof Error && error.message.includes('Host') && error.message.includes('not connected')) {
      return res.status(503).json({
        success: false,
        error: 'Host is not connected via gRPC'
      });
    }
    
    if (error instanceof Error && error.message.includes('Invalid host ID')) {
      return res.status(400).json({
        success: false,
        error: 'Invalid host ID format'
      });
    }
    
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
}