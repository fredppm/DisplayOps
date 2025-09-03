import { NextApiRequest, NextApiResponse } from 'next';
import { CookieStorageManager } from '../../../lib/cookie-storage';
import { discoveryService } from '../../../lib/discovery-singleton';
import { proxyToHost } from '../../../lib/host-utils';

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

    console.log(`🍪 [DevTools Import] Importing cookies for: ${domain}`);
    console.log(`🍪 [DevTools Import] Replace all mode: ${replaceAll ? 'YES' : 'NO'}`);
    console.log(`🍪 [DevTools Import] Raw cookie data length: ${cookies.length}`);

    // Step 1: Parse DevTools string format to structured cookies
    const structuredCookies = parseDevToolsTable(cookies, domain);
    
    console.log(`🍪 [DevTools Import] Parsed ${structuredCookies.length} structured cookies`);

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
      console.error(`❌ Failed to import DevTools cookies for ${domain}:`, result.errors);
      return res.status(400).json({
        success: false,
        data: {
          injectedCount: result.injectedCount,
          skippedCount: result.skippedCount,
          errors: result.errors
        }
      });
    }

    console.log(`✅ Successfully imported ${result.injectedCount} DevTools cookies for ${domain}`);

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
        console.log(`🔍 Found ${hosts.length} hosts for cookie distribution`);

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
              console.log(`✅ Successfully distributed cookies to ${host.hostname || host.ipAddress}`);
            } else {
              hostDistributionResults.hostsFailed++;
              hostDistributionResults.errors.push(`${host.hostname}: ${responseData.error || 'Unknown error'}`);
              console.error(`❌ Failed to distribute to ${host.hostname}: ${responseData.error || 'Unknown error'}`);
            }
          } catch (error) {
            hostDistributionResults.hostsFailed++;
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            hostDistributionResults.errors.push(`${host.hostname}: ${errorMsg}`);
            console.error(`❌ Exception distributing to ${host.hostname}:`, error);
          }
        });

        await Promise.all(distributionPromises);
      } else {
        console.log('ℹ️ No hosts found for distribution');
      }
    } catch (error) {
      console.error('Error during host distribution:', error);
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
    console.error('DevTools cookie import error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error importing DevTools cookies'
    });
  }
}