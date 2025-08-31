import { NextApiRequest, NextApiResponse } from 'next';
import { grpcManager } from '@/lib/server/grpc-manager';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { hostId } = req.query;
  
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({
      success: false,
      error: `Method ${req.method} Not Allowed`
    });
  }

  try {
    // 🚀 Use gRPC instead of HTTP proxy
    await grpcManager.initialize();
    
    const command = req.body;
    let result;

    // Route command to appropriate gRPC method
    switch (command.type) {
      case 'open_dashboard':
      case 'OPEN_DASHBOARD':
        result = await grpcManager.openDashboard(hostId as string, command.targetDisplay, {
          dashboardId: command.payload?.dashboardId || 'unknown',
          url: command.payload?.url,
          fullscreen: command.payload?.fullscreen !== false,
          refreshInterval: command.payload?.refreshInterval || 300000
        });
        break;

      case 'refresh_page':
      case 'REFRESH_PAGE':
        result = await grpcManager.refreshDisplay(hostId as string, command.targetDisplay);
        break;

      case 'sync_cookies':
      case 'SYNC_COOKIES':
        result = await grpcManager.syncCookies(hostId as string, command.payload?.cookies || [], command.payload?.domain);
        break;

      case 'identify_displays':
      case 'IDENTIFY_DISPLAYS':
        result = await grpcManager.identifyDisplays(hostId as string, command.payload?.duration || 5);
        break;

      case 'HEALTH_CHECK':
        result = await grpcManager.getHealthStatus(hostId as string);
        break;

      case 'TAKE_SCREENSHOT':
        result = await grpcManager.takeScreenshot(hostId as string, command.targetDisplay, command.payload?.format || 'png');
        break;

      case 'RESTART_BROWSER':
        result = await grpcManager.restartBrowser(hostId as string, command.payload?.displayIds, command.payload?.forceKill);
        break;

      default:
        return res.status(400).json({
          success: false,
          error: `Unknown command type: ${command.type}`
        });
    }

    res.status(200).json(result);

  } catch (error) {
    console.error('Command proxy error:', error);
    
    if (error instanceof Error && error.message === 'Invalid host ID format') {
      return res.status(400).json({
        success: false,
        error: 'Invalid host ID format'
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
}