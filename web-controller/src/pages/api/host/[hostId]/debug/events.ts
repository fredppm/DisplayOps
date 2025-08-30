import { NextApiRequest, NextApiResponse } from 'next';
import { parseHostId } from '@/lib/host-utils';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { hostId } = req.query;
  
  if (!['GET', 'DELETE'].includes(req.method!)) {
    res.setHeader('Allow', ['GET', 'DELETE']);
    return res.status(405).json({
      success: false,
      error: `Method ${req.method} Not Allowed`
    });
  }

  try {
    // Parse host info directly from hostId (format: agent-IP-PORT)
    const hostInfo = parseHostId(hostId as string);
    
    if (!hostInfo) {
      return res.status(400).json({
        success: false,
        error: 'Invalid host ID format'
      });
    }

    // Build URL with query params for GET requests
    let url = `http://${hostInfo.ipAddress}:${hostInfo.port}/api/debug/events`;
    if (req.method === 'GET' && req.url?.includes('?')) {
      const queryString = req.url.split('?')[1];
      url += `?${queryString}`;
    }

    // Proxy request directly to host (avoid internal fetch to discovery)
    const hostResponse = await fetch(url, {
      method: req.method,
      headers: {
        'Content-Type': 'application/json'
      },
      signal: AbortSignal.timeout(10000) // 10 second timeout
    });

    const responseData = await hostResponse.json();

    if (!hostResponse.ok) {
      return res.status(hostResponse.status).json({
        success: false,
        error: responseData.error || `Host returned ${hostResponse.status}`
      });
    }

    res.status(200).json(responseData);

  } catch (error) {
    console.error('Debug events proxy error:', error);
    
    if (error instanceof Error && error.message === 'Invalid host ID format') {
      return res.status(400).json({
        success: false,
        error: 'Invalid host ID format'
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
}