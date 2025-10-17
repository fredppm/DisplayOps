import { NextApiRequest, NextApiResponse } from 'next';
import { createContextLogger } from '@/utils/logger';
import { cookiesRepository } from '@/lib/repositories/CookiesRepository';

const logger = createContextLogger('api-cookies-status');

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({
      success: false,
      error: `Method ${req.method} Not Allowed`
    });
  }

  try {
    // Get all cookie domains
    const allDomains = await cookiesRepository.getAll();

    // Calculate statistics
    const totalCookies = allDomains.reduce((sum, domain) => sum + domain.cookies.length, 0);
    
    const domainDetails = allDomains.map(domain => ({
      domain: domain.domain,
      description: domain.description,
      cookieCount: domain.cookies.length,
      lastImport: domain.updatedAt,
      cookies: domain.cookies
    }));

    return res.status(200).json({
      success: true,
      data: {
        domains: allDomains.length,
        totalCookies,
        domainDetails
      }
    });

  } catch (error: any) {
    logger.error('Error getting cookie status', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error while getting cookie status'
    });
  }
}

export default handler;

