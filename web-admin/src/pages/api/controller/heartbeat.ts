import { NextApiRequest, NextApiResponse } from 'next';
import { createContextLogger } from '@/utils/logger';
import { controllersRepository } from '@/lib/repositories/ControllersRepository';

const heartbeatLogger = createContextLogger('controller-heartbeat');

interface HeartbeatRequest {
  controller_id: string;
  timestamp: string;
  status: string;
  metrics?: {
    cpu_usage_percent: number;
    memory_usage_percent: number;
    memory_used_bytes: number;
    memory_total_bytes: number;
    disk_usage_percent: number;
    disk_free_bytes: number;
    network_rx_bytes_per_sec: number;
    network_tx_bytes_per_sec: number;
    uptime_seconds: number;
  };
  services?: Array<{
    service_name: string;
    running: boolean;
    port?: number;
    last_check: string;
    status_message: string;
  }>;
  last_error?: string;
  last_error_message?: string;
}

interface HeartbeatResponse {
  received: boolean;
  server_time: string;
  timestamp: string;
}

async function updateControllerStatus(controllerId: string, statusData: HeartbeatRequest): Promise<void> {
  try {
    const controller = await controllersRepository.getById(controllerId);
    if (controller) {
      const validStatuses = ['online', 'offline', 'error'];
      const status = statusData.status.toLowerCase();
      const validatedStatus = validStatuses.includes(status) ? status as 'online' | 'offline' | 'error' : 'online';
      
      await controllersRepository.update(controllerId, {
        status: validatedStatus,
        lastSync: new Date().toISOString()
      });
    } else {
      heartbeatLogger.warn('Heartbeat received for unknown controller', { controllerId });
    }
  } catch (error) {
    heartbeatLogger.error('Failed to update controller status via heartbeat', { controllerId, error });
    throw error;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const heartbeatData: HeartbeatRequest = req.body;

    if (!heartbeatData.controller_id) {
      return res.status(400).json({ 
        error: 'Controller ID is required',
        timestamp: new Date().toISOString()
      });
    }

    if (!heartbeatData.status) {
      return res.status(400).json({ 
        error: 'Status is required',
        timestamp: new Date().toISOString()
      });
    }

    heartbeatLogger.debug('Processing HTTP controller heartbeat', {
      controller_id: heartbeatData.controller_id,
      status: heartbeatData.status
    });

    await updateControllerStatus(heartbeatData.controller_id, heartbeatData);

    const response: HeartbeatResponse = {
      received: true,
      server_time: new Date().toISOString(),
      timestamp: new Date().toISOString()
    };

    heartbeatLogger.debug('HTTP heartbeat processed successfully', {
      controller_id: heartbeatData.controller_id
    });

    res.status(200).json(response);

  } catch (error) {
    heartbeatLogger.error('HTTP heartbeat processing failed:', error);
    
    res.status(500).json({
      error: `Failed to process heartbeat: ${error instanceof Error ? error.message : 'Unknown error'}`,
      timestamp: new Date().toISOString()
    });
  }
}