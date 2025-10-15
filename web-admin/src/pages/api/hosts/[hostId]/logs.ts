import { NextApiRequest, NextApiResponse } from 'next';
import { createContextLogger} from '@/utils/logger';
import { hostsRepository } from '@/lib/repositories/HostsRepository';
import { GrpcHostClient } from '@/lib/grpc-host-client';

const hostLoggerEndpoint = createContextLogger('host-logs-api');

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed',
      timestamp: new Date().toISOString()
    });
  }

  try {
    const { hostId } = req.query;
    const { limit, level } = req.query;

    if (!hostId || typeof hostId !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Host ID is required',
        timestamp: new Date().toISOString()
      });
    }

    // Get host from database
    const host = await hostsRepository.getById(hostId);
    if (!host) {
      return res.status(404).json({
        success: false,
        error: 'Host not found',
        timestamp: new Date().toISOString()
      });
    }

    hostLoggerEndpoint.info(`📋 Fetching logs for host ${host.agentId}`);

    // Create gRPC client
    const grpcClient = new GrpcHostClient({
      host: host.ipAddress,
      port: host.grpcPort,
      timeout: 30000
    });

    try {
      // Execute GET_LOGS command
      const result = await grpcClient.executeCommand({
        command_id: `cmd_${Date.now()}`,
        type: 'GET_LOGS',
        get_logs: {
          limit: limit ? parseInt(limit as string) : 100,
          level: (level as string) || 'ALL'
        }
      });

      if (!result.success) {
        hostLoggerEndpoint.error(`❌ Failed to get logs: ${result.error}`);
        return res.status(500).json({
          success: false,
          error: result.error || 'Failed to get logs from host',
          timestamp: new Date().toISOString()
        });
      }

      const logsResult = result.get_logs_result;

      if (!logsResult || !logsResult.logs) {
        hostLoggerEndpoint.warn('⚠️ No logs returned from host');
        return res.status(200).json({
          success: true,
          data: {
            logs: [],
            total_count: 0,
            oldest_log_time: null,
            newest_log_time: null
          },
          timestamp: new Date().toISOString()
        });
      }

      hostLoggerEndpoint.info(`✅ Retrieved ${logsResult.logs.length} logs from host`);

      return res.status(200).json({
        success: true,
        data: {
          logs: logsResult.logs,
          total_count: logsResult.total_count,
          oldest_log_time: logsResult.oldest_log_time,
          newest_log_time: logsResult.newest_log_time
        },
        timestamp: new Date().toISOString()
      });

    } catch (commandError) {
      hostLoggerEndpoint.error('❌ gRPC command failed:', commandError);
      throw commandError;
    }

  } catch (error) {
    hostLoggerEndpoint.error('❌ Logs fetch failed:', error);

    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }
}

