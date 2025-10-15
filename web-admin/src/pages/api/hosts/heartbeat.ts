import { NextApiRequest, NextApiResponse } from 'next';
import { createContextLogger } from '@/utils/logger';
import { hostsRepository } from '@/lib/repositories/HostsRepository';
import { broadcastHostEvent } from './events';

const heartbeatLogger = createContextLogger('host-heartbeat');

interface HeartbeatRequest {
  agentId: string;
  status: 'online' | 'offline';
  lastSeen: string;
  displays: Array<{
    id: string;
    name: string;
    width: number;
    height: number;
    isPrimary: boolean;
    assignedDashboard?: {
      dashboardId: string;
      url: string;
    } | null;
    isActive: boolean;
  }>;
  systemInfo?: {
    platform: string;
    arch: string;
    nodeVersion: string;
    electronVersion: string;
    totalMemoryGB: number;
    cpuCores: number;
    cpuModel: string;
    uptime: number;
  };
  metrics?: {
    cpuUsagePercent: number;
    memoryUsagePercent: number;
    memoryUsedGB: number;
    memoryTotalGB: number;
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed',
      timestamp: new Date().toISOString()
    });
  }

  try {
    const heartbeatData: HeartbeatRequest = req.body;

    if (!heartbeatData.agentId) {
      return res.status(400).json({
        success: false,
        error: 'Agent ID is required',
        timestamp: new Date().toISOString()
      });
    }

    // Find host by agent ID
    const host = await hostsRepository.getByAgentId(heartbeatData.agentId);
    if (!host) {
      return res.status(404).json({
        success: false,
        error: 'Host not found',
        timestamp: new Date().toISOString()
      });
    }

    // Update host status and display information
    const updateData: any = {
      status: heartbeatData.status,
      lastSeen: heartbeatData.lastSeen,
      displays: heartbeatData.displays.map(display => ({
        id: display.id,
        name: display.name,
        width: display.width,
        height: display.height,
        isPrimary: display.isPrimary,
        assignedDashboard: display.assignedDashboard || null,
        isActive: display.isActive || false
      }))
    };

    // Include systemInfo if provided (for uptime and other dynamic system data)
    if (heartbeatData.systemInfo) {
      updateData.systemInfo = heartbeatData.systemInfo;
    }

    // Include metrics if provided (CPU, memory usage)
    if (heartbeatData.metrics) {
      updateData.metrics = heartbeatData.metrics;
    }

    const updatedHost = await hostsRepository.update(host.id, updateData);

    // Check if displays have changed (dashboard assignments)
    const displaysChanged = JSON.stringify(host.displays) !== JSON.stringify(heartbeatData.displays);
    
    // Only log at debug level to reduce noise (heartbeats are frequent)
    // Log at info level only for status changes or display changes
    if (host.status !== heartbeatData.status) {
      heartbeatLogger.info('💓 Heartbeat - status changed', {
        agentId: heartbeatData.agentId,
        oldStatus: host.status,
        newStatus: heartbeatData.status
      });
    } else if (displaysChanged) {
      heartbeatLogger.info('💓 Heartbeat - displays changed', {
        agentId: heartbeatData.agentId,
        displayCount: heartbeatData.displays.length
      });
    } else {
      heartbeatLogger.debug('💓 Heartbeat received', {
        agentId: heartbeatData.agentId,
        status: heartbeatData.status,
        displayCount: heartbeatData.displays.length
      });
    }

    // Broadcast updates via SSE
    if (updatedHost) {
      // Broadcast if status changed, displays changed, or host went offline
      if (heartbeatData.status === 'offline') {
        broadcastHostEvent({
          type: 'host_disconnected',
          hostId: host.id,
          host: updatedHost
        });
      } else {
        // Always broadcast updates for online hosts (includes metrics updates)
        broadcastHostEvent({
          type: 'host_updated',
          hostId: host.id,
          host: updatedHost
        });
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Heartbeat received',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    heartbeatLogger.error('❌ Heartbeat processing failed:', error);
    
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }
}


