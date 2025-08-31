import { NextApiRequest, NextApiResponse } from 'next';
import { grpcManager } from '@/lib/server/grpc-manager';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { hostId } = req.query;
  
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({
      success: false,
      error: `Method ${req.method} Not Allowed`
    });
  }

  try {
    // 🚀 Use gRPC instead of HTTP proxy
    await grpcManager.initialize();
    
    const { url, timeout } = req.body;
    
    const result = await grpcManager.validateUrl(
      hostId as string,
      url,
      timeout || 10000
    );

    res.status(200).json(result);

  } catch (error) {
    console.error('Validate URL proxy error:', error);
    
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