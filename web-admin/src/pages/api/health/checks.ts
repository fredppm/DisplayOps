import type { NextApiRequest, NextApiResponse } from 'next';
import { getGrpcServerStatus } from '@/lib/grpc-server-init';
import fs from 'fs/promises';
import path from 'path';

const CONTROLLERS_FILE = path.join(process.cwd(), 'data', 'controllers.json');

interface HealthCheck {
  name: string;
  status: 'healthy' | 'warning' | 'critical' | 'unknown';
  message?: string;
  lastCheck: string;
  responseTime?: number;
}

interface HealthChecksResponse {
  success: boolean;
  data: {
    checks: HealthCheck[];
    overallStatus: 'healthy' | 'warning' | 'critical';
  };
  timestamp: string;
}

async function readControllersData(): Promise<any> {
  try {
    const data = await fs.readFile(CONTROLLERS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    return { controllers: [] };
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<HealthChecksResponse>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      data: { checks: [], overallStatus: 'critical' },
      timestamp: new Date().toISOString()
    });
  }

  try {
    // Get real gRPC status
    const grpcStatus = getGrpcServerStatus();
    const grpcConnections = grpcStatus.connectionStats?.connected || 0;
    
    // Get controllers data
    const controllersData = await readControllersData();
    const controllers = controllersData.controllers || [];
    const onlineControllers = controllers.filter((c: any) => c.status === 'online').length;
    
    const checks: HealthCheck[] = [
      {
        name: 'gRPC Service',
        status: grpcStatus.running ? 'healthy' : 'critical',
        message: grpcStatus.running 
          ? `Running on port ${grpcStatus.port} with ${grpcConnections} active connections`
          : 'gRPC server is not running',
        lastCheck: new Date().toISOString()
      },
      {
        name: 'Controllers Sync',
        status: grpcConnections > 0 ? 'healthy' : 
                controllers.length === 0 ? 'healthy' : 'warning',
        message: grpcConnections > 0 
          ? `${grpcConnections} controller(s) connected`
          : controllers.length === 0 
            ? 'No controllers registered'
            : `${onlineControllers}/${controllers.length} controllers online, none connected via gRPC`,
        lastCheck: new Date().toISOString()
      }
    ];

    // Determinar status geral
    const hasAnyUnhealthy = checks.some(check => 
      check.status === 'critical' || check.status === 'unknown'
    );
    const hasAnyWarning = checks.some(check => check.status === 'warning');

    const overallStatus: 'healthy' | 'warning' | 'critical' = 
      hasAnyUnhealthy ? 'critical' :
      hasAnyWarning ? 'warning' : 'healthy';

    res.status(200).json({
      success: true,
      data: {
        checks,
        overallStatus
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Health checks error:', error);
    
    res.status(500).json({
      success: false,
      data: { 
        checks: [], 
        overallStatus: 'critical' 
      },
      timestamp: new Date().toISOString()
    });
  }
}