import { NextApiRequest, NextApiResponse } from 'next';
import { getGrpcServerStatus } from '@/lib/grpc-server-init';
import { grpcServerSingleton } from '@/lib/grpc-server-singleton';

interface GrpcStatusResponse {
  success: boolean;
  data: {
    initialized: boolean;
    running: boolean;
    port: number;
    connectionStats: {
      connected: number;
      connections: Array<{
        controllerId: string;
        lastHeartbeat: Date;
        isRegistered: boolean;
      }>;
    };
  };
  timestamp: string;
}

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<GrpcStatusResponse>
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({
      success: false,
      data: {
        initialized: false,
        running: false,
        port: 0,
        connectionStats: { connected: 0, connections: [] }
      },
      timestamp: new Date().toISOString()
    });
  }

  try {
    const status = getGrpcServerStatus();
    
    res.status(200).json({
      success: true,
      data: status,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      data: {
        initialized: false,
        running: false,
        port: grpcServerSingleton.getPort(),
        connectionStats: { connected: 0, connections: [] }
      },
      timestamp: new Date().toISOString()
    });
  }
}