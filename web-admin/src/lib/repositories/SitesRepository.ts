import { Site } from '@/types/multi-site-types';
import { BaseRepository } from './BaseRepository';

export class SitesRepository extends BaseRepository<Site> {
  constructor() {
    super('sites.json');
  }

  protected getDefaultData() {
    return { sites: [] };
  }

  protected getCollectionKey(): string {
    return 'sites';
  }

  // Site-specific methods
  async findByName(name: string): Promise<Site | null> {
    const sites = await this.getAll();
    return sites.find(site => site.name.toLowerCase() === name.toLowerCase()) || null;
  }

  async getBySiteIds(siteIds: string[]): Promise<Site[]> {
    const sites = await this.getAll();
    return sites.filter(site => siteIds.includes(site.id));
  }

  async getSitesByStatus(status: 'online' | 'offline' | 'error'): Promise<Site[]> {
    const sites = await this.getAll();
    return sites.filter(site => site.status === status);
  }

  async getStatsCount(): Promise<{
    total: number;
    online: number;
    offline: number;
    error: number;
  }> {
    const sites = await this.getAll();
    return {
      total: sites.length,
      online: sites.filter(s => s.status === 'online').length,
      offline: sites.filter(s => s.status === 'offline').length,
      error: sites.filter(s => s.status === 'error').length,
    };
  }
}

// Singleton instance
export const sitesRepository = new SitesRepository();