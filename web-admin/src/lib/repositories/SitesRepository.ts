import { Site } from '@/types/multi-site-types';
import { BasePostgresRepository } from './BasePostgresRepository';

export class SitesRepository extends BasePostgresRepository<Site> {
  protected getTableName(): string {
    return 'sites';
  }

  protected mapDbRowToEntity(row: any): Site {
    return {
      id: row.id,
      name: row.name,
      location: row.location || '',
      timezone: row.timezone,
      status: row.status,
      controllers: row.controllers || [],
      createdAt: row.created_at?.toISOString() || '',
      updatedAt: row.updated_at?.toISOString() || ''
    };
  }

  protected mapEntityToDbRow(entity: Site): any {
    return {
      id: entity.id,
      name: entity.name,
      location: entity.location || null,
      timezone: entity.timezone,
      status: entity.status,
      controllers: entity.controllers || []
    };
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