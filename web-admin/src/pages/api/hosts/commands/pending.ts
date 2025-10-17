import { NextApiRequest, NextApiResponse } from 'next';
import { createContextLogger } from '@/utils/logger';
import { validateHostAuth } from '@/lib/host-auth';

const logger = createContextLogger('host-commands-pending');

// In-memory command queue (in production, use Redis or database)
// Use global to persist across Next.js hot reloads
declare global {
  var __commandQueues: Map<string, any[]> | undefined;
}

const commandQueues = global.__commandQueues || new Map<string, any[]>();

if (!global.__commandQueues) {
  global.__commandQueues = commandQueues;
}

/**
 * Add command to queue for a host
 */
export function enqueueCommand(agentId: string, command: any) {
  if (!commandQueues.has(agentId)) {
    commandQueues.set(agentId, []);
  }
  commandQueues.get(agentId)!.push(command);
  logger.info('📤 Command enqueued', { agentId, commandId: command.commandId });
}

/**
 * HTTP Endpoint for hosts to poll pending commands
 * Replaces Socket.IO command push
 * 
 * GET /api/hosts/commands/pending?agentId=xxx
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Validate host authentication
  const authResult = validateHostAuth(req);
  if (!authResult.valid) {
    return res.status(401).json({ error: authResult.error || 'Unauthorized' });
  }

  try {
    const { agentId } = req.query;

    if (!agentId || typeof agentId !== 'string') {
      return res.status(400).json({ error: 'agentId is required' });
    }

    // Get pending commands for this host
    const commands = commandQueues.get(agentId) || [];
    
    logger.debug('🔍 Checking command queue', {
      agentId,
      queueSize: commands.length,
      hasQueue: commandQueues.has(agentId),
      allQueues: Array.from(commandQueues.keys())
    });
    
    // Clear the queue (host will receive them)
    if (commands.length > 0) {
      commandQueues.set(agentId, []);
      logger.info('📬 Delivering commands to host', { 
        agentId, 
        commandCount: commands.length,
        commands: commands.map(c => ({ id: c.commandId, type: c.type }))
      });
    }

    return res.status(200).json({
      success: true,
      commands
    });
  } catch (error) {
    logger.error('Failed to get pending commands', { error });
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

