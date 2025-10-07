import { NextApiRequest, NextApiResponse } from 'next';
import { createContextLogger } from '@/utils/logger';
import { hostsRepository } from '@/lib/repositories/HostsRepository';

const hostsLogger = createContextLogger('hosts-api');

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method === 'GET') {
      // List all registered hosts
      const hosts = await hostsRepository.getAll();
      
      hostsLogger.info('📋 Retrieved hosts list', { count: hosts.length });
      
      return res.status(200).json({
        success: true,
        data: hosts,
        timestamp: new Date().toISOString()
      });
    } else {
      res.setHeader('Allow', ['GET']);
      return res.status(405).json({
        success: false,
        error: `Method ${req.method} not allowed`,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    hostsLogger.error('❌ Hosts API error:', error);
    
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }
}

