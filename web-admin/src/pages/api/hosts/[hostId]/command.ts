import { NextApiRequest, NextApiResponse } from 'next';
import { createContextLogger } from '@/utils/logger';
import { hostsRepository } from '@/lib/repositories/HostsRepository';
import { httpHostManager } from '@/lib/http-host-manager';

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

    // Check if host is connected (based on recent heartbeat)
    const isConnected = await httpHostManager.isHostConnected(host.agentId);
    if (!isConnected) {
      return res.status(503).json({
        success: false,
        error: 'Host is not connected. Please ensure the host agent is running and connected to the admin.',
        timestamp: new Date().toISOString()
      });
    }

    // Send command via HTTP (enqueued for host to poll)
    const result = await httpHostManager.sendCommand(host.agentId, {
      commandId: `cmd_${Date.now()}`,
      type: command.type,
      payload: command.payload,
      targetDisplay: command.targetDisplay,
      timeout: 10000 // Reduced from 30s to 10s for faster response
    });

    hostCommandLogger.info('✅ Command executed successfully', {
      hostId,
      commandType: command.type,
      success: result.success
    });

    // Convert binary screenshot data to base64 for JSON serialization if needed
    if (command.type === 'TAKE_SCREENSHOT' && result.data?.image_data) {
      const imageBuffer = Buffer.from(result.data.image_data);
      result.data.image_data = imageBuffer.toString('base64');
      hostCommandLogger.debug('📸 Screenshot image data converted to base64', {
        originalSize: imageBuffer.length,
        base64Size: result.data.image_data.length
      });
    }

    return res.status(200).json({
      success: true,
      result: result.data,
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


