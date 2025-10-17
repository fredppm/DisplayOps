import { NextApiRequest, NextApiResponse } from 'next';
import { createContextLogger } from '@/utils/logger';
import { cookiesRepository, Cookie } from '@/lib/repositories/CookiesRepository';

const logger = createContextLogger('api-cookies-import-devtools');

/**
 * Parse cookies from DevTools table format (tab-separated)
 * Expected format from Chrome DevTools Application tab:
 * Name  Value  Domain  Path  Expires  Size  HttpOnly  Secure  SameSite  Priority
 */
function parseCookiesFromDevTools(cookieData: string): Omit<Cookie, 'id'>[] {
  const cookies: Omit<Cookie, 'id'>[] = [];
  const lines = cookieData.split('\n').filter(line => line.trim());

  for (const line of lines) {
    const trimmed = line.trim();
    
    // Skip headers and empty lines
    if (!trimmed || 
        (trimmed.toLowerCase().includes('name') && trimmed.toLowerCase().includes('value')) ||
        trimmed.startsWith('#')) {
      continue;
    }

    let name = '';
    let value = '';
    let domain = '';
    let path = '/';
    let secure = false;
    let httpOnly = false;
    let sameSite = 'Lax';
    let expirationDate = 0; // 0 means session cookie

    // Parse tab-separated format (DevTools copy)
    if (trimmed.includes('\t')) {
      const parts = trimmed.split('\t');
      if (parts.length >= 2) {
        name = parts[0]?.trim() || '';
        value = parts[1]?.trim() || '';
        domain = parts[2]?.trim() || '';
        path = parts[3]?.trim() || '/';
        
        // Parse expiration date
        const expiresStr = parts[4]?.trim();
        if (expiresStr && expiresStr !== 'Session') {
          try {
            // Try to parse as date string
            const expiryDate = new Date(expiresStr);
            if (!isNaN(expiryDate.getTime())) {
              expirationDate = Math.floor(expiryDate.getTime() / 1000);
            }
          } catch (e) {
            // Keep as session cookie
          }
        }
        
        // DevTools format: position 6 = HttpOnly (✓), position 7 = Secure (✓)
        httpOnly = parts[6]?.trim() === '✓' || parts[6]?.trim().toLowerCase() === 'true';
        secure = parts[7]?.trim() === '✓' || parts[7]?.trim().toLowerCase() === 'true';
        sameSite = parts[8]?.trim() || 'Lax';
      }
    }
    // Parse simple name=value format
    else if (trimmed.includes('=')) {
      const equalIndex = trimmed.indexOf('=');
      name = trimmed.substring(0, equalIndex).trim();
      value = trimmed.substring(equalIndex + 1).trim();
    }

    if (name && value) {
      cookies.push({
        name,
        value,
        domain,
        path,
        secure,
        httpOnly,
        sameSite,
        expirationDate
      });
    }
  }

  return cookies;
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({
      success: false,
      error: `Method ${req.method} Not Allowed`
    });
  }

  try {
    const { domain: rawDomain, cookies: cookieData, replaceAll } = req.body;

    // Validate input
    if (!rawDomain || typeof rawDomain !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Domain is required and must be a string'
      });
    }

    if (!cookieData || typeof cookieData !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Cookie data is required and must be a string'
      });
    }

    // Normalize domain: remove protocol, www, trailing slash
    const domain = rawDomain
      .replace(/^https?:\/\//, '') // Remove http:// or https://
      .replace(/^www\./, '')        // Remove www.
      .replace(/\/$/, '')           // Remove trailing slash
      .trim();

    // Parse cookies from DevTools format
    const parsedCookies = parseCookiesFromDevTools(cookieData);

    if (parsedCookies.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid cookies found in the provided data'
      });
    }

    logger.info('Importing cookies from DevTools', {
      domain,
      cookieCount: parsedCookies.length,
      replaceAll
    });

    // Check if domain exists
    const existingDomain = await cookiesRepository.getByDomain(domain);

    if (replaceAll) {
      // Replace all cookies for this domain
      if (existingDomain) {
        await cookiesRepository.updateDomainCookies(domain, parsedCookies);
        logger.info('Replaced all cookies for domain', { domain, count: parsedCookies.length });
      } else {
        // Create new domain and add cookies
        await cookiesRepository.createDomain(domain);
        await cookiesRepository.updateDomainCookies(domain, parsedCookies);
        logger.info('Created new domain with cookies', { domain, count: parsedCookies.length });
      }
    } else {
      // Merge/add cookies to existing domain
      for (const cookie of parsedCookies) {
        await cookiesRepository.addCookieToDomain(domain, cookie);
      }
      logger.info('Merged cookies to domain', { domain, count: parsedCookies.length });
    }

    // Get updated domain data
    const updatedDomain = await cookiesRepository.getByDomain(domain);

    return res.status(200).json({
      success: true,
      data: {
        domain: updatedDomain?.domain,
        cookieCount: updatedDomain?.cookies.length || 0,
        imported: parsedCookies.length,
        replaceAll
      }
    });

  } catch (error: any) {
    logger.error('Error importing cookies from DevTools', {
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

