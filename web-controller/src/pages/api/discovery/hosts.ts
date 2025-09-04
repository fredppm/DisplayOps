import { NextApiRequest, NextApiResponse } from 'next';
import { discoveryService } from '@/lib/discovery-singleton';
import { MiniPC, ApiResponse } from '@/types/shared-types';
import { createContextLogger } from '@/utils/logger';
// import { getGrpcHostManager } from '../grpc-manager'; // Temporarily disabled

const discoveryApiLogger = createContextLogger('api-discovery');

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<MiniPC[]>>
) {
  try {
    discoveryApiLogger.info('Discovery API call received', { method: req.method });
    
    switch (req.method) {
      case 'GET':
        discoveryApiLogger.info('Initializing discovery service');
        
        let hosts: MiniPC[] = [];
        let initError: string | null = null;
        
        // Initialize discovery singleton with detailed error handling
        try {
          await discoveryService.initialize();
          discoveryApiLogger.info('Discovery service initialized successfully');
          hosts = discoveryService.getHosts();
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          discoveryApiLogger.error('Discovery service initialization failed', {
            error: errorMessage,
            stack: error instanceof Error ? error.stack : undefined
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
        
        discoveryApiLogger.info('REST API returning hosts', { 
          hostCount: hosts.length, 
          status: initError ? 'warning' : 'healthy',
          warning: initError || undefined
        });
        
        res.status(200).json(response);
        break;

      case 'POST':
        // Manual host addition
        discoveryApiLogger.info('POST request received for manual host addition');
        const { host } = req.body;
        
        if (!host) {
          discoveryApiLogger.error('POST request missing host data');
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
          discoveryApiLogger.info('Manual host added successfully', { hostId: host.id || host.ipAddress });
          
          const successResponse: ApiResponse<MiniPC[]> = {
            success: true,
            data: discoveryService.getHosts(),
            timestamp: new Date()
          };
          
          res.status(200).json(successResponse);
        } catch (error) {
          discoveryApiLogger.error('Failed to add manual host', { error: error instanceof Error ? error.message : String(error) });
          throw error; // Let the outer catch handle this
        }
        break;

      case 'DELETE':
        // Stop discovery service
        discoveryApiLogger.info('DELETE request received - stopping discovery service');
        try {
          await discoveryService.stop();
          discoveryApiLogger.info('Discovery service stopped successfully');
          
          const deleteResponse: ApiResponse<MiniPC[]> = {
            success: true,
            data: [],
            timestamp: new Date()
          };
          
          res.status(200).json(deleteResponse);
        } catch (error) {
          discoveryApiLogger.error('Failed to stop discovery service', { error: error instanceof Error ? error.message : String(error) });
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
    discoveryApiLogger.error('Discovery API error', {
      method: req.method,
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
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
