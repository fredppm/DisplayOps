import { Dashboard } from '@/types/shared-types';
import { BasePostgresRepository } from './BasePostgresRepository';

export class DashboardsRepository extends BasePostgresRepository<Dashboard> {
  protected getTableName(): string {
    return 'dashboards';
  }

  protected mapDbRowToEntity(row: any): Dashboard {
    return {
      id: row.id,
      name: row.name,
      url: row.url,
      description: row.description,
      refreshInterval: row.refresh_interval,
      requiresAuth: row.requires_auth,
      category: row.category
    };
  }

  protected mapEntityToDbRow(entity: Dashboard): any {
    return {
      id: entity.id,
      name: entity.name,
      url: entity.url,
      description: entity.description,
      refresh_interval: entity.refreshInterval,
      requires_auth: entity.requiresAuth,
      category: entity.category
    };
  }

  // Dashboard-specific methods
  async getByName(name: string): Promise<Dashboard | null> {
    const dashboards = await this.getAll();
    return dashboards.find(dashboard => 
      dashboard.name.toLowerCase() === name.toLowerCase()
    ) || null;
  }

  async getByCategory(category: string): Promise<Dashboard[]> {
    const dashboards = await this.getAll();
    return dashboards.filter(dashboard => dashboard.category === category);
  }

  async getByUrl(url: string): Promise<Dashboard | null> {
    const dashboards = await this.getAll();
    return dashboards.find(dashboard => dashboard.url === url) || null;
  }

  generateId(): string {
    return `dashboard-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  async createWithId(dashboard: Omit<Dashboard, 'id'>): Promise<Dashboard> {
    const newDashboard: Dashboard = {
      id: this.generateId(),
      ...dashboard
    };
    return this.create(newDashboard);
  }
}

// Singleton instance
export const dashboardsRepository = new DashboardsRepository();