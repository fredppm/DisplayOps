import { NextApiRequest, NextApiResponse } from 'next';
import { HealthCheckResponse, ApiResponse } from '@/types/types';

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
    // Get host information
    const hostInfo = await getHostInfo(hostId as string);
    
    if (!hostInfo) {
      return res.status(404).json({
        success: false,
        error: `Host ${hostId} not found`,
        timestamp: new Date()
      });
    }

    // Fetch status from host agent
    const hostResponse = await fetchHostStatus(hostInfo.ipAddress, hostInfo.port);
    
    if (hostResponse.ok) {
      const result = await hostResponse.json();
      return res.status(200).json(result);
    } else {
      return res.status(502).json({
        success: false,
        error: `Host agent responded with status ${hostResponse.status}`,
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

async function getHostInfo(hostId: string): Promise<{ ipAddress: string; port: number } | null> {
  try {
    // Get host info from discovery service
    const discoveryResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/discovery/hosts`);
    
    if (discoveryResponse.ok) {
      const data = await discoveryResponse.json();
      const host = data.data?.find((h: any) => h.id === hostId);
      
      if (host) {
        return {
          ipAddress: host.ipAddress,
          port: host.port
        };
      }
    }
  } catch (error) {
    console.error('Error getting host info:', error);
  }
  
  return null;
}

async function fetchHostStatus(ipAddress: string, port: number): Promise<Response> {
  const url = `http://${ipAddress}:${port}/api/status`;
  
  return fetch(url, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
    },
    // 5 second timeout for status checks
    signal: AbortSignal.timeout(5000)
  });
}
