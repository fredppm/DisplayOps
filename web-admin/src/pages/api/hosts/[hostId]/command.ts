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

  const startTime = Date.now(); // Define before try for catch block access
  
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
      case 'OPEN_DASHBOARD':
        result = await grpcClient.executeCommand({
          command_id: `cmd_${Date.now()}`,
          type: 'OPEN_DASHBOARD',
          open_dashboard: {
            display_id: command.targetDisplay,
            dashboard_id: command.payload?.dashboardId || 'unknown',
            url: command.payload?.url,
            fullscreen: command.payload?.fullscreen !== false,
            refresh_interval_ms: command.payload?.refreshInterval || 300000
          }
        });
        break;

      case 'REFRESH_DASHBOARD':
        result = await grpcClient.executeCommand({
          command_id: `cmd_${Date.now()}`,
          type: 'REFRESH_DASHBOARD',
          refresh_dashboard: {
            display_id: command.targetDisplay
          }
        });
        break;

      case 'SET_COOKIES':
      case 'SYNC_COOKIES': // Used by AuthorizationManager
        result = await grpcClient.executeCommand({
          command_id: `cmd_${Date.now()}`,
          type: 'SET_COOKIES',
          set_cookies: {
            cookies: command.payload?.cookies || [],
            domain: command.payload?.domain
          }
        });
        break;

      case 'IDENTIFY_DISPLAYS':
        result = await grpcClient.executeCommand({
          command_id: `cmd_${Date.now()}`,
          type: 'IDENTIFY_DISPLAYS',
          identify_displays: {
            duration_seconds: 5,
            font_size: 200,
            background_color: 'rgba(0, 180, 255, 0.95)' // Cyan/Blue neon
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
          take_screenshot: {
            display_id: command.targetDisplay,
            format: command.payload?.format || 'png'
          }
        });
        break;

      case 'RESTART_DASHBOARD':
        result = await grpcClient.executeCommand({
          command_id: `cmd_${Date.now()}`,
          type: 'RESTART_DASHBOARD',
          restart_dashboard: {
            display_ids: command.targetDisplay ? [command.targetDisplay] : []
          }
        });
        break;

      case 'REMOVE_DASHBOARD':
        result = await grpcClient.executeCommand({
          command_id: `cmd_${Date.now()}`,
          type: 'REMOVE_DASHBOARD',
          remove_dashboard: {
            display_id: command.targetDisplay
          }
        });
        break;

      case 'DEBUG_ENABLE':
        result = await grpcClient.executeCommand({
          command_id: `cmd_${Date.now()}`,
          type: 'DEBUG_ENABLE',
          debug_enable: {}
        });
        break;

      case 'DEBUG_DISABLE':
        result = await grpcClient.executeCommand({
          command_id: `cmd_${Date.now()}`,
          type: 'DEBUG_DISABLE',
          debug_disable: {}
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

    // Convert binary screenshot data to base64 for JSON serialization
    if (command.type === 'TAKE_SCREENSHOT' && result.screenshot_result?.image_data) {
      const imageBuffer = Buffer.from(result.screenshot_result.image_data);
      result.screenshot_result.image_data = imageBuffer.toString('base64');
      hostCommandLogger.debug('📸 Screenshot image data converted to base64', {
        originalSize: imageBuffer.length,
        base64Size: result.screenshot_result.image_data.length
      });
    }

    return res.status(200).json({
      success: true,
      result,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Command execution failed';
    
    hostCommandLogger.error('❌ Command execution failed:', error);
    
    return res.status(500).json({
      success: false,
      error: errorMessage,
      timestamp: new Date().toISOString()
    });
  }
}


