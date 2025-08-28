import { NextApiRequest, NextApiResponse } from 'next';
import { CookieStorageManager } from '../../../lib/cookie-storage';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { domain, cookies, timestamp } = req.body;

    if (!domain || !cookies) {
      return res.status(400).json({
        success: false,
        error: 'Domain and cookies are required'
      });
    }

    console.log(`🍪 Importing cookies for: ${domain}`);

    // Import cookies using storage manager
    const result = CookieStorageManager.importCookies(domain, cookies);

    if (result.success) {
      console.log(`✅ Successfully imported ${result.injectedCount} cookies for ${domain}`);
    } else {
      console.error(`❌ Failed to import cookies for ${domain}:`, result.errors);
    }

    return res.status(result.success ? 200 : 400).json({
      success: result.success,
      data: {
        injectedCount: result.injectedCount,
        skippedCount: result.skippedCount,
        errors: result.errors
      }
    });

  } catch (error) {
    console.error('Cookie import error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error processing cookies'
    });
  }
}
