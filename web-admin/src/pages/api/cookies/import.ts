import { NextApiRequest, NextApiResponse } from 'next';
import { createContextLogger } from '@/utils/logger';
import { cookiesRepository, Cookie } from '@/lib/repositories/CookiesRepository';

const logger = createContextLogger('api-cookies-import');

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({
      success: false,
      error: `Method ${req.method} Not Allowed`
    });
  }

  try {
    const { domain: rawDomain, cookies, cookieFormat } = req.body;

    // Validate input
    if (!cookies || !Array.isArray(cookies)) {
      return res.status(400).json({
        success: false,
        error: 'Cookies must be an array'
      });
    }

    if (cookies.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No cookies provided'
      });
    }

    // Extract domain from the cookies themselves (most common cookie domain)
    // This is more reliable than the navigation domain
    const cookieDomains = cookies
      .map(c => c.domain)
      .filter(d => d && typeof d === 'string')
      .map(d => d.replace(/^\./, '').trim()); // Remove leading dot

    // Use the most common domain from cookies, or first non-empty domain
    const domain = cookieDomains.length > 0 
      ? cookieDomains.sort((a, b) => 
          cookieDomains.filter(x => x === b).length - cookieDomains.filter(x => x === a).length
        )[0]
      : (rawDomain || '').replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '').trim();

    if (!domain) {
      return res.status(400).json({
        success: false,
        error: 'Could not determine domain from cookies'
      });
    }

    logger.info('Importing cookies', {
      requestDomain: rawDomain,
      extractedDomain: domain,
      cookieCount: cookies.length,
      format: cookieFormat
    });

    // Import cookies one by one (will merge/update existing cookies)
    let injectedCount = 0;
    const errors: string[] = [];
    
    for (const cookie of cookies) {
      try {
        // Validate required fields
        if (!cookie.name || !cookie.value) {
          logger.warn('Skipping invalid cookie', { cookie });
          errors.push(`Invalid cookie: missing name or value`);
          continue;
        }

        const cookieToAdd: Omit<Cookie, 'id'> = {
          name: cookie.name,
          value: cookie.value,
          domain: domain, // Always use the normalized domain from the request
          path: cookie.path || '/',
          secure: cookie.secure || false,
          httpOnly: cookie.httpOnly || false,
          sameSite: cookie.sameSite || 'Lax',
          expirationDate: cookie.expirationDate || 0,
          description: cookie.description || `Cookie ${cookie.name} for ${domain}`
        };

        await cookiesRepository.addCookieToDomain(domain, cookieToAdd);
        injectedCount++;
        logger.info('Cookie added successfully', { 
          domain, 
          cookieName: cookie.name 
        });
      } catch (cookieError) {
        const errorMsg = cookieError instanceof Error ? cookieError.message : String(cookieError);
        logger.warn('Failed to add cookie', {
          cookie: cookie.name,
          error: errorMsg,
          stack: cookieError instanceof Error ? cookieError.stack : undefined
        });
        errors.push(`${cookie.name}: ${errorMsg}`);
      }
    }

    logger.info('Cookies import completed', {
      domain,
      injectedCount,
      totalProvided: cookies.length,
      errorCount: errors.length
    });

    // If no cookies were imported, return error
    if (injectedCount === 0) {
      return res.status(400).json({
        success: false,
        error: 'No cookies were imported',
        data: {
          domain,
          injectedCount: 0,
          totalProvided: cookies.length,
          errors
        }
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        domain,
        injectedCount,
        totalProvided: cookies.length,
        errors: errors.length > 0 ? errors : undefined
      }
    });

  } catch (error: any) {
    logger.error('Error importing cookies', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error while importing cookies'
    });
  }
}

export default handler;

