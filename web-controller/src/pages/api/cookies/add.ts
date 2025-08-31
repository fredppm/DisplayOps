import { NextApiRequest, NextApiResponse } from 'next';
import { CookieStorageManager } from '../../../lib/cookie-storage';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { domain, cookie } = req.body;

    if (!domain || !cookie || !cookie.name || !cookie.value) {
      return res.status(400).json({
        success: false,
        error: 'Domain, cookie name and value are required'
      });
    }

    console.log(`🍪 Adding/updating cookie ${cookie.name} for domain: ${domain}`);
    
    const result = CookieStorageManager.addOrUpdateCookie(domain, cookie);
    
    if (result.success) {
      return res.status(200).json({
        success: true,
        message: result.message,
        data: {
          cookieName: cookie.name,
          domain: domain
        }
      });
    } else {
      return res.status(400).json({
        success: false,
        error: result.message
      });
    }

  } catch (error) {
    console.error('Cookie add error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error adding cookie'
    });
  }
}