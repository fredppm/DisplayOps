import { NextApiRequest, NextApiResponse } from 'next';
import { createContextLogger } from '@/utils/logger';
import { cookiesRepository } from '@/lib/repositories/CookiesRepository';

const logger = createContextLogger('api-cookies-domain');

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'DELETE') {
    res.setHeader('Allow', ['DELETE']);
    return res.status(405).json({
      success: false,
      error: `Method ${req.method} Not Allowed`
    });
  }

  try {
    const { domain, cookieName } = req.body;

    // Validate input
    if (!domain || typeof domain !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Domain is required and must be a string'
      });
    }

    // Check if domain exists
    const existingDomain = await cookiesRepository.getByDomain(domain);
    
    if (!existingDomain) {
      return res.status(404).json({
        success: false,
        error: `Domain ${domain} not found`
      });
    }

    // Case 1: Delete specific cookie
    if (cookieName && typeof cookieName === 'string') {
      logger.info('Deleting specific cookie', { domain, cookieName });

      // Check if cookie exists in domain
      const cookieExists = existingDomain.cookies.some(c => c.name === cookieName);
      
      if (!cookieExists) {
        return res.status(404).json({
          success: false,
          error: `Cookie ${cookieName} not found in domain ${domain}`
        });
      }

      // Remove the cookie
      const removed = await cookiesRepository.removeCookieFromDomain(domain, cookieName);

      if (!removed) {
        return res.status(500).json({
          success: false,
          error: 'Failed to remove cookie'
        });
      }

      return res.status(200).json({
        success: true,
        data: {
          domain,
          cookieName,
          removed: true
        }
      });
    }

    // Case 2: Delete entire domain and all its cookies
    logger.info('Deleting entire domain', { domain, cookieCount: existingDomain.cookies.length });

    const deleted = await cookiesRepository.delete(existingDomain.id);

    if (!deleted) {
      return res.status(500).json({
        success: false,
        error: 'Failed to delete domain'
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        domain: existingDomain.domain,
        deletedCookies: existingDomain.cookies.length
      }
    });

  } catch (error: any) {
    logger.error('Error deleting', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error while deleting'
    });
  }
}

export default handler;

