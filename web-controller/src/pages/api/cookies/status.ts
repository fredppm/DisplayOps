import { NextApiRequest, NextApiResponse } from 'next';
import { CookieStorageManager } from '../../../lib/cookie-storage';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get real statistics from storage
    const statistics = CookieStorageManager.getStatistics();

    console.log(`📊 Cookie status: ${statistics.domains} domains, ${statistics.totalCookies} total cookies`);

    return res.status(200).json({
      success: true,
      data: statistics
    });

  } catch (error) {
    console.error('Cookie status error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error getting cookie status'
    });
  }
}
