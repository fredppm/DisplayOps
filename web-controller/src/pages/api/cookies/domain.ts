import { NextApiRequest, NextApiResponse } from 'next';
import { CookieStorageManager } from '../../../lib/cookie-storage';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { domain } = req.body;

    if (!domain || typeof domain !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Domain is required'
      });
    }

    console.log(`🗑️ Removing all cookies for domain: ${domain}`);
    
    const result = CookieStorageManager.removeDomain(domain);
    
    if (result.success) {
      return res.status(200).json({
        success: true,
        message: result.message,
        data: {
          domain: domain,
          name: domain // For compatibility with UI notification
        }
      });
    } else {
      return res.status(400).json({
        success: false,
        error: result.message
      });
    }

  } catch (error) {
    console.error('Domain remove error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error removing domain'
    });
  }
}