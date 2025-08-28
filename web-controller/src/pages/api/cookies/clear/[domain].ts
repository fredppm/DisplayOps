import { NextApiRequest, NextApiResponse } from 'next';
import { CookieStorageManager } from '../../../../lib/cookie-storage';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'DELETE') {
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
    console.log(`🗑️ Clearing cookies for domain: ${decodedDomain}`);
    
    const success = CookieStorageManager.clearCookiesForDomain(decodedDomain);
    
    return res.status(200).json({
      success: success,
      data: {
        domain: decodedDomain,
        cleared: success
      }
    });

  } catch (error) {
    console.error('Cookie clear error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error clearing cookies'
    });
  }
}
