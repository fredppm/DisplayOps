import { Controller } from '@/types/multi-site-types';
import { BasePostgresRepository } from './BasePostgresRepository';
import { calculateControllersStatus, getControllerStatusStats } from '@/lib/controller-status';

export class ControllersRepository extends BasePostgresRepository<Controller> {
  protected getTableName(): string {
    return 'controllers';
  }

  protected mapDbRowToEntity(row: any): Controller {
    return {
      id: row.id,
      siteId: row.site_id || '',
      name: row.name,
      localNetwork: row.local_network || '',
      mdnsService: row.mdns_service || '',
      controllerUrl: row.controller_url || '',
      status: row.status,
      lastSync: row.last_sync?.toISOString() || '',
      version: row.version || ''
    };
  }

  protected mapEntityToDbRow(entity: Controller): any {
    return {
      id: entity.id,
      site_id: entity.siteId || null,
      name: entity.name,
      local_network: entity.localNetwork || null,
      mdns_service: entity.mdnsService || null,
      controller_url: entity.controllerUrl || null,
      status: entity.status,
      last_sync: entity.lastSync ? new Date(entity.lastSync) : null,
      version: entity.version || null
    };
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