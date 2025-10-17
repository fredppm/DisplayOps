import { BasePostgresRepository } from './BasePostgresRepository';

export interface Cookie {
  id: string;
  name: string;
  value: string;
  domain: string;
  path: string;
  secure: boolean;
  httpOnly: boolean;
  sameSite: string;
  expirationDate: number; // Unix timestamp, 0 = session cookie
  description?: string;
}

export interface CookieDomain {
  id: string;
  domain: string;
  description: string;
  cookies: Cookie[];
  createdAt: string;
  updatedAt: string;
}

export class CookiesRepository extends BasePostgresRepository<CookieDomain> {
  constructor() {
    super();
  }

  protected getTableName(): string {
    return 'cookie_domains';
  }

  protected mapDbRowToEntity(row: any): CookieDomain {
    let cookies: Cookie[] = [];
    
    try {
      // Handle different cookie formats from database
      if (row.cookies) {
        if (typeof row.cookies === 'string') {
          // Parse JSON string
          cookies = JSON.parse(row.cookies);
        } else if (Array.isArray(row.cookies)) {
          // Already parsed (JSONB from postgres)
          cookies = row.cookies;
        }
      }
    } catch (error) {
      console.warn(`Failed to parse cookies for domain ${row.domain}:`, error);
      cookies = [];
    }
    
    return {
      id: row.id,
      domain: row.domain,
      description: row.description || '',
      cookies: Array.isArray(cookies) ? cookies : [],
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  protected mapEntityToDbRow(entity: CookieDomain): any {
    return {
      id: entity.id,
      domain: entity.domain,
      description: entity.description,
      cookies: JSON.stringify(entity.cookies)
      // Note: created_at and updated_at are handled automatically by BasePostgresRepository
    };
  }

  // Cookie domain-specific methods
  async getByDomain(domain: string): Promise<CookieDomain | null> {
    const domains = await this.getAll();
    return domains.find(d => d.domain === domain) || null;
  }

  async createDomain(domain: string, description?: string): Promise<CookieDomain> {
    const existingDomain = await this.getByDomain(domain);
    if (existingDomain) {
      throw new Error(`Domain ${domain} already exists`);
    }

    const newDomain: CookieDomain = {
      id: this.generateId(),
      domain,
      description: description || `Cookies for ${domain}`,
      cookies: [],
      createdAt: '', // Will be set by BasePostgresRepository
      updatedAt: ''  // Will be set by BasePostgresRepository
    };

    return this.create(newDomain);
  }

  async addCookieToDomain(domainName: string, cookie: Omit<Cookie, 'id'>): Promise<Cookie> {
    let domain = await this.getByDomain(domainName);
    
    if (!domain) {
      domain = await this.createDomain(domainName);
    }

    // Check for duplicate cookie names in the same domain
    const existingCookieIndex = domain.cookies.findIndex(c => c.name === cookie.name);
    
    const newCookie: Cookie = {
      id: this.generateCookieId(),
      ...cookie,
      description: cookie.description || `Cookie ${cookie.name} for ${domainName}`
    };

    if (existingCookieIndex >= 0) {
      // Update existing cookie
      domain.cookies[existingCookieIndex] = newCookie;
    } else {
      // Add new cookie
      domain.cookies.push(newCookie);
    }

    // updated_at is handled automatically by BasePostgresRepository
    await this.update(domain.id, domain);
    
    return newCookie;
  }

  async removeCookieFromDomain(domainName: string, cookieName: string): Promise<boolean> {
    const domain = await this.getByDomain(domainName);
    if (!domain) return false;

    const initialLength = domain.cookies.length;
    domain.cookies = domain.cookies.filter(c => c.name !== cookieName);
    
    if (domain.cookies.length === initialLength) return false;

    domain.updatedAt = new Date().toISOString();
    
    // If no more cookies, remove domain
    if (domain.cookies.length === 0) {
      await this.delete(domain.id);
    } else {
      await this.update(domain.id, domain);
    }
    
    return true;
  }

  async updateDomainCookies(domainName: string, cookies: Omit<Cookie, 'id'>[]): Promise<CookieDomain | null> {
    const domain = await this.getByDomain(domainName);
    if (!domain) return null;

    domain.cookies = cookies.map(c => ({
      id: this.generateCookieId(),
      ...c,
      description: c.description || `Cookie ${c.name} for ${domainName}`
    }));
    
    // updated_at is handled automatically by BasePostgresRepository
    return this.update(domain.id, domain);
  }

  async getCookiesByDomain(domainName: string): Promise<Cookie[]> {
    const domain = await this.getByDomain(domainName);
    return domain?.cookies || [];
  }

  generateId(): string {
    // Generate a UUID v4
    return crypto.randomUUID();
  }

  generateCookieId(): string {
    // Generate a UUID v4 for cookie ID
    return crypto.randomUUID();
  }

  // Convert to the format expected by the existing API
  async getAllAsApiFormat(): Promise<{
    domains: { [domain: string]: Omit<CookieDomain, 'id'> };
    lastUpdated: string;
  }> {
    const domains = await this.getAll();
    const domainsMap: { [domain: string]: Omit<CookieDomain, 'id'> } = {};
    
    domains.forEach(domain => {
      domainsMap[domain.domain] = {
        domain: domain.domain,
        description: domain.description,
        cookies: domain.cookies,
        createdAt: domain.createdAt,
        updatedAt: domain.updatedAt
      };
    });

    return {
      domains: domainsMap,
      lastUpdated: new Date().toISOString()
    };
  }
}

// Singleton instance
export const cookiesRepository = new CookiesRepository();