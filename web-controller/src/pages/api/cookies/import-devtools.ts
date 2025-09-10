import { NextApiRequest, NextApiResponse } from 'next';
import { CookieStorageManager } from '../../../lib/cookie-storage';
import { discoveryService } from '../../../lib/discovery-singleton';
import { proxyToHost } from '../../../lib/host-utils';
import { createContextLogger } from '@/utils/logger';

const cookiesImportLogger = createContextLogger('api-cookies-import');

// Function to parse DevTools table format to structured cookies
function parseDevToolsTable(cookieStr: string, domain: string): any[] {
  const cookies: any[] = [];
  const lines = cookieStr.split('\n').filter(line => line.trim());

  for (const line of lines) {
    const trimmed = line.trim();
    
    // Skip headers and empty lines
    if (!trimmed || 
        trimmed.toLowerCase().includes('name') && trimmed.toLowerCase().includes('value') ||
        trimmed.startsWith('#')) {
      continue;
    }

    let name = '';
    let value = '';
    let cookieDomain = domain;
    let cookiePath = '/';
    let cookieSecure = domain.startsWith('https');
    let cookieHttpOnly = false;
    let cookieSameSite = 'Lax';

    // Parse tab-separated format (DevTools copy)
    if (trimmed.includes('\t')) {
      const parts = trimmed.split('\t');
      if (parts.length >= 2) {
        name = parts[0]?.trim() || '';
        value = parts[1]?.trim() || '';
        
        // Extract additional fields from DevTools table format if available
        if (parts.length >= 9) {
          cookieDomain = parts[2]?.trim() || domain;
          cookiePath = parts[3]?.trim() || '/';
          cookieHttpOnly = parts[6]?.trim() === '✓';
          cookieSecure = parts[7]?.trim() === '✓';
          cookieSameSite = (parts[8]?.trim() || 'Lax');
        }
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
        domain: cookieDomain,
        path: cookiePath,
        secure: cookieSecure,
        httpOnly: cookieHttpOnly,
        sameSite: cookieSameSite.toLowerCase(),
        importedAt: new Date()
      });
    }
  }

  return cookies;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { domain, cookies, replaceAll, timestamp } = req.body;

    if (!domain || !cookies) {
      return res.status(400).json({
        success: false,
        error: 'Domain and cookies are required'
      });
    }

    cookiesImportLogger.info('DevTools import starting', { domain, replaceAll, rawDataLength: cookies.length });

    // Step 1: Parse DevTools string format to structured cookies
    const structuredCookies = parseDevToolsTable(cookies, domain);
    
    cookiesImportLogger.info('DevTools cookies parsed', { parsedCount: structuredCookies.length });

    if (structuredCookies.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid cookies found in DevTools format'
      });
    }

    // Step 2: Store cookies using structured format
    const result = CookieStorageManager.importCookiesStructured(
      domain, 
      structuredCookies, 
      `Cookies for ${domain}`,
      replaceAll !== false
    );

    if (!result.success) {
      cookiesImportLogger.error('Failed to import DevTools cookies', { domain, errors: result.errors });
      return res.status(400).json({
        success: false,
        data: {
          injectedCount: result.injectedCount,
          skippedCount: result.skippedCount,
          errors: result.errors
        }
      });
    }

    cookiesImportLogger.info('DevTools cookies imported successfully', { domain, injectedCount: result.injectedCount });

    // Step 3: Auto-distribute cookies to all discovered hosts
    let hostDistributionResults = {
      hostsFound: 0,
      hostsSuccess: 0,
      hostsFailed: 0,
      errors: [] as string[]
    };

    try {
      // Get hosts from discovery service
      const hosts = discoveryService.getHosts();
      if (hosts.length > 0) {
        hostDistributionResults.hostsFound = hosts.length;
        cookiesImportLogger.info('Found hosts for distribution', { hostCount: hosts.length });

        const distributionPromises = hosts.map(async (host) => {
          try {
            const response = await proxyToHost(host.id, '/api/cookies/inject', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                domain: domain,
                cookies: structuredCookies,
                timestamp: new Date()
              })
            });

            const responseData = await response.json();
            if (response.ok && responseData.success) {
              hostDistributionResults.hostsSuccess++;
              cookiesImportLogger.debug('Successfully distributed cookies to host', { hostname: host.hostname || host.ipAddress });
            } else {
              hostDistributionResults.hostsFailed++;
              hostDistributionResults.errors.push(`${host.hostname}: ${responseData.error || 'Unknown error'}`);
              cookiesImportLogger.error('Failed to distribute to host', { hostname: host.hostname, error: responseData.error || 'Unknown error' });
            }
          } catch (error) {
            hostDistributionResults.hostsFailed++;
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            hostDistributionResults.errors.push(`${host.hostname}: ${errorMsg}`);
            cookiesImportLogger.error('Exception distributing to host', { hostname: host.hostname, error: error instanceof Error ? error.message : String(error) });
          }
        });

        await Promise.all(distributionPromises);
      } else {
        cookiesImportLogger.info('No hosts found for distribution');
      }
    } catch (error) {
      cookiesImportLogger.error('Error during host distribution', { error: error instanceof Error ? error.message : String(error) });
      hostDistributionResults.errors.push('Host discovery failed');
    }

    // Return comprehensive results
    return res.status(200).json({
      success: true,
      data: {
        injectedCount: result.injectedCount,
        skippedCount: result.skippedCount,
        errors: result.errors,
        hostDistribution: hostDistributionResults,
        parsedCookies: structuredCookies.length,
        replaceAll: replaceAll !== false
      }
    });

  } catch (error) {
    cookiesImportLogger.error('DevTools cookie import error', { error: error instanceof Error ? error.message : String(error) });
    return res.status(500).json({
      success: false,
      error: 'Internal server error importing DevTools cookies'
    });
  }
}