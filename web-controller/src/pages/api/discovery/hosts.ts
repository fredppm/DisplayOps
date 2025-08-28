import { NextApiRequest, NextApiResponse } from 'next';
import { WindowsDiscoveryService } from '@/lib/windows-discovery-service';
import { MiniPC, ApiResponse } from '@/types/types';

// Global discovery service instance
let discoveryService: WindowsDiscoveryService | null = null;
let discoveredHosts: MiniPC[] = [];

// Initialize discovery service
const initializeDiscoveryService = async () => {
  if (!discoveryService) {
    discoveryService = new WindowsDiscoveryService();
    
    // Set up event handlers
    discoveryService.onHostDiscovered((host) => {
      const existingIndex = discoveredHosts.findIndex(h => h.id === host.id);
      if (existingIndex >= 0) {
        discoveredHosts[existingIndex] = host;
      } else {
        discoveredHosts.push(host);
      }
    });

    discoveryService.onHostRemoved((hostId) => {
      discoveredHosts = discoveredHosts.filter(h => h.id !== hostId);
    });

    // Start discovery
    try {
      await discoveryService.startDiscovery();
      console.log('Discovery service started successfully');
    } catch (error) {
      console.error('Failed to start discovery service:', error);
    }
  }
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<MiniPC[]>>
) {
  try {
    switch (req.method) {
      case 'GET':
        // Initialize discovery if not already done
        await initializeDiscoveryService();
        
        const response: ApiResponse<MiniPC[]> = {
          success: true,
          data: discoveredHosts,
          timestamp: new Date()
        };
        
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

        await initializeDiscoveryService();
        
        if (discoveryService) {
          discoveryService.addManualHost(host);
        }
        
        const successResponse: ApiResponse<MiniPC[]> = {
          success: true,
          data: discoveredHosts,
          timestamp: new Date()
        };
        
        res.status(200).json(successResponse);
        break;

      case 'DELETE':
        // Stop discovery service
        if (discoveryService) {
          discoveryService.stopDiscovery();
          discoveryService = null;
          discoveredHosts = [];
        }
        
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

// Cleanup on process exit
process.on('SIGTERM', () => {
  if (discoveryService) {
    discoveryService.stopDiscovery();
  }
});

process.on('SIGINT', () => {
  if (discoveryService) {
    discoveryService.stopDiscovery();
  }
});
