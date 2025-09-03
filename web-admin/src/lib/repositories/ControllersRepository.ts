import { Controller } from '@/types/multi-site-types';
import { BaseRepository } from './BaseRepository';

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
    const controllers = await this.getAll();
    return {
      total: controllers.length,
      online: controllers.filter(c => c.status === 'online').length,
      offline: controllers.filter(c => c.status === 'offline').length,
      error: controllers.filter(c => c.status === 'error').length,
    };
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