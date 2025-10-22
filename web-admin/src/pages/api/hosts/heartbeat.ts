import { NextApiRequest, NextApiResponse } from 'next';
import { createContextLogger } from '@/utils/logger';
import { hostsRepository } from '@/lib/repositories/HostsRepository';
import { broadcastHostEvent } from './events';
import { validateHostAuth } from '@/lib/host-auth';

const logger = createContextLogger('host-heartbeat');

/**
 * HTTP Endpoint for Host Heartbeat
 * Replaces Socket.IO heartbeat
 * 
 * POST /api/hosts/heartbeat
 * Body: {
 *   agentId: string,
 *   hostname: string,
 *   displays: array,
 *   systemInfo: object,
 *   metrics: object,
 *   version: string
 * }
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Validate host authentication
  const authResult = validateHostAuth(req);
  if (!authResult.valid) {
    logger.warn('Unauthorized heartbeat attempt', { error: authResult.error });
    return res.status(401).json({ error: authResult.error || 'Unauthorized' });
  }

  try {
    const { 
      agentId, 
      hostname, 
      displays, 
      systemInfo, 
      metrics, 
      version 
    } = req.body;

    if (!agentId) {
      return res.status(400).json({ error: 'agentId is required' });
    }

    logger.info('💓 Heartbeat received', { 
      agentId, 
      hostname,
      hasSystemInfo: !!systemInfo,
      systemInfoKeys: systemInfo ? Object.keys(systemInfo) : []
    });

    // Check if host exists
    const existingHost = await hostsRepository.getByAgentId(agentId);

    if (!existingHost) {
      // Auto-register new host
      logger.info('🆕 Auto-registering new host', { agentId, hostname });

      const newHost = await hostsRepository.create({
        agentId,
        hostname: hostname || agentId,
        ipAddress: '0.0.0.0', // Not used with HTTP
        grpcPort: 0, // Not used anymore
        displays: displays || [],
        systemInfo: systemInfo || {},
        version: version || '1.0.0',
        status: 'online',
        lastSeen: new Date().toISOString(),
        metrics: metrics || {}
      });

      logger.info('✅ Host auto-registered', { agentId });

      // Broadcast new host registration via SSE
      broadcastHostEvent({
        type: 'host_registered',
        host: newHost
      });

      return res.status(201).json({
        success: true,
        message: 'Host registered',
        host: newHost
      });
    } else {
      // Update existing host
      const wasOffline = existingHost.status === 'offline';
      
      // Sempre atualizar systemInfo se vier preenchido
      const updatedSystemInfo = (systemInfo && Object.keys(systemInfo).length > 0) 
        ? systemInfo 
        : existingHost.systemInfo;

      await hostsRepository.update(agentId, {
        lastSeen: new Date().toISOString(),
        displays: displays || existingHost.displays,
        systemInfo: updatedSystemInfo,
        metrics: metrics || existingHost.metrics,
        version: version || existingHost.version,
        status: 'online',
        hostname: hostname || existingHost.hostname
      });

      // Get updated host
      const updatedHost = await hostsRepository.getByAgentId(agentId);

      // Broadcast update via SSE
      if (wasOffline) {
        broadcastHostEvent({
          type: 'host_connected',
          host: updatedHost
        });
      } else {
        // Only broadcast routine updates if there are significant changes
        // This reduces unnecessary SSE broadcasts when no clients are connected
        broadcastHostEvent({
          type: 'host_updated',
          host: updatedHost
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Heartbeat acknowledged',
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    logger.error('Failed to process heartbeat', { error });
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

