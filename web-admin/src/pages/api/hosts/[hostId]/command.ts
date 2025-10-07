import { NextApiRequest, NextApiResponse } from 'next';
import { createContextLogger } from '@/utils/logger';
import { hostsRepository } from '@/lib/repositories/HostsRepository';
import { GrpcHostClient } from '@/lib/grpc-host-client';

const hostCommandLogger = createContextLogger('host-command');

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { hostId } = req.query;
  
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({
      success: false,
      error: `Method ${req.method} Not Allowed`,
      timestamp: new Date().toISOString()
    });
  }

  try {
    // Get host information
    const host = await hostsRepository.getById(hostId as string);
    if (!host) {
      return res.status(404).json({
        success: false,
        error: 'Host not found',
        timestamp: new Date().toISOString()
      });
    }

    const command = req.body;
    hostCommandLogger.info('🚀 Executing command on host', {
      hostId,
      commandType: command.type,
      targetDisplay: command.targetDisplay
    });

    // Create gRPC client and execute command
    const grpcClient = new GrpcHostClient({
      host: host.ipAddress,
      port: host.grpcPort,
      timeout: 30000
    });

    let result;
    switch (command.type) {
      case 'open_dashboard':
      case 'OPEN_DASHBOARD':
        result = await grpcClient.executeCommand({
          command_id: `cmd_${Date.now()}`,
          type: 'OPEN_DASHBOARD',
          payload: {
            targetDisplay: command.targetDisplay,
            dashboardId: command.payload?.dashboardId || 'unknown',
            url: command.payload?.url,
            fullscreen: command.payload?.fullscreen !== false,
            refreshInterval: command.payload?.refreshInterval || 300000
          }
        });
        break;

      case 'refresh_page':
      case 'REFRESH_PAGE':
        result = await grpcClient.executeCommand({
          command_id: `cmd_${Date.now()}`,
          type: 'REFRESH_DASHBOARD',
          payload: {
            targetDisplay: command.targetDisplay
          }
        });
        break;

      case 'sync_cookies':
      case 'SYNC_COOKIES':
        result = await grpcClient.executeCommand({
          command_id: `cmd_${Date.now()}`,
          type: 'SET_COOKIES',
          payload: {
            cookies: command.payload?.cookies || [],
            domain: command.payload?.domain
          }
        });
        break;

      case 'identify_displays':
      case 'IDENTIFY_DISPLAYS':
        result = await grpcClient.executeCommand({
          command_id: `cmd_${Date.now()}`,
          type: 'IDENTIFY_DISPLAYS',
          payload: {
            duration: command.payload?.duration || 5
          }
        });
        break;

      case 'HEALTH_CHECK':
        result = await grpcClient.healthCheck();
        break;

      case 'TAKE_SCREENSHOT':
        result = await grpcClient.executeCommand({
          command_id: `cmd_${Date.now()}`,
          type: 'TAKE_SCREENSHOT',
          payload: {
            targetDisplay: command.targetDisplay,
            format: command.payload?.format || 'png'
          }
        });
        break;

      case 'RESTART_BROWSER':
        result = await grpcClient.executeCommand({
          command_id: `cmd_${Date.now()}`,
          type: 'RESTART_DASHBOARD',
          payload: {
            targetDisplay: command.targetDisplay
          }
        });
        break;

      default:
        return res.status(400).json({
          success: false,
          error: `Unknown command type: ${command.type}`,
          timestamp: new Date().toISOString()
        });
    }

    hostCommandLogger.info('✅ Command executed successfully', {
      hostId,
      commandType: command.type,
      success: result.success
    });

    return res.status(200).json({
      success: true,
      result,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    hostCommandLogger.error('❌ Command execution failed:', error);
    
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Command execution failed',
      timestamp: new Date().toISOString()
    });
  }
}

