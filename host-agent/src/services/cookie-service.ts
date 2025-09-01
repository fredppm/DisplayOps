import { session } from 'electron';
import { URLValidator } from './url-validator';

export interface CookieData {
  name: string;
  value: string;
  domain?: string;
  path?: string;
  secure?: boolean;
  httpOnly?: boolean;
  expirationDate?: number;
  sameSite?: 'unspecified' | 'no_restriction' | 'lax' | 'strict';
}

export interface CookieImportRequest {
  domain: string;
  cookies: string; // Raw cookie string from browser
  timestamp: Date;
}

export interface CookieImportResult {
  success: boolean;
  injectedCount: number;
  skippedCount: number;
  errors: string[];
}

export class CookieService {
  private cookieStore: Map<string, CookieData[]> = new Map();

  /**
   * Parses raw cookie string from browser DevTools into structured data
   * Supports multiple formats:
   * 1. Simple name=value format
   * 2. DevTools table format (tab-separated)
   * 3. JSON export format
   */
  public parseCookiesFromString(cookieString: string, domain: string): CookieData[] {
    const cookies: CookieData[] = [];
    const lines = cookieString.split('\n').filter(line => line.trim());

    // Extract domain from URL if provided
    let cookieDomain = domain;
    try {
      const url = new URL(domain);
      cookieDomain = url.hostname;
    } catch {
      // If domain is not a URL, use as is
    }

    for (const line of lines) {
      const trimmed = line.trim();
      
      // Skip comments, empty lines, and headers
      if (!trimmed || 
          trimmed.startsWith('#') || 
          trimmed.startsWith('//') ||
          trimmed.toLowerCase().includes('name') && trimmed.toLowerCase().includes('value') && trimmed.toLowerCase().includes('domain')) {
        continue;
      }

      // Try to detect and parse different formats
      const cookie = this.parseSingleCookieLine(trimmed, cookieDomain, domain);
      if (cookie) {
        cookies.push(cookie);
      }
    }

    return cookies;
  }

  /**
   * Parses a single cookie line in various formats
   */
  private parseSingleCookieLine(line: string, cookieDomain: string, originalDomain: string): CookieData | null {
    // Format 1: DevTools table format (tab-separated values)
    // Example: "cookie_name	cookie_value	domain	path	expiry	size	httpOnly	secure	sameSite"
    if (line.includes('\t')) {
      return this.parseDevToolsTableFormat(line, cookieDomain, originalDomain);
    }

    // Format 2: Simple name=value format
    // Example: "cookie_name=cookie_value"
    const equalIndex = line.indexOf('=');
    if (equalIndex !== -1) {
      return this.parseSimpleFormat(line, cookieDomain, originalDomain);
    }

    // Format 3: Try to extract from complex formats
    // Look for patterns like "name: value" or similar
    const colonIndex = line.indexOf(':');
    if (colonIndex !== -1) {
      const name = line.substring(0, colonIndex).trim();
      const value = line.substring(colonIndex + 1).trim();
      
      if (name && value && !name.includes(' ') && name.length < 100) {
        return {
          name,
          value,
          domain: cookieDomain,
          path: '/',
          secure: originalDomain.startsWith('https'),
          httpOnly: false,
          sameSite: 'lax'
        };
      }
    }

    return null;
  }

  /**
   * Parses DevTools table format (tab-separated)
   */
  private parseDevToolsTableFormat(line: string, cookieDomain: string, originalDomain: string): CookieData | null {
    const parts = line.split('\t');
    
    if (parts.length < 2) {
      return null;
    }

    const name = parts[0]?.trim();
    const value = parts[1]?.trim();
    
    if (!name || !value) {
      return null;
    }

    // Extract additional properties if available
    const domain = parts[2]?.trim() || cookieDomain;
    const path = parts[3]?.trim() || '/';
    const secure = parts[7]?.trim() === '✓' || parts[7]?.trim() === 'true' || originalDomain.startsWith('https');
    const httpOnly = parts[6]?.trim() === '✓' || parts[6]?.trim() === 'true';
    const sameSiteValue = parts[8]?.trim().toLowerCase();
    
    let sameSite: 'unspecified' | 'no_restriction' | 'lax' | 'strict' = 'lax';
    if (sameSiteValue === 'none') sameSite = 'no_restriction';
    else if (sameSiteValue === 'strict') sameSite = 'strict';
    else if (sameSiteValue === 'lax') sameSite = 'lax';

    return {
      name,
      value,
      domain: domain.startsWith('.') ? domain.substring(1) : domain,
      path,
      secure,
      httpOnly,
      sameSite
    };
  }

  /**
   * Parses simple name=value format
   */
  private parseSimpleFormat(line: string, cookieDomain: string, originalDomain: string): CookieData | null {
    const equalIndex = line.indexOf('=');
    const name = line.substring(0, equalIndex).trim();
    const value = line.substring(equalIndex + 1).trim();

    if (name && value) {
      return {
        name,
        value,
        domain: cookieDomain,
        path: '/',
        secure: originalDomain.startsWith('https'),
        httpOnly: false,
        sameSite: 'lax'
      };
    }

    return null;
  }

  /**
   * Imports cookies for a specific domain
   */
  public async importCookies(request: CookieImportRequest): Promise<CookieImportResult> {
    console.log(`Importing cookies for domain: ${request.domain}`);

    const result: CookieImportResult = {
      success: false,
      injectedCount: 0,
      skippedCount: 0,
      errors: []
    };

    try {
      // Validate domain
      if (!URLValidator.isValidURL(request.domain)) {
        throw new Error('Invalid domain URL');
      }

      // Parse cookies from string
      const cookies = this.parseCookiesFromString(request.cookies, request.domain);
      
      if (cookies.length === 0) {
        throw new Error('No valid cookies found in the provided string');
      }

      console.log(`Parsed ${cookies.length} cookies for ${request.domain}`);

      // Store cookies in memory  
      this.cookieStore.set(request.domain, cookies);

      // Inject cookies into all relevant Electron sessions
      const injectionResult = await this.injectCookiesIntoSessions(request.domain, cookies);
      
      result.injectedCount = injectionResult.injectedCount;
      result.skippedCount = injectionResult.skippedCount;
      result.errors = injectionResult.errors;
      result.success = injectionResult.injectedCount > 0;

      console.log(`Cookie import completed: ${result.injectedCount} injected, ${result.skippedCount} skipped`);

      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error importing cookies:', errorMessage);
      
      result.errors.push(errorMessage);
      return result;
    }
  }

  /**
   * Injects cookies into all Electron sessions
   */
  private async injectCookiesIntoSessions(domain: string, cookies: CookieData[]): Promise<{
    injectedCount: number;
    skippedCount: number;
    errors: string[];
  }> {
    let injectedCount = 0;
    let skippedCount = 0;
    const errors: string[] = [];

    try {
      // Get the default session
      const defaultSession = session.defaultSession;
      
      if (!defaultSession) {
        throw new Error('No default Electron session available');
      }

      logger.info(`Injecting ${cookies.length} cookies for domain: ${domain}`);

      // First, let's check existing cookies for comparison
      const existingCookies = await defaultSession.cookies.get({});
      const existingForDomain = existingCookies.filter(c => 
        c.domain === domain || 
        c.domain === `.${domain}` || 
        domain.includes(c.domain?.replace('.', '') || '')
      );
      logger.debug(`Found ${existingForDomain.length} existing cookies for domain ${domain}`);

      // Inject each cookie
      for (let i = 0; i < cookies.length; i++) {
        const cookie = cookies[i];
        try {
          logger.debug(`Processing cookie ${i + 1}/${cookies.length}: ${cookie.name}`);
          logger.debug(`Cookie data: ${cookie.name} for ${cookie.domain || domain}, secure: ${cookie.secure}`);

          // Convert our cookie format to Electron's format
          const electronCookie = {
            url: domain,
            name: cookie.name,
            value: cookie.value,
            domain: cookie.domain,
            path: cookie.path || '/',
            secure: cookie.secure || false,
            httpOnly: cookie.httpOnly || false,
            expirationDate: cookie.expirationDate,
            sameSite: this.convertSameSite(cookie.sameSite)
          };

          // Remove undefined fields but log what we're removing
          const fieldsRemoved: string[] = [];
          Object.keys(electronCookie).forEach(key => {
            if ((electronCookie as any)[key] === undefined) {
              fieldsRemoved.push(key);
              delete (electronCookie as any)[key];
            }
          });
          
          if (fieldsRemoved.length > 0) {
            logger.debug(`Removed undefined fields: ${fieldsRemoved.join(', ')}`);
          }

          logger.debug(`Prepared Electron cookie: ${cookie.name}`);

          // Attempt injection
          await defaultSession.cookies.set(electronCookie);
          injectedCount++;
          
          logger.debug(`Successfully injected cookie: ${cookie.name}`);
          
          // Verify injection by reading it back
          const verificationCookies = await defaultSession.cookies.get({ name: cookie.name });
          const matchingCookie = verificationCookies.find(c => 
            c.name === cookie.name && 
            (c.domain === cookie.domain || c.domain === domain)
          );
          
          if (matchingCookie) {
            logger.debug(`Cookie verification successful: ${cookie.name}`);
          } else {
            console.warn(`⚠️ [COOKIE-INJECT] Verification failed - cookie ${cookie.name} not found in session after injection`);
          }

        } catch (error) {
          skippedCount++;
          const errorMsg = `Failed to inject cookie ${cookie.name}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          errors.push(errorMsg);
          console.error(`❌ [COOKIE-INJECT] ${errorMsg}`);
          console.error(`❌ [COOKIE-INJECT] Cookie data that failed:`, {
            name: cookie.name,
            domain: cookie.domain,
            originalDomain: domain,
            secure: cookie.secure,
            httpOnly: cookie.httpOnly,
            path: cookie.path
          });
        }
      }

      // Final verification - count all cookies for this domain after injection
      const finalCookies = await defaultSession.cookies.get({});
      const finalForDomain = finalCookies.filter(c => 
        c.domain === domain || 
        c.domain === `.${domain}` || 
        domain.includes(c.domain?.replace('.', '') || '')
      );
      
      logger.info(`Cookie injection completed for ${domain}: ${injectedCount}/${cookies.length} injected, ${skippedCount} skipped`);
      if (injectedCount > 0) {
        logger.debug(`Final session has ${finalForDomain.length} cookies for domain`);
      }

      return { injectedCount, skippedCount, errors };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      errors.push(`Session injection failed: ${errorMessage}`);
      return { injectedCount, skippedCount, errors };
    }
  }

  /**
   * Gets stored cookies for a domain
   */
  public getCookiesForDomain(domain: string): CookieData[] {
    return this.cookieStore.get(domain) || [];
  }

  /**
   * Gets all stored domains
   */
  public getAllDomains(): string[] {
    return Array.from(this.cookieStore.keys());
  }

  /**
   * Clears cookies for a specific domain
   */
  public async clearCookiesForDomain(domain: string): Promise<boolean> {
    try {
      // Remove from memory store
      this.cookieStore.delete(domain);

      // Clear from Electron session
      const defaultSession = session.defaultSession;
      if (defaultSession) {
        const cookies = await defaultSession.cookies.get({ domain });
        
        for (const cookie of cookies) {
          await defaultSession.cookies.remove(domain, cookie.name);
        }
      }

      console.log(`Cleared cookies for domain: ${domain}`);
      return true;

    } catch (error) {
      console.error(`Error clearing cookies for ${domain}:`, error);
      return false;
    }
  }

  /**
   * Validates if cookies are still valid for a domain
   */
  public async validateCookiesForDomain(domain: string): Promise<{
    isValid: boolean;
    cookieCount: number;
    activeCount: number;
  }> {
    try {
      const storedCookies = this.getCookiesForDomain(domain);
      const defaultSession = session.defaultSession;
      
      if (!defaultSession) {
        return { isValid: false, cookieCount: storedCookies.length, activeCount: 0 };
      }

      // Get current cookies from session
      const sessionCookies = await defaultSession.cookies.get({});
      const domainCookies = sessionCookies.filter(cookie => 
        cookie.domain === domain || cookie.domain === URLValidator.extractDomain(domain)
      );

      return {
        isValid: domainCookies.length > 0,
        cookieCount: storedCookies.length,
        activeCount: domainCookies.length
      };

    } catch (error) {
      console.error(`Error validating cookies for ${domain}:`, error);
      return { isValid: false, cookieCount: 0, activeCount: 0 };
    }
  }

  /**
   * Re-injects stored cookies for all domains
   */
  public async refreshAllCookies(): Promise<{
    domainsProcessed: number;
    totalInjected: number;
    errors: string[];
  }> {
    let domainsProcessed = 0;
    let totalInjected = 0;
    const errors: string[] = [];

    console.log('Refreshing all stored cookies...');

    const entries = Array.from(this.cookieStore.entries());
    for (const [domain, cookies] of entries) {
      try {
        const result = await this.injectCookiesIntoSessions(domain, cookies);
        domainsProcessed++;
        totalInjected += result.injectedCount;
        errors.push(...result.errors);

      } catch (error) {
        const errorMsg = `Failed to refresh cookies for ${domain}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        errors.push(errorMsg);
        console.error(errorMsg);
      }
    }

    console.log(`Cookie refresh completed: ${domainsProcessed} domains, ${totalInjected} cookies injected`);

    return { domainsProcessed, totalInjected, errors };
  }

  /**
   * Gets cookie statistics
   */
  public getStatistics(): {
    domains: number;
    totalCookies: number;
    domainDetails: Array<{
      domain: string;
      cookieCount: number;
      lastImport: Date | null;
    }>;
  } {
    const domainDetails = Array.from(this.cookieStore.entries()).map(([domain, cookies]) => ({
      domain,
      cookieCount: cookies.length,
      lastImport: null // We could track this if needed
    }));

    return {
      domains: this.cookieStore.size,
      totalCookies: Array.from(this.cookieStore.values()).reduce((sum, cookies) => sum + cookies.length, 0),
      domainDetails
    };
  }

  private convertSameSite(sameSite?: string): 'unspecified' | 'no_restriction' | 'lax' | 'strict' {
    switch (sameSite?.toLowerCase()) {
      case 'none':
        return 'no_restriction';
      case 'lax':
        return 'lax';
      case 'strict':
        return 'strict';
      default:
        return 'unspecified';
    }
  }
}
