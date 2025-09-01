import type { NextApiRequest, NextApiResponse } from 'next';
import { grpcManager } from '@/lib/server/grpc-manager';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const { method } = req;

    switch (method) {
      case 'GET':
        // Get connection statistics
        const stats = grpcManager.getConnectionStats();
        
        res.status(200).json({
          success: true,
          stats,
          timestamp: new Date().toISOString()
        });
        break;

      case 'POST':
        // Handle debug commands
        const { action, hostId } = req.body;
        
        switch (action) {
          case 'reset_connection':
            if (!hostId) {
              return res.status(400).json({
                success: false,
                error: 'hostId is required for reset_connection action'
              });
            }
            
            await grpcManager.resetConnectionAttempts(hostId);
            
            res.status(200).json({
              success: true,
              message: `Connection attempts reset for host ${hostId}`,
              timestamp: new Date().toISOString()
            });
            break;

          case 'force_reconnect':
            if (!hostId) {
              return res.status(400).json({
                success: false,
                error: 'hostId is required for force_reconnect action'
              });
            }
            
            // First reset connection attempts
            await grpcManager.resetConnectionAttempts(hostId);
            
            // Then attempt to reconnect
            const result = await grpcManager.forceReconnectHost(hostId);
            
            res.status(200).json({
              success: true,
              message: `Force reconnect initiated for host ${hostId}`,
              result,
              timestamp: new Date().toISOString()
            });
            break;

          case 'get_detailed_status':
            if (!hostId) {
              return res.status(400).json({
                success: false,
                error: 'hostId is required for get_detailed_status action'
              });
            }
            
            const detailedStatus = await grpcManager.getDetailedHostStatus(hostId);
            
            res.status(200).json({
              success: true,
              hostId,
              status: detailedStatus,
              timestamp: new Date().toISOString()
            });
            break;

          case 'clear_all_circuit_breakers':
            await grpcManager.clearAllCircuitBreakers();
            
            res.status(200).json({
              success: true,
              message: 'All circuit breakers cleared',
              timestamp: new Date().toISOString()
            });
            break;

          default:
            res.status(400).json({
              success: false,
              error: `Unknown action: ${action}`
            });
            break;
        }
        break;

      default:
        res.setHeader('Allow', ['GET', 'POST']);
        res.status(405).json({
          success: false,
          error: `Method ${method} not allowed`
        });
        break;
    }
  } catch (error) {
    console.error('gRPC Debug API Error:', error);
    
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}