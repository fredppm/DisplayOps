import { NextApiRequest, NextApiResponse } from 'next';
import { hostsRepository } from '@/lib/repositories/HostsRepository';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    const hosts = await hostsRepository.getAll();
    const onlineHosts = hosts.filter(h => h.status === 'online').length;

    return res.status(200).json({
      success: true,
      data: {
        totalUsers: 4, // Mock data - replace with actual user count from auth
        totalSites: 2, // Mock data - replace with actual sites count
        totalHosts: hosts.length,
        onlineHosts: onlineHosts,
        systemStatus: onlineHosts > 0 ? 'Online' : 'Offline',
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error getting system stats:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get system stats'
    });
  }
}