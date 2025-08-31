import { NextApiRequest, NextApiResponse } from 'next';
import { CookieStorageManager } from '../../../lib/cookie-storage';
import { discoveryService } from '../../../lib/discovery-singleton';
import { proxyToHost } from '../../../lib/host-utils';

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

    console.log(`🍪 Importing cookies for: ${domain}`);
    console.log(`🍪 Cookie format: ${cookieFormat || 'legacy string'}`);
    console.log(`🍪 Cookie type: ${Array.isArray(cookies) ? 'array' : typeof cookies}`);
    console.log(`🍪 Replace all mode: ${replaceAll ? 'YES' : 'NO'}`);

    // Step 1: Import and persist cookies using storage manager
    let result;
    if (cookieFormat === 'structured' && Array.isArray(cookies)) {
      // New structured format from updated extension
      console.log('🍪 Using structured cookie import');
      result = CookieStorageManager.importCookiesStructured(domain, cookies);
    } else {
      // Legacy string format (backward compatibility)
      console.log('🍪 Using legacy string cookie import');
      result = CookieStorageManager.importCookies(domain, cookies, undefined, replaceAll !== false);
    }

    if (!result.success) {
      console.error(`❌ Failed to import cookies for ${domain}:`, result.errors);
      return res.status(400).json({
        success: false,
        data: {
          injectedCount: result.injectedCount,
          skippedCount: result.skippedCount,
          errors: result.errors
        }
      });
    }

    console.log(`✅ Successfully imported ${result.injectedCount} cookies for ${domain}`);

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
        console.log(`🚀 Auto-distributing cookies to ${hosts.length} discovered hosts...`);

        // Prepare cookies for host distribution
        let parsedCookies;
        if (cookieFormat === 'structured' && Array.isArray(cookies)) {
          // Use structured cookies directly
          console.log('🚀 Using structured cookies for host distribution');
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
          console.log('🚀 Using legacy string parsing for host distribution');
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
              console.log(`✅ Cookies distributed to host ${host.id} (${host.name})`);
              hostDistributionResults.hostsSuccess++;
              return { success: true, host: host.id };
            } else {
              const error = `Host ${host.id}: ${responseData.error || 'Unknown error'}`;
              console.warn(`⚠️ ${error}`);
              hostDistributionResults.hostsFailed++;
              hostDistributionResults.errors.push(error);
              return { success: false, host: host.id, error };
            }
          } catch (error) {
            const errorMsg = `Host ${host.id}: ${error instanceof Error ? error.message : 'Connection failed'}`;
            console.error(`❌ ${errorMsg}`);
            hostDistributionResults.hostsFailed++;
            hostDistributionResults.errors.push(errorMsg);
            return { success: false, host: host.id, error: errorMsg };
          }
        });

        await Promise.allSettled(distributionPromises);
        
        console.log(`📊 Distribution complete: ${hostDistributionResults.hostsSuccess}/${hostDistributionResults.hostsFound} hosts successful`);
      } else {
        console.log(`ℹ️ No hosts discovered for cookie distribution`);
      }

    } catch (error) {
      console.error('❌ Host discovery/distribution error:', error);
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
    console.error('Cookie import error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error processing cookies'
    });
  }
}
