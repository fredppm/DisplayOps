import { NextApiRequest, NextApiResponse } from 'next';
import { discoveryService } from '@/lib/discovery-singleton';
import { MiniPC, ApiResponse } from '@/types/shared-types';
// import { getGrpcHostManager } from '../grpc-manager'; // Temporarily disabled

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<MiniPC[]>>
) {
  try {
    console.log('🔍 API call received:', req.method);
    
    switch (req.method) {
      case 'GET':
        console.log('🚀 Initializing discovery service...');
        
        // Initialize discovery singleton if not already done
        try {
          await discoveryService.initialize();
          console.log('✅ Discovery service initialized');
        } catch (error) {
          console.error('❌ Discovery service initialization failed:', error);
          throw error;
        }
        
        const hosts = discoveryService.getHosts();
        
        // Sync hosts with gRPC manager - temporarily disabled
        // const grpcManager = getGrpcHostManager();
        // hosts.forEach(host => {
        //   grpcManager.addHost({
        //     id: host.id,
        //     name: host.name,
        //     hostname: host.hostname,
        //     ipAddress: host.ipAddress,
        //     port: host.port,
        //     grpcPort: 8082 // Default gRPC port
        //   });
        // });
        const response: ApiResponse<MiniPC[]> = {
          success: true,
          data: hosts,
          timestamp: new Date()
        };
        
        console.log('📡 REST API returning hosts:', hosts.length);
        
        res.status(200).json(response);
        break;

      case 'POST':
        // Manual host addition
        const { host } = req.body;
        
        if (!host) {
          const errorResponse: ApiResponse<MiniPC[]> = {
            success: false,
            error: 'Host data is required',
            timestamp: new Date()
          };
          res.status(400).json(errorResponse);
          return;
        }

        await discoveryService.initialize();
        discoveryService.addManualHost(host);
        
        const successResponse: ApiResponse<MiniPC[]> = {
          success: true,
          data: discoveryService.getHosts(),
          timestamp: new Date()
        };
        
        res.status(200).json(successResponse);
        break;

      case 'DELETE':
        // Stop discovery service
        await discoveryService.stop();
        
        const deleteResponse: ApiResponse<MiniPC[]> = {
          success: true,
          data: [],
          timestamp: new Date()
        };
        
        res.status(200).json(deleteResponse);
        break;

      default:
        res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
        const methodErrorResponse: ApiResponse<MiniPC[]> = {
          success: false,
          error: `Method ${req.method} Not Allowed`,
          timestamp: new Date()
        };
        res.status(405).json(methodErrorResponse);
        break;
    }
  } catch (error) {
    console.error('Discovery API error:', error);
    
    const errorResponse: ApiResponse<MiniPC[]> = {
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      timestamp: new Date()
    };
    
    res.status(500).json(errorResponse);
  }
}

// Cleanup is handled by the discovery singleton
