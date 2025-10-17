import { NextApiRequest, NextApiResponse } from 'next';
import { createContextLogger } from '@/utils/logger';
import { validateHostAuth } from '@/lib/host-auth';

const logger = createContextLogger('host-commands-response');

// Store command responses (in production, use Redis or database)
// Use global to persist across Next.js hot reloads
declare global {
  var __commandResponses: Map<string, any> | undefined;
  var __responseWaiters: Map<string, (response: any) => void> | undefined;
}

const commandResponses = global.__commandResponses || new Map<string, any>();
const responseWaiters = global.__responseWaiters || new Map<string, (response: any) => void>();

if (!global.__commandResponses) {
  global.__commandResponses = commandResponses;
}
if (!global.__responseWaiters) {
  global.__responseWaiters = responseWaiters;
}

/**
 * Register a waiter for command response
 */
export function waitForCommandResponse(commandId: string, timeout: number = 30000): Promise<any> {
  return new Promise((resolve, reject) => {
    logger.debug('⏳ Registering waiter for command', { commandId, timeout });
    
    // Check if response already exists
    if (commandResponses.has(commandId)) {
      logger.info('✅ Response already available', { commandId });
      const response = commandResponses.get(commandId);
      commandResponses.delete(commandId);
      return resolve(response);
    }

    // Setup timeout
    const timeoutHandle = setTimeout(() => {
      logger.error('⏰ Command timeout', { 
        commandId, 
        timeout,
        stillWaiting: responseWaiters.has(commandId)
      });
      responseWaiters.delete(commandId);
      reject(new Error(`Command timeout after ${timeout}ms`));
    }, timeout);

    // Register waiter
    responseWaiters.set(commandId, (response) => {
      logger.info('🎉 Waiter callback triggered', { commandId });
      clearTimeout(timeoutHandle);
      responseWaiters.delete(commandId);
      resolve(response);
    });
    
    logger.debug('✅ Waiter registered', { 
      commandId,
      totalWaiters: responseWaiters.size 
    });
  });
}

/**
 * HTTP Endpoint for hosts to send command responses
 * Replaces Socket.IO command:response event
 * 
 * POST /api/hosts/commands/response
 * Body: {
 *   commandId: string,
 *   success: boolean,
 *   data?: any,
 *   error?: string
 * }
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Validate host authentication (less strict for responses)
  const authResult = validateHostAuth(req);
  if (!authResult.valid) {
    logger.warn('❌ Auth failed for command response', { 
      error: authResult.error,
      hasAgentId: !!req.body?.agentId,
      agentId: req.body?.agentId
    });
    return res.status(401).json({ error: authResult.error || 'Unauthorized' });
  }

  try {
    const { commandId, success, data, error, agentId } = req.body;
    
    logger.debug('🔐 Auth successful for command response', { agentId, commandId });

    if (!commandId) {
      return res.status(400).json({ error: 'commandId is required' });
    }

    const response = {
      commandId,
      success,
      data,
      error,
      timestamp: new Date().toISOString()
    };

    logger.info('📥 Command response received', { commandId, success });

    // Check if someone is waiting for this response
    const waiter = responseWaiters.get(commandId);
    
    logger.debug('🔍 Checking for waiter', {
      commandId,
      hasWaiter: !!waiter,
      waitersCount: responseWaiters.size,
      allWaiters: Array.from(responseWaiters.keys())
    });
    
    if (waiter) {
      logger.info('✅ Notifying waiter for command', { commandId });
      waiter(response);
    } else {
      logger.warn('⚠️ No waiter found, storing response', { commandId });
      // Store for later retrieval
      commandResponses.set(commandId, response);
    }

    return res.status(200).json({
      success: true,
      message: 'Response received'
    });
  } catch (error) {
    logger.error('Failed to process command response', { error });
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

