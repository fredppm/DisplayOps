import { NextApiRequest, NextApiResponse } from 'next';
import { proxyToHost } from '@/lib/host-utils';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { hostId } = req.query;
  
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({
      success: false,
      error: `Method ${req.method} Not Allowed`
    });
  }

  try {
    // Proxy request directly to host (avoid internal fetch to discovery)
    const hostResponse = await proxyToHost(hostId as string, '/api/windows', {
      method: 'GET'
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
    console.error('Windows proxy error:', error);
    
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