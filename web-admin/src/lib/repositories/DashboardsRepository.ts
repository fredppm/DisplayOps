import { Dashboard } from '@/types/shared-types';
import { BaseRepository } from './BaseRepository';

export class DashboardsRepository extends BaseRepository<Dashboard> {
  constructor() {
    super('dashboards.json');
  }

  protected getDefaultData() {
    return { 
      dashboards: [
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
      ]
    };
  }

  protected getCollectionKey(): string {
    return 'dashboards';
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