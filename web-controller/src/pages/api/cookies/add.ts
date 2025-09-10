import { NextApiRequest, NextApiResponse } from 'next';
import { CookieStorageManager } from '../../../lib/cookie-storage';
import { createContextLogger } from '@/utils/logger';

const cookieAddLogger = createContextLogger('api-cookie-add');

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

    cookieAddLogger.info('Adding/updating cookie', { cookieName: cookie.name, domain });
    
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
    cookieAddLogger.error('Cookie add error', { error: error instanceof Error ? error.message : String(error) });
    return res.status(500).json({
      success: false,
      error: 'Internal server error adding cookie'
    });
  }
}