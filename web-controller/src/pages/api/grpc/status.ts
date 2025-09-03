import { NextApiRequest, NextApiResponse } from 'next';
import { grpcClientSingleton } from '@/lib/grpc-client-singleton';

interface GrpcClientStatusResponse {
  success: boolean;
  data: {
    running: boolean;
    connected: boolean;
    registered: boolean;
    controllerId: string | null;
    config: {
      adminHost: string;
      adminPort: number;
      heartbeatInterval?: number;
    };
    reconnectAttempts: number;
  };
  timestamp: string;
}

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<GrpcClientStatusResponse>
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({
      success: false,
      data: {
        running: false,
        connected: false,
        registered: false,
        controllerId: null,
        config: {
          adminHost: 'unknown',
          adminPort: 0
        },
        reconnectAttempts: 0
      },
      timestamp: new Date().toISOString()
    });
  }

  try {
    const status = grpcClientSingleton.getStatus();
    
    res.status(200).json({
      success: true,
      data: {
        running: status.running,
        connected: status.connected,
        registered: status.registered,
        controllerId: status.controllerId || null,
        config: status.config,
        reconnectAttempts: status.reconnectAttempts
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      data: {
        running: false,
        connected: false,
        registered: false,
        controllerId: null,
        config: {
          adminHost: 'error',
          adminPort: 0
        },
        reconnectAttempts: 0
      },
      timestamp: new Date().toISOString()
    });
  }
}