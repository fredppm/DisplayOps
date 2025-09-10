import { NextApiRequest, NextApiResponse } from 'next';
import { createContextLogger } from '@/utils/logger';

const commandResponseLogger = createContextLogger('controller-command-response');

interface CommandResponseRequest {
  command_id: string;
  controller_id: string;
  success: boolean;
  error_message?: string;
  timestamp: string;
}

interface CommandResponseResponse {
  received: boolean;
  timestamp: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const responseData: CommandResponseRequest = req.body;

    if (!responseData.command_id || !responseData.controller_id) {
      return res.status(400).json({ 
        error: 'Command ID and Controller ID are required',
        timestamp: new Date().toISOString()
      });
    }

    commandResponseLogger.info('Received command response via HTTP', {
      command_id: responseData.command_id,
      controller_id: responseData.controller_id,
      success: responseData.success,
      has_error: !!responseData.error_message
    });

    // TODO: Process command response based on command type
    // This could involve:
    // - Updating metrics/status
    // - Triggering follow-up actions
    // - Logging for monitoring/debugging
    // - Notifying other systems

    if (!responseData.success && responseData.error_message) {
      commandResponseLogger.warn('Command execution failed', {
        command_id: responseData.command_id,
        controller_id: responseData.controller_id,
        error_message: responseData.error_message
      });
    } else {
      commandResponseLogger.debug('Command executed successfully', {
        command_id: responseData.command_id,
        controller_id: responseData.controller_id
      });
    }

    const response: CommandResponseResponse = {
      received: true,
      timestamp: new Date().toISOString()
    };

    res.status(200).json(response);

  } catch (error) {
    commandResponseLogger.error('Failed to process command response:', error);
    
    res.status(500).json({
      error: `Failed to process command response: ${error instanceof Error ? error.message : 'Unknown error'}`,
      timestamp: new Date().toISOString()
    });
  }
}