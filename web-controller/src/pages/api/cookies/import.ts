import { NextApiRequest, NextApiResponse } from 'next';
import { CookieStorageManager } from '../../../lib/cookie-storage';
import { discoveryService } from '../../../lib/discovery-singleton';
import { proxyToHost } from '../../../lib/host-utils';
import { createContextLogger } from '@/utils/logger';

const cookieImportLogger = createContextLogger('api-cookie-import');

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { domain, cookies, cookieFormat, replaceAll, timestamp } = req.body;

    if (!domain || !cookies) {
      return res.status(400).json({
        success: false,
        error: 'Domain and cookies are required'
      });
    }

    cookieImportLogger.info('Importing cookies', {
      domain,
      cookieFormat: cookieFormat || 'legacy string',
      cookieType: Array.isArray(cookies) ? 'array' : typeof cookies,
      replaceAll: replaceAll ? 'YES' : 'NO'
    });

    // Step 1: Import and persist cookies using storage manager
    let result;
    if (cookieFormat === 'structured' && Array.isArray(cookies)) {
      // New structured format from updated extension
      cookieImportLogger.info('Using structured cookie import');
      result = CookieStorageManager.importCookiesStructured(domain, cookies);
    } else {
      // Legacy string format (backward compatibility)
      cookieImportLogger.info('Using legacy string cookie import');
      result = CookieStorageManager.importCookies(domain, cookies, undefined, replaceAll !== false);
    }

    if (!result.success) {
      cookieImportLogger.error('Failed to import cookies', { domain, errors: result.errors });
      return res.status(400).json({
        success: false,
        data: {
          injectedCount: result.injectedCount,
          skippedCount: result.skippedCount,
          errors: result.errors
        }
      });
    }

    cookieImportLogger.info('Successfully imported cookies', { domain, injectedCount: result.injectedCount });

    // Step 2: Auto-distribute cookies to all discovered hosts
    let hostDistributionResults = {
      hostsFound: 0,
      hostsSuccess: 0,
      hostsFailed: 0,
      errors: [] as string[]
    };

    try {
      // Initialize discovery service and get hosts
      await discoveryService.initialize();
      const hosts = discoveryService.getHosts();
      hostDistributionResults.hostsFound = hosts.length;

      if (hosts.length > 0) {
        cookieImportLogger.info('Auto-distributing cookies to discovered hosts', { hostCount: hosts.length });

        // Prepare cookies for host distribution
        let parsedCookies;
        if (cookieFormat === 'structured' && Array.isArray(cookies)) {
          // Use structured cookies directly
          cookieImportLogger.info('Using structured cookies for host distribution');
          parsedCookies = cookies.map((cookie: any) => ({
            name: cookie.name,
            value: cookie.value,
            domain: cookie.domain || domain,
            path: cookie.path || '/',
            secure: cookie.secure || false,
            httpOnly: cookie.httpOnly || false,
            sameSite: cookie.sameSite || 'Lax',
            expirationDate: cookie.expirationDate
          }));
        } else {
          // Legacy string parsing for backward compatibility
          cookieImportLogger.info('Using legacy string parsing for host distribution');
          const cookieLines = cookies.split('\n').filter((line: string) => line.trim());
          parsedCookies = cookieLines.map((line: string) => {
            const trimmed = line.trim();
            if (trimmed.includes('=')) {
              const equalIndex = trimmed.indexOf('=');
              const name = trimmed.substring(0, equalIndex).trim();
              const value = trimmed.substring(equalIndex + 1).trim();
              return {
                name,
                value,
                domain: domain,
                path: '/',
                secure: domain.startsWith('https'),
                httpOnly: false,
                sameSite: 'Lax' as const
              };
            }
            return null;
          }).filter(Boolean);
        }

        // Distribute to each host
        const distributionPromises = hosts.map(async (host: any) => {
          try {
            const hostResponse = await proxyToHost(host.id, '/api/command', {
              method: 'POST',
              body: JSON.stringify({
                type: 'sync_cookies',
                targetTv: 'all',
                payload: {
                  domain: domain,
                  cookies: parsedCookies
                }
              })
            });

            const responseData = await hostResponse.json();
            
            if (hostResponse.ok && responseData.success) {
              cookieImportLogger.info('Cookies distributed to host', { hostId: host.id, hostName: host.name });
              hostDistributionResults.hostsSuccess++;
              return { success: true, host: host.id };
            } else {
              const error = `Host ${host.id}: ${responseData.error || 'Unknown error'}`;
              cookieImportLogger.warn('Cookie distribution warning', { error });
              hostDistributionResults.hostsFailed++;
              hostDistributionResults.errors.push(error);
              return { success: false, host: host.id, error };
            }
          } catch (error) {
            const errorMsg = `Host ${host.id}: ${error instanceof Error ? error.message : 'Connection failed'}`;
            cookieImportLogger.error('Cookie distribution error', { error: errorMsg });
            hostDistributionResults.hostsFailed++;
            hostDistributionResults.errors.push(errorMsg);
            return { success: false, host: host.id, error: errorMsg };
          }
        });

        await Promise.allSettled(distributionPromises);
        
        cookieImportLogger.info('Distribution complete', {
          successful: hostDistributionResults.hostsSuccess,
          total: hostDistributionResults.hostsFound
        });
      } else {
        cookieImportLogger.info('No hosts discovered for cookie distribution');
      }

    } catch (error) {
      cookieImportLogger.error('Host discovery/distribution error', { error });
      hostDistributionResults.errors.push(`Discovery error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Return comprehensive result (persistence + distribution)
    return res.status(200).json({
      success: true,
      data: {
        // Persistence results (existing functionality)
        injectedCount: result.injectedCount,
        skippedCount: result.skippedCount,
        errors: result.errors,
        
        // New: Host distribution results
        hostDistribution: {
          enabled: true,
          hostsFound: hostDistributionResults.hostsFound,
          hostsSuccess: hostDistributionResults.hostsSuccess,
          hostsFailed: hostDistributionResults.hostsFailed,
          distributionErrors: hostDistributionResults.errors
        }
      }
    });

  } catch (error) {
    cookieImportLogger.error('Cookie import error', { error });
    return res.status(500).json({
      success: false,
      error: 'Internal server error processing cookies'
    });
  }
}
