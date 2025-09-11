import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    // Mock performance metrics - replace with actual system monitoring data
    const performanceData = {
      uptime: 86400, // 1 day in seconds
      system: {
        cpuUsage: 45.2,
        memoryUsage: 62.8,
        loadAverage: 1.2,
      },
      api: {
        averageResponseTime: 120,
        totalRequests: 1543,
        errorRate: 0.8,
        requestsPerMinute: 45,
      },
      application: {
        activeSessions: 23,
        activeConnections: 8,
        errorRate: 0.2,
        requestsPerMinute: 42,
      },
      timestamp: Date.now()
    };

    return res.status(200).json({
      success: true,
      data: performanceData
    });
  } catch (error) {
    console.error('Error getting performance metrics:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get performance metrics'
    });
  }
}