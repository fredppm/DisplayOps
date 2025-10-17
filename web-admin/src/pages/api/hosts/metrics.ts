import { NextApiRequest, NextApiResponse } from 'next';
import { createContextLogger } from '@/utils/logger';
import { hostsRepository } from '@/lib/repositories/HostsRepository';
import { broadcastHostEvent } from './events';
import { validateHostAuth } from '@/lib/host-auth';

const logger = createContextLogger('host-metrics');

// Store for broadcasting metrics via SSE
const metricsCache = new Map<string, any>();

/**
 * Get cached metrics for a host (used by SSE clients)
 */
export function getHostMetrics(agentId: string) {
  return metricsCache.get(agentId);
}

/**
 * Get all cached metrics
 */
export function getAllMetrics() {
  return Object.fromEntries(metricsCache);
}

/**
 * HTTP Endpoint for Host Metrics
 * Replaces Socket.IO metrics event
 * 
 * POST /api/hosts/metrics
 * Body: {
 *   agentId: string,
 *   metrics: {
 *     cpu: number,
 *     memory: object,
 *     uptime: number,
 *     etc...
 *   }
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
    const { agentId, metrics } = req.body;

    if (!agentId) {
      return res.status(400).json({ error: 'agentId is required' });
    }

    if (!metrics) {
      return res.status(400).json({ error: 'metrics is required' });
    }

    // Update metrics cache
    metricsCache.set(agentId, {
      agentId,
      metrics,
      timestamp: new Date().toISOString()
    });

    // Update in database
    await hostsRepository.update(agentId, {
      metrics,
      lastSeen: new Date().toISOString()
    });

    // Broadcast via SSE
    broadcastHostEvent({
      type: 'host_metrics',
      hostId: agentId,
      host: {
        id: agentId,
        agentId,
        metrics,
        timestamp: new Date().toISOString()
      }
    });

    return res.status(200).json({
      success: true,
      message: 'Metrics received'
    });
  } catch (error) {
    logger.error('Failed to process metrics', { error });
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

