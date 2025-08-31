import { NextApiRequest, NextApiResponse } from 'next';
import { discoveryService } from '@/lib/discovery-singleton';
import { MiniPC, ApiResponse } from '@/types/shared-types';
// import { getGrpcHostManager } from '../grpc-manager'; // Temporarily disabled

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<MiniPC[]>>
) {
  try {
    console.log('🔍 API call received:', req.method, 'at', new Date().toISOString());
    
    switch (req.method) {
      case 'GET':
        console.log('🚀 Initializing discovery service...');
        
        let hosts: MiniPC[] = [];
        let initError: string | null = null;
        
        // Initialize discovery singleton with detailed error handling
        try {
          await discoveryService.initialize();
          console.log('✅ Discovery service initialized successfully');
          hosts = discoveryService.getHosts();
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.error('❌ Discovery service initialization failed:', {
            error: errorMessage,
            stack: error instanceof Error ? error.stack : undefined,
            timestamp: new Date().toISOString()
          });
          
          // Store error but don't throw - return empty list with warning
          initError = errorMessage;
          hosts = [];
        }
        
        const response: ApiResponse<MiniPC[]> = {
          success: true,
          data: hosts,
          timestamp: new Date(),
          ...(initError && { warning: `Discovery service error: ${initError}` })
        };
        
        console.log('📡 REST API returning hosts:', hosts.length, initError ? `(with warning: ${initError})` : '(healthy)');
        
        res.status(200).json(response);
        break;

      case 'POST':
        // Manual host addition
        console.log('📝 POST request received for manual host addition');
        const { host } = req.body;
        
        if (!host) {
          console.error('❌ POST request missing host data');
          const errorResponse: ApiResponse<MiniPC[]> = {
            success: false,
            error: 'Host data is required',
            timestamp: new Date()
          };
          res.status(400).json(errorResponse);
          return;
        }

        try {
          await discoveryService.initialize();
          discoveryService.addManualHost(host);
          console.log('✅ Manual host added successfully:', host.id || host.ipAddress);
          
          const successResponse: ApiResponse<MiniPC[]> = {
            success: true,
            data: discoveryService.getHosts(),
            timestamp: new Date()
          };
          
          res.status(200).json(successResponse);
        } catch (error) {
          console.error('❌ Failed to add manual host:', error);
          throw error; // Let the outer catch handle this
        }
        break;

      case 'DELETE':
        // Stop discovery service
        console.log('🛑 DELETE request received - stopping discovery service');
        try {
          await discoveryService.stop();
          console.log('✅ Discovery service stopped successfully');
          
          const deleteResponse: ApiResponse<MiniPC[]> = {
            success: true,
            data: [],
            timestamp: new Date()
          };
          
          res.status(200).json(deleteResponse);
        } catch (error) {
          console.error('❌ Failed to stop discovery service:', error);
          throw error; // Let the outer catch handle this
        }
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
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('❌ Discovery API error:', {
      method: req.method,
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
      url: req.url
    });
    
    const errorResponse: ApiResponse<MiniPC[]> = {
      success: false,
      error: errorMessage || 'Internal server error',
      timestamp: new Date()
    };
    
    res.status(500).json(errorResponse);
  }
}

// Cleanup is handled by the discovery singleton
