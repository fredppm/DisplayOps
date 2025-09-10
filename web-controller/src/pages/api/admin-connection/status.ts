import { NextApiRequest, NextApiResponse } from 'next';
import { hybridAdminClientSingleton } from '@/lib/hybrid-admin-client-singleton';

interface AdminConnectionStatusResponse {
  success: boolean;
  data: {
    running: boolean;
    connected: boolean;
    registered: boolean;
    controllerId: string | null;
    connectionMode: 'websocket' | 'http' | 'none';
    config: {
      adminHost: string;
      adminPort: number;
      heartbeatInterval?: number;
      preferWebSocket?: boolean;
    };
    connectionInfo: {
      mode: 'websocket' | 'http' | 'none';
      connected: boolean;
      registered: boolean;
      attempts: number;
    };
  };
  timestamp: string;
}

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<AdminConnectionStatusResponse>
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
        connectionMode: 'none',
        config: {
          adminHost: 'unknown',
          adminPort: 0
        },
        connectionInfo: {
          mode: 'none',
          connected: false,
          registered: false,
          attempts: 0
        }
      },
      timestamp: new Date().toISOString()
    });
  }

  try {
    const isRunning = hybridAdminClientSingleton.isRunning();
    const isConnected = hybridAdminClientSingleton.isConnected();
    const isRegistered = hybridAdminClientSingleton.isRegistered();
    const controllerId = hybridAdminClientSingleton.getControllerId();
    const connectionMode = hybridAdminClientSingleton.getConnectionMode();
    const config = hybridAdminClientSingleton.getConfig();
    const connectionInfo = hybridAdminClientSingleton.getConnectionInfo();

    return res.status(200).json({
      success: true,
      data: {
        running: isRunning,
        connected: isConnected,
        registered: isRegistered,
        controllerId: controllerId !== 'unknown' ? controllerId : null,
        connectionMode,
        config: {
          adminHost: config.adminHost,
          adminPort: config.adminPort,
          heartbeatInterval: config.heartbeatInterval,
          preferWebSocket: config.preferWebSocket
        },
        connectionInfo
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error getting admin connection status:', error);
    
    return res.status(500).json({
      success: false,
      data: {
        running: false,
        connected: false,
        registered: false,
        controllerId: null,
        connectionMode: 'none',
        config: {
          adminHost: 'error',
          adminPort: 0
        },
        connectionInfo: {
          mode: 'none',
          connected: false,
          registered: false,
          attempts: 0
        }
      },
      timestamp: new Date().toISOString()
    });
  }
}