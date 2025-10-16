import { Dashboard } from '@/types/shared-types';
import { BasePostgresRepository } from './BasePostgresRepository';
import { db } from '@/lib/database';

export class DashboardsRepository extends BasePostgresRepository<Dashboard> {
  constructor() {
    super();
    // Start initialization (will be awaited by all operations)
    this.initializationPromise = this.initialize();
  }

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

  /**
   * Initialize default dashboards if none exist
   */
  protected async initialize(): Promise<void> {
    try {
      // Call parent getAll without ensureInitialized to avoid circular dependency
      const result = await db.query(`SELECT * FROM ${this.getTableName()} ORDER BY created_at DESC`);
      const existing = result.rows.map((row: any) => this.mapDbRowToEntity(row));
      if (existing.length === 0) {
        const defaultDashboards: Dashboard[] = [
          {
            id: 'common-dashboard',
            name: 'Grafana VTEX',
            url: 'https://grafana.vtex.com/d/d7e7051f-42a2-4798-af93-cf2023dd2e28/home?orgId=1&from=now-3h&to=now&timezone=browser&var-Origin=argocd&refresh=10s',
            description: 'Common dashboard for all systems',
            refreshInterval: 300,
            requiresAuth: true,
            category: 'Monitoring'
          },
          {
            id: 'health-monitor',
            name: 'Health Monitor',
            url: 'https://healthmonitor.vtex.com/',
            description: 'Health monitor for all systems',
            refreshInterval: 600,
            requiresAuth: true,
            category: 'Business Intelligence'
          }
        ];
        
        for (const dashboard of defaultDashboards) {
          await this.create(dashboard);
        }
      }
    } catch (error) {
      console.error('Error initializing default dashboards:', error);
    }
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