import fs from 'fs';
import path from 'path';

interface StoredCookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  secure: boolean;
  httpOnly: boolean;
  sameSite: string;
  expirationDate?: number;
  importedAt: Date;
}

interface CookieDomain {
  domain: string;
  cookies: StoredCookie[];
  lastImport: Date;
  description: string;
}

interface CookieStorage {
  domains: { [key: string]: CookieDomain };
  lastUpdated: Date;
}

const STORAGE_FILE = path.join(process.cwd(), 'web-controller/data/cookies.json');

// Ensure data directory exists
const dataDir = path.dirname(STORAGE_FILE);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

export class CookieStorageManager {
  
  /**
   * Load cookies from storage
   */
  private static loadStorage(): CookieStorage {
    try {
      if (fs.existsSync(STORAGE_FILE)) {
        const data = fs.readFileSync(STORAGE_FILE, 'utf8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.warn('Failed to load cookie storage:', error);
    }
    
    return {
      domains: {},
      lastUpdated: new Date()
    };
  }

  /**
   * Save cookies to storage
   */
  private static saveStorage(storage: CookieStorage): void {
    try {
      storage.lastUpdated = new Date();
      fs.writeFileSync(STORAGE_FILE, JSON.stringify(storage, null, 2));
    } catch (error) {
      console.error('Failed to save cookie storage:', error);
    }
  }

  /**
   * Parse cookies from string format
   */
  private static parseCookiesFromString(cookiesStr: string, domain: string): StoredCookie[] {
    const cookies: StoredCookie[] = [];
    const lines = cookiesStr.split('\n').filter(line => line.trim());

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
      let cookieSameSite = 'lax';
      
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
            cookieSameSite = (parts[8]?.trim() || 'Lax').toLowerCase();
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
          sameSite: cookieSameSite,
          importedAt: new Date()
        });
      }
    }

    return cookies;
  }

  /**
   * Import cookies from structured objects with merge/replace option
   */
  public static importCookiesStructured(domain: string, cookieObjects: any[], description?: string, replaceAll: boolean = true): {
    success: boolean;
    injectedCount: number;
    skippedCount: number;
    errors: string[];
  } {
    try {
      console.log('🍪 [STORAGE] Importing structured cookies for', domain, ':', cookieObjects.length, 'cookies');
      
      const storage = this.loadStorage();
      const cookies: StoredCookie[] = [];
      
      for (const cookie of cookieObjects) {
        console.log('🍪 [STORAGE] Processing cookie:', {
          name: cookie.name,
          domain: cookie.domain,
          path: cookie.path,
          secure: cookie.secure,
          httpOnly: cookie.httpOnly,
          sameSite: cookie.sameSite
        });
        
        cookies.push({
          name: cookie.name,
          value: cookie.value,
          domain: cookie.domain || domain,
          path: cookie.path || '/',
          secure: cookie.secure || false,
          httpOnly: cookie.httpOnly || false,
          sameSite: cookie.sameSite || 'lax',
          expirationDate: cookie.expirationDate,
          importedAt: new Date()
        });
      }
      
      if (cookies.length === 0) {
        return {
          success: false,
          injectedCount: 0,
          skippedCount: 0,
          errors: ['No valid cookies found in structured format']
        };
      }

      // Handle merge vs replace logic for structured cookies
      if (replaceAll || !storage.domains[domain]) {
        // Replace all cookies or create new domain
        storage.domains[domain] = {
          domain,
          cookies,
          lastImport: new Date(),
          description: description || `Cookies for ${domain}`
        };
      } else {
        // Merge/add cookies to existing domain
        const existingDomain = storage.domains[domain];
        const mergedCookies = [...existingDomain.cookies];
        
        // Add or update each new cookie
        for (const newCookie of cookies) {
          const existingIndex = mergedCookies.findIndex(c => c.name === newCookie.name);
          if (existingIndex >= 0) {
            // Update existing cookie
            mergedCookies[existingIndex] = newCookie;
          } else {
            // Add new cookie
            mergedCookies.push(newCookie);
          }
        }
        
        storage.domains[domain] = {
          ...existingDomain,
          cookies: mergedCookies,
          lastImport: new Date()
        };
      }

      this.saveStorage(storage);

      console.log(`📦 [STORAGE] Stored ${cookies.length} structured cookies for ${domain}`);

      return {
        success: true,
        injectedCount: cookies.length,
        skippedCount: 0,
        errors: []
      };

    } catch (error) {
      console.error('Error importing structured cookies:', error);
      return {
        success: false,
        injectedCount: 0,
        skippedCount: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }

  /**
   * Import cookies for a domain with merge/replace option (legacy string format)
   */
  public static importCookies(domain: string, cookiesStr: string, description?: string, replaceAll: boolean = true): {
    success: boolean;
    injectedCount: number;
    skippedCount: number;
    errors: string[];
  } {
    try {
      const storage = this.loadStorage();
      const cookies = this.parseCookiesFromString(cookiesStr, domain);
      
      if (cookies.length === 0) {
        return {
          success: false,
          injectedCount: 0,
          skippedCount: 0,
          errors: ['No valid cookies found']
        };
      }

      // Handle merge vs replace logic
      if (replaceAll || !storage.domains[domain]) {
        // Replace all cookies or create new domain
        storage.domains[domain] = {
          domain,
          cookies,
          lastImport: new Date(),
          description: description || `Cookies for ${domain}`
        };
      } else {
        // Merge/add cookies to existing domain
        const existingDomain = storage.domains[domain];
        const mergedCookies = [...existingDomain.cookies];
        
        // Add or update each new cookie
        for (const newCookie of cookies) {
          const existingIndex = mergedCookies.findIndex(c => c.name === newCookie.name);
          if (existingIndex >= 0) {
            // Update existing cookie
            mergedCookies[existingIndex] = newCookie;
          } else {
            // Add new cookie
            mergedCookies.push(newCookie);
          }
        }
        
        storage.domains[domain] = {
          ...existingDomain,
          cookies: mergedCookies,
          lastImport: new Date()
        };
      }

      this.saveStorage(storage);

      console.log(`📦 Stored ${cookies.length} cookies for ${domain}`);

      return {
        success: true,
        injectedCount: cookies.length,
        skippedCount: 0,
        errors: []
      };

    } catch (error) {
      console.error('Error importing cookies:', error);
      return {
        success: false,
        injectedCount: 0,
        skippedCount: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }

  /**
   * Get all stored domains and their statistics
   */
  public static getStatistics(): {
    domains: number;
    totalCookies: number;
    domainDetails: Array<{
      domain: string;
      cookieCount: number;
      lastImport: Date | null;
      description: string;
    }>;
  } {
    const storage = this.loadStorage();
    
    const domainDetails = Object.values(storage.domains).map(domainData => ({
      domain: domainData.domain,
      cookieCount: domainData.cookies.length,
      lastImport: domainData.lastImport,
      description: domainData.description
    }));

    return {
      domains: Object.keys(storage.domains).length,
      totalCookies: domainDetails.reduce((sum, d) => sum + d.cookieCount, 0),
      domainDetails
    };
  }

  /**
   * Get cookies for a specific domain
   */
  public static getCookiesForDomain(domain: string): StoredCookie[] {
    const storage = this.loadStorage();
    return storage.domains[domain]?.cookies || [];
  }

  /**
   * Clear cookies for a domain
   */
  public static clearCookiesForDomain(domain: string): boolean {
    try {
      const storage = this.loadStorage();
      
      if (storage.domains[domain]) {
        delete storage.domains[domain];
        this.saveStorage(storage);
        console.log(`🗑️ Cleared cookies for ${domain}`);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error clearing cookies:', error);
      return false;
    }
  }

  /**
   * Add or update a single cookie to a domain
   */
  public static addOrUpdateCookie(domain: string, cookieData: {
    name: string;
    value: string;
    domain?: string;
    path?: string;
    secure?: boolean;
    httpOnly?: boolean;
    sameSite?: string;
    expirationDate?: number;
  }): {
    success: boolean;
    message: string;
  } {
    try {
      const storage = this.loadStorage();
      
      // Ensure domain exists
      if (!storage.domains[domain]) {
        storage.domains[domain] = {
          domain,
          cookies: [],
          lastImport: new Date(),
          description: `Cookies for ${domain}`
        };
      }

      const newCookie: StoredCookie = {
        name: cookieData.name,
        value: cookieData.value,
        domain: cookieData.domain || domain,
        path: cookieData.path || '/',
        secure: cookieData.secure || false,
        httpOnly: cookieData.httpOnly || false,
        sameSite: cookieData.sameSite || 'lax',
        expirationDate: cookieData.expirationDate,
        importedAt: new Date()
      };

      // Check if cookie already exists (by name)
      const existingIndex = storage.domains[domain].cookies.findIndex(
        cookie => cookie.name === cookieData.name
      );

      if (existingIndex >= 0) {
        // Update existing cookie
        storage.domains[domain].cookies[existingIndex] = newCookie;
      } else {
        // Add new cookie
        storage.domains[domain].cookies.push(newCookie);
      }

      // Update last import time
      storage.domains[domain].lastImport = new Date();

      this.saveStorage(storage);

      console.log(`🍪 Added/Updated cookie ${cookieData.name} for ${domain}`);

      return {
        success: true,
        message: existingIndex >= 0 ? 'Cookie updated' : 'Cookie added'
      };

    } catch (error) {
      console.error('Error adding/updating cookie:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Remove a specific cookie by name
   */
  public static removeCookie(domain: string, cookieName: string): {
    success: boolean;
    message: string;
  } {
    try {
      const storage = this.loadStorage();
      
      if (!storage.domains[domain]) {
        return {
          success: false,
          message: 'Domain not found'
        };
      }

      const initialCount = storage.domains[domain].cookies.length;
      storage.domains[domain].cookies = storage.domains[domain].cookies.filter(
        cookie => cookie.name !== cookieName
      );

      const removed = initialCount > storage.domains[domain].cookies.length;
      
      if (removed) {
        this.saveStorage(storage);
        console.log(`🗑️ Removed cookie ${cookieName} from ${domain}`);
      }

      return {
        success: removed,
        message: removed ? 'Cookie removed' : 'Cookie not found'
      };

    } catch (error) {
      console.error('Error removing cookie:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Validate if domain has cookies
   */
  public static validateDomain(domain: string): {
    isValid: boolean;
    cookieCount: number;
    activeCount: number;
  } {
    const cookies = this.getCookiesForDomain(domain);
    
    return {
      isValid: cookies.length > 0,
      cookieCount: cookies.length,
      activeCount: cookies.length // All stored cookies are considered active
    };
  }
}
