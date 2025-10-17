import { NextApiRequest, NextApiResponse } from 'next';
import { createContextLogger } from '@/utils/logger';
import { cookiesRepository } from '@/lib/repositories/CookiesRepository';

const logger = createContextLogger('api-cookies-domain-get');

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({
      success: false,
      error: `Method ${req.method} Not Allowed`
    });
  }

  try {
    const { domain } = req.query;

    // Validate input
    if (!domain || typeof domain !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Domain parameter is required and must be a string'
      });
    }

    // Decode the domain (in case it was URL encoded)
    const decodedDomain = decodeURIComponent(domain);

    logger.info('Getting cookies for domain', { domain: decodedDomain });

    // Get domain data
    const domainData = await cookiesRepository.getByDomain(decodedDomain);
    
    if (!domainData) {
      return res.status(404).json({
        success: false,
        error: `Domain ${decodedDomain} not found`
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        domain: domainData.domain,
        description: domainData.description,
        cookies: domainData.cookies,
        updatedAt: domainData.updatedAt
      }
    });

  } catch (error: any) {
    logger.error('Error getting domain cookies', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error while getting domain cookies'
    });
  }
}

export default handler;

