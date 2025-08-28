import { NextApiRequest, NextApiResponse } from 'next';
import { ApiCommand, ApiResponse } from '@/types/types';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<any>>
) {
  const { hostId } = req.query;

  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({
      success: false,
      error: `Method ${req.method} Not Allowed`,
      timestamp: new Date()
    });
  }

  try {
    const command: ApiCommand = req.body;

    if (!command || !command.type) {
      return res.status(400).json({
        success: false,
        error: 'Invalid command format',
        timestamp: new Date()
      });
    }

    // Get host information (in real implementation, this would come from discovery service)
    // For now, we'll extract IP from hostId or use a lookup mechanism
    const hostInfo = await getHostInfo(hostId as string);
    
    if (!hostInfo) {
      return res.status(404).json({
        success: false,
        error: `Host ${hostId} not found`,
        timestamp: new Date()
      });
    }

    // Forward command to host agent
    const hostResponse = await forwardCommandToHost(hostInfo.ipAddress, hostInfo.port, command);
    
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
    console.error(`Error forwarding command to host ${hostId}:`, error);
    
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      timestamp: new Date()
    });
  }
}

async function getHostInfo(hostId: string): Promise<{ ipAddress: string; port: number } | null> {
  // In a real implementation, this would query the discovery service
  // For now, we'll implement a simple fallback
  
  try {
    // Try to get host info from discovery service
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

async function forwardCommandToHost(
  ipAddress: string, 
  port: number, 
  command: ApiCommand
): Promise<Response> {
  const url = `http://${ipAddress}:${port}/api/command`;
  
  return fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(command),
    // 10 second timeout
    signal: AbortSignal.timeout(10000)
  });
}
