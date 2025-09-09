import { NextApiRequest, NextApiResponse } from 'next';
import { grpcServerSingleton } from '@/lib/grpc-server-singleton';
import { getGrpcServerStatus, initializeGrpcServer } from '@/lib/grpc-server-init';
import { createContextLogger } from '@/utils/logger';

const logger = createContextLogger('grpc-debug');

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { action } = req.query;

  try {
    switch (action) {
      case 'status':
        const status = getGrpcServerStatus();
        const isRunning = grpcServerSingleton.isRunning();
        const connectionStats = grpcServerSingleton.getConnectionStats();
        
        return res.json({
          success: true,
          data: {
            status,
            isRunning,
            connectionStats,
            port: grpcServerSingleton.getPort(),
            environmentVariables: {
              GRPC_CONTROLLER_ADMIN_ENABLED: process.env.GRPC_CONTROLLER_ADMIN_ENABLED,
              GRPC_CONTROLLER_ADMIN_PORT: process.env.GRPC_CONTROLLER_ADMIN_PORT,
              NODE_ENV: process.env.NODE_ENV
            }
          }
        });

      case 'start':
        logger.info('Manual gRPC server start requested');
        await initializeGrpcServer();
        const statusAfterStart = getGrpcServerStatus();
        
        return res.json({
          success: true,
          message: 'gRPC server initialization attempted',
          data: statusAfterStart
        });

      case 'restart':
        logger.info('Manual gRPC server restart requested');
        const server = await grpcServerSingleton.restart();
        const statusAfterRestart = getGrpcServerStatus();
        
        return res.json({
          success: true,
          message: 'gRPC server restart completed',
          data: statusAfterRestart
        });

      case 'stop':
        logger.info('Manual gRPC server stop requested');
        await grpcServerSingleton.stop();
        const statusAfterStop = getGrpcServerStatus();
        
        return res.json({
          success: true,
          message: 'gRPC server stopped',
          data: statusAfterStop
        });

      default:
        return res.status(400).json({
          success: false,
          error: 'Invalid action. Use: status, start, restart, or stop'
        });
    }
  } catch (error) {
    logger.error('gRPC debug endpoint error:', error);
    
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
  }
}