import { NextApiRequest, NextApiResponse } from 'next';
import { createContextLogger } from '@/utils/logger';
import { broadcastHostEvent } from './events';
import { validateHostAuth } from '@/lib/host-auth';

const logger = createContextLogger('host-logs');

/**
 * HTTP Endpoint for Host Logs
 * Replaces Socket.IO logs event
 * 
 * POST /api/hosts/logs
 * Body: {
 *   agentId: string,
 *   logs: [{
 *     id: string,
 *     timestamp: string,
 *     level: string,
 *     category: string,
 *     message: string,
 *     details?: string
 *   }]
 * }
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Validate host authentication
  const authResult = validateHostAuth(req);
  if (!authResult.valid) {
    return res.status(401).json({ error: authResult.error || 'Unauthorized' });
  }

  try {
    const { agentId, logs } = req.body;

    if (!agentId) {
      return res.status(400).json({ error: 'agentId is required' });
    }

    if (!logs || !Array.isArray(logs)) {
      return res.status(400).json({ error: 'logs array is required' });
    }

    // Broadcast logs via SSE
    if (logs.length > 0) {
      broadcastHostEvent({
        type: 'host_logs',
        hostId: agentId,
        host: {
          agentId,
          logs,
          timestamp: new Date().toISOString()
        }
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Logs received',
      count: logs.length
    });
  } catch (error) {
    logger.error('Failed to process logs', { error });
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

