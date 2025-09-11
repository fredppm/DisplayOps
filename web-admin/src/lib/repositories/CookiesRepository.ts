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
  lastUpdated: string;
}

export class CookiesRepository extends BasePostgresRepository<CookieDomain> {
  constructor() {
    super();
  }

  protected getTableName(): string {
    return 'cookie_domains';
  }

  protected mapDbRowToEntity(row: any): CookieDomain {
    return {
      id: row.id,
      domain: row.domain,
      description: row.description,
      cookies: row.cookies ? JSON.parse(row.cookies) : [],
      lastUpdated: row.last_updated
    };
  }

  protected mapEntityToDbRow(entity: CookieDomain): any {
    return {
      id: entity.id,
      domain: entity.domain,
      description: entity.description,
      cookies: JSON.stringify(entity.cookies),
      last_updated: entity.lastUpdated
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
      lastUpdated: new Date().toISOString()
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

    domain.lastUpdated = new Date().toISOString();
    await this.update(domain.id, domain);
    
    return newCookie;
  }

  async removeCookieFromDomain(domainName: string, cookieName: string): Promise<boolean> {
    const domain = await this.getByDomain(domainName);
    if (!domain) return false;

    const initialLength = domain.cookies.length;
    domain.cookies = domain.cookies.filter(c => c.name !== cookieName);
    
    if (domain.cookies.length === initialLength) return false;

    domain.lastUpdated = new Date().toISOString();
    
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
    
    domain.lastUpdated = new Date().toISOString();
    return this.update(domain.id, domain);
  }

  async getCookiesByDomain(domainName: string): Promise<Cookie[]> {
    const domain = await this.getByDomain(domainName);
    return domain?.cookies || [];
  }

  generateId(): string {
    return `domain-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  generateCookieId(): string {
    return `cookie-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
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
        lastUpdated: domain.lastUpdated
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