import { NextApiRequest, NextApiResponse } from 'next';
import { controllersRepository } from '@/lib/repositories/ControllersRepository';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    const controllers = await controllersRepository.getAll();
    const stats = await controllersRepository.getStatsCount();

    return res.status(200).json({
      success: true,
      data: {
        totalUsers: 4, // Mock data - replace with actual user count from auth
        totalSites: 2, // Mock data - replace with actual sites count
        totalControllers: stats.total,
        systemStatus: stats.online > 0 ? 'Online' : 'Offline',
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