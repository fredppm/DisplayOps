import { NextApiRequest, NextApiResponse } from 'next';
import { CookieStorageManager } from '../../../lib/cookie-storage';
import { createContextLogger } from '@/utils/logger';

const cookieRemoveLogger = createContextLogger('api-cookie-remove');

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { domain, cookieName } = req.body;

    if (!domain || !cookieName) {
      return res.status(400).json({
        success: false,
        error: 'Domain and cookie name are required'
      });
    }

    cookieRemoveLogger.info('Removing cookie', { cookieName, domain });
    
    const result = CookieStorageManager.removeCookie(domain, cookieName);
    
    if (result.success) {
      return res.status(200).json({
        success: true,
        message: result.message,
        data: {
          cookieName: cookieName,
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
    cookieRemoveLogger.error('Cookie remove error', { error: error instanceof Error ? error.message : String(error) });
    return res.status(500).json({
      success: false,
      error: 'Internal server error removing cookie'
    });
  }
}