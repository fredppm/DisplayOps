import { NextApiRequest, NextApiResponse } from 'next';
import { CookieStorageManager } from '../../../../lib/cookie-storage';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { domain } = req.query;
    
    if (!domain || typeof domain !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Domain parameter is required'
      });
    }

    const decodedDomain = decodeURIComponent(domain);
    console.log(`🍪 Getting cookies for domain: ${decodedDomain}`);
    
    const cookies = CookieStorageManager.getCookiesForDomain(decodedDomain);
    
    return res.status(200).json({
      success: true,
      data: {
        domain: decodedDomain,
        cookies: cookies, // Return structured cookies
        count: cookies.length
      }
    });

  } catch (error) {
    console.error('Error getting domain cookies:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error getting domain cookies'
    });
  }
}
