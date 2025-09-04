import { Controller } from '@/types/multi-site-types';
import { BaseRepository } from './BaseRepository';
import { calculateControllersStatus, getControllerStatusStats } from '@/lib/controller-status';

export class ControllersRepository extends BaseRepository<Controller> {
  constructor() {
    super('controllers.json');
  }

  protected getDefaultData() {
    return { controllers: [] };
  }

  protected getCollectionKey(): string {
    return 'controllers';
  }

  // Override getAll to include real-time status calculation
  async getAll(): Promise<Controller[]> {
    const controllers = await super.getAll();
    return calculateControllersStatus(controllers);
  }

  // Controller-specific methods
  async getBySiteId(siteId: string): Promise<Controller[]> {
    const controllers = await this.getAll();
    return controllers.filter(controller => controller.siteId === siteId);
  }

  async getByStatus(status: 'online' | 'offline' | 'error'): Promise<Controller[]> {
    const controllers = await this.getAll();
    return controllers.filter(controller => controller.status === status);
  }

  async updateLastSync(id: string): Promise<Controller | null> {
    return this.update(id, { 
      lastSync: new Date().toISOString() 
    } as Partial<Controller>);
  }

  async getStatsCount(): Promise<{
    total: number;
    online: number;
    offline: number;
    error: number;
  }> {
    const controllers = await super.getAll(); // Get raw data to avoid double calculation
    return getControllerStatusStats(controllers);
  }

  async findByName(name: string): Promise<Controller | null> {
    const controllers = await this.getAll();
    return controllers.find(controller => 
      controller.name.toLowerCase() === name.toLowerCase()
    ) || null;
  }
}

// Singleton instance
export const controllersRepository = new ControllersRepository();