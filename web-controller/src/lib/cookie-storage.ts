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

      // Parse tab-separated format (DevTools copy)
      if (trimmed.includes('\t')) {
        const parts = trimmed.split('\t');
        if (parts.length >= 2) {
          name = parts[0]?.trim() || '';
          value = parts[1]?.trim() || '';
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
          domain: domain,
          path: '/',
          secure: domain.startsWith('https'),
          httpOnly: false,
          sameSite: 'lax',
          importedAt: new Date()
        });
      }
    }

    return cookies;
  }

  /**
   * Import cookies for a domain
   */
  public static importCookies(domain: string, cookiesStr: string, description?: string): {
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

      // Store domain cookies
      storage.domains[domain] = {
        domain,
        cookies,
        lastImport: new Date(),
        description: description || `Cookies for ${domain}`
      };

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
