import { NextApiRequest, NextApiResponse } from 'next';
import { discoveryService } from '@/lib/discovery-singleton';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { hostId } = req.query;
  
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({
      success: false,
      error: `Method ${req.method} Not Allowed`
    });
  }

  try {
    // Ensure discovery service is initialized
    await discoveryService.initialize();
    
    // Get gRPC service from discovery
    const grpcService = discoveryService.getGrpcService();
    
    // Use gRPC to get host health status (which includes display info)
    const healthResponse = await grpcService.getHealthStatus(hostId as string);
    
    // Convert gRPC response to windows/displays format
    const responseData = {
      success: true,
      displays: healthResponse.display_statuses || [],
      system_info: healthResponse.system_info || {},
      host_status: healthResponse.host_status || {}
    };

    res.status(200).json(responseData);

  } catch (error: any) {
    console.error('Windows gRPC error:', error);
    
    if (error?.message?.includes('not connected') || error?.message?.includes('not found')) {
      return res.status(404).json({
        success: false,
        error: 'Host not found or not connected'
      });
    }
    
    res.status(500).json({
      success: false,
      error: error?.message || 'Internal server error'
    });
  }
}