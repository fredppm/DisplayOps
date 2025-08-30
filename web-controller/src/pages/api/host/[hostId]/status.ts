import { NextApiRequest, NextApiResponse } from 'next';
import { HealthCheckResponse, ApiResponse } from '@/types/shared-types';
import { getGrpcHostManager } from '../../grpc-manager';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<HealthCheckResponse>>
) {
  const { hostId } = req.query;

  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({
      success: false,
      error: `Method ${req.method} Not Allowed`,
      timestamp: new Date()
    });
  }

  try {
    // Get host information from discovery service
    const hostInfo = await getHostInfo(hostId as string);
    
    if (!hostInfo) {
      return res.status(404).json({
        success: false,
        error: `Host ${hostId} not found`,
        timestamp: new Date()
      });
    }

    // Use gRPC client for health check instead of HTTP
    const grpcManager = getGrpcHostManager();
    
    // Add host to gRPC manager if not already present
    grpcManager.addHost({
      id: hostId as string,
      name: hostInfo.name || hostId as string,
      hostname: hostInfo.ipAddress,
      ipAddress: hostInfo.ipAddress,
      port: hostInfo.port,
      grpcPort: 8082 // Default gRPC port
    });

    // Get health check via gRPC
    const healthResult = await grpcManager.executeCommand(hostId as string, {
      command_id: `health_${Date.now()}`,
      type: 'HEALTH_CHECK',
      timestamp: { seconds: Math.floor(Date.now() / 1000), nanos: 0 }
    });

    if (healthResult.success) {
      // Convert gRPC health check response to legacy format
      const grpcData = healthResult.data.health_check_result;
      const result: ApiResponse<HealthCheckResponse> = {
        success: true,
        data: {
          hostStatus: {
            online: grpcData.host_status.online,
            cpuUsage: grpcData.host_status.cpu_usage_percent,
            memoryUsage: grpcData.host_status.memory_usage_percent,
            browserProcesses: grpcData.host_status.browser_processes,
            lastError: grpcData.host_status.last_error || undefined
          },
          tvStatuses: [], // Keep empty as in original
          displayStatuses: grpcData.display_statuses.map((display: any) => ({
            active: display.active,
            currentUrl: display.current_url || undefined,
            lastRefresh: display.last_refresh ? new Date(display.last_refresh.seconds * 1000) : new Date(),
            isResponsive: display.is_responsive,
            errorCount: display.error_count,
            lastError: display.last_error || undefined,
            assignedDashboard: display.assigned_dashboard ? {
              dashboardId: display.assigned_dashboard.dashboard_id,
              url: display.assigned_dashboard.url,
              refreshInterval: display.assigned_dashboard.refresh_interval_ms
            } : undefined
          })),
          systemInfo: {
            uptime: grpcData.system_info.uptime_seconds,
            platform: grpcData.system_info.platform,
            nodeVersion: grpcData.system_info.node_version,
            agentVersion: grpcData.system_info.agent_version
          }
        },
        timestamp: new Date()
      };
      
      return res.status(200).json(result);
    } else {
      return res.status(502).json({
        success: false,
        error: `gRPC health check failed: ${healthResult.error}`,
        timestamp: new Date()
      });
    }

  } catch (error) {
    console.error(`Error fetching status from host ${hostId}:`, error);
    
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      timestamp: new Date()
    });
  }
}

async function getHostInfo(hostId: string): Promise<{ ipAddress: string; port: number; name?: string } | null> {
  try {
    // Get host info from discovery service
    const discoveryResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002'}/api/discovery/hosts`);
    
    if (discoveryResponse.ok) {
      const data = await discoveryResponse.json();
      const host = data.data?.find((h: any) => h.id === hostId);
      
      if (host) {
        return {
          ipAddress: host.ipAddress,
          port: host.port,
          name: host.name
        };
      }
    }
  } catch (error) {
    console.error('Error getting host info:', error);
  }
  
  return null;
}
