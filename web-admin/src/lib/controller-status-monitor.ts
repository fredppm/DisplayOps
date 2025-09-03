import fs from 'fs/promises';
import path from 'path';
import { Controller } from '@/types/multi-site-types';
import { logger } from '@/utils/logger';

interface ControllerMonitorConfig {
  checkInterval: number; // milliseconds
  offlineThreshold: number; // milliseconds
}

export class ControllerStatusMonitor {
  private static instance: ControllerStatusMonitor;
  private config: ControllerMonitorConfig;
  private monitorInterval: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;

  private constructor() {
    this.config = {
      checkInterval: parseInt(process.env.CONTROLLER_STATUS_CHECK_INTERVAL || '60000'), // 1 minute
      offlineThreshold: parseInt(process.env.CONTROLLER_OFFLINE_THRESHOLD || '120000') // 2 minutes
    };
  }

  public static getInstance(): ControllerStatusMonitor {
    if (!ControllerStatusMonitor.instance) {
      ControllerStatusMonitor.instance = new ControllerStatusMonitor();
    }
    return ControllerStatusMonitor.instance;
  }

  public start(): void {
    if (this.isRunning) {
      logger.info('Controller status monitor already running');
      return;
    }

    logger.info('Starting controller status monitor', {
      checkInterval: this.config.checkInterval,
      offlineThreshold: this.config.offlineThreshold
    });

    this.monitorInterval = setInterval(() => {
      this.checkControllerStatuses().catch(error => {
        logger.error('Error during controller status check:', error);
      });
    }, this.config.checkInterval);

    this.isRunning = true;

    // Run initial check
    this.checkControllerStatuses().catch(error => {
      logger.error('Error during initial controller status check:', error);
    });
  }

  public stop(): void {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }
    this.isRunning = false;
    logger.info('Controller status monitor stopped');
  }

  private async checkControllerStatuses(): Promise<void> {
    const CONTROLLERS_FILE = path.join(process.cwd(), 'data', 'controllers.json');
    
    try {
      const controllersData = await this.readControllersData(CONTROLLERS_FILE);
      let hasChanges = false;
      const now = new Date();

      for (const controller of controllersData.controllers) {
        const lastSync = new Date(controller.lastSync);
        const timeSinceLastSync = now.getTime() - lastSync.getTime();

        // Check if controller should be marked as offline
        if (controller.status === 'online' && timeSinceLastSync > this.config.offlineThreshold) {
          logger.warn('Marking controller as offline due to no recent heartbeat', {
            controllerId: controller.id,
            name: controller.name,
            lastSync: controller.lastSync,
            timeSinceLastSync: Math.round(timeSinceLastSync / 1000) + 's'
          });

          controller.status = 'offline';
          hasChanges = true;
        }
        // Check if controller should be marked as online (if it was offline but has recent sync)
        else if (controller.status === 'offline' && timeSinceLastSync <= this.config.offlineThreshold) {
          logger.info('Marking controller as online due to recent heartbeat', {
            controllerId: controller.id,
            name: controller.name,
            lastSync: controller.lastSync
          });

          controller.status = 'online';
          hasChanges = true;
        }
      }

      // Save changes if any
      if (hasChanges) {
        await this.writeControllersData(CONTROLLERS_FILE, controllersData);
        logger.debug('Controller statuses updated');
      }

    } catch (error) {
      logger.error('Failed to check controller statuses:', error);
    }
  }

  private async readControllersData(filePath: string): Promise<{ controllers: Controller[] }> {
    try {
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      // If file doesn't exist, return empty structure
      if ((error as any).code === 'ENOENT') {
        return { controllers: [] };
      }
      throw error;
    }
  }

  private async writeControllersData(filePath: string, data: { controllers: Controller[] }): Promise<void> {
    // Ensure directory exists
    const dir = path.dirname(filePath);
    try {
      await fs.access(dir);
    } catch {
      await fs.mkdir(dir, { recursive: true });
    }
    
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
  }

  public getConfig(): ControllerMonitorConfig {
    return { ...this.config };
  }

  public isMonitoring(): boolean {
    return this.isRunning;
  }

  public async getControllerStatistics(): Promise<{
    total: number;
    online: number;
    offline: number;
    controllers: Array<{
      id: string;
      name: string;
      status: string;
      lastSync: string;
      timeSinceLastSync: number;
    }>;
  }> {
    const CONTROLLERS_FILE = path.join(process.cwd(), 'data', 'controllers.json');
    
    try {
      const controllersData = await this.readControllersData(CONTROLLERS_FILE);
      const now = new Date();
      
      const controllers = controllersData.controllers.map(controller => ({
        id: controller.id,
        name: controller.name,
        status: controller.status,
        lastSync: controller.lastSync,
        timeSinceLastSync: now.getTime() - new Date(controller.lastSync).getTime()
      }));

      return {
        total: controllers.length,
        online: controllers.filter(c => c.status === 'online').length,
        offline: controllers.filter(c => c.status === 'offline').length,
        controllers
      };
    } catch (error) {
      logger.error('Failed to get controller statistics:', error);
      return {
        total: 0,
        online: 0,
        offline: 0,
        controllers: []
      };
    }
  }

  // Force a status check (useful for debugging)
  public async forceCheck(): Promise<void> {
    logger.info('Forcing controller status check');
    await this.checkControllerStatuses();
  }
}

export const controllerStatusMonitor = ControllerStatusMonitor.getInstance();