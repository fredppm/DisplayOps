import { Dashboard } from '@/types/shared-types';

export class DashboardService {
  private static instance: DashboardService;
  private dashboards: Dashboard[] = [];
  private loading = false;
  private error: string | null = null;
  private lastFetch: Date | null = null;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  static getInstance(): DashboardService {
    if (!DashboardService.instance) {
      DashboardService.instance = new DashboardService();
    }
    return DashboardService.instance;
  }

  async fetchDashboards(force = false): Promise<Dashboard[]> {
    // Check cache validity
    if (!force && this.lastFetch && 
        (Date.now() - this.lastFetch.getTime()) < this.CACHE_DURATION &&
        this.dashboards.length > 0) {
      return this.dashboards;
    }

    if (this.loading) {
      // If already loading, wait for it to complete
      return new Promise((resolve, reject) => {
        const checkLoading = () => {
          if (!this.loading) {
            if (this.error) {
              reject(new Error(this.error));
            } else {
              resolve(this.dashboards);
            }
          } else {
            setTimeout(checkLoading, 100);
          }
        };
        checkLoading();
      });
    }

    this.loading = true;
    this.error = null;

    try {
      const response = await fetch('/api/dashboards');
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'API returned unsuccessful result');
      }
      
      if (!Array.isArray(result.data)) {
        throw new Error('API returned invalid data format');
      }
      
      this.dashboards = result.data;
      this.lastFetch = new Date();
      return this.dashboards;
      
    } catch (error: any) {
      this.error = error.message || 'Failed to fetch dashboards';
      this.dashboards = []; // No fallback - empty array
      console.error('Error fetching dashboards from API:', error);
      throw error;
    } finally {
      this.loading = false;
    }
  }


  getDashboards(): Dashboard[] {
    return this.dashboards;
  }

  getDashboardById(id: string): Dashboard | undefined {
    return this.dashboards.find(d => d.id === id);
  }

  isLoading(): boolean {
    return this.loading;
  }

  getError(): string | null {
    return this.error;
  }

  // Method to invalidate cache and force refresh
  invalidateCache(): void {
    this.lastFetch = null;
    this.dashboards = [];
  }
}

export const dashboardService = DashboardService.getInstance();