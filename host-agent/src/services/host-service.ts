import { ConfigManager } from '../managers/config-manager';
import { HealthCheckResponse, HostStatus, TVStatus, ApiResponse } from '../../../shared/types';
import os from 'os';

export class HostService {
  private configManager: ConfigManager;
  private hostStatus: HostStatus;
  private tvStatuses: Map<string, TVStatus>;
  private healthCheckInterval: NodeJS.Timeout | null = null;

  constructor(configManager: ConfigManager) {
    this.configManager = configManager;
    this.hostStatus = this.initializeHostStatus();
    this.tvStatuses = new Map();
    
    this.initializeTVStatuses();
    this.startHealthChecks();
  }

  private initializeHostStatus(): HostStatus {
    return {
      online: true,
      cpuUsage: 0,
      memoryUsage: 0,
      browserProcesses: 0,
      lastError: undefined
    };
  }

  private initializeTVStatuses(): void {
    const displays = this.configManager.getDisplays();
    
    displays.forEach(display => {
      this.tvStatuses.set(display.id, {
        active: false,
        currentUrl: undefined,
        lastRefresh: new Date(),
        isResponsive: true,
        errorCount: 0,
        lastError: undefined
      });
    });
  }

  private startHealthChecks(): void {
    const interval = this.configManager.getSettings().healthCheckInterval;
    
    this.healthCheckInterval = setInterval(() => {
      this.updateHostStatus();
    }, interval);

    console.log(`Health checks started (interval: ${interval}ms)`);
  }

  private updateHostStatus(): void {
    try {
      // Update CPU usage (simplified)
      const cpuUsage = this.getCPUUsage();
      
      // Update memory usage
      const memInfo = process.memoryUsage();
      const totalMemory = os.totalmem();
      const memoryUsage = (memInfo.rss / totalMemory) * 100;

      // Count browser processes (simplified - in real implementation would check actual processes)
      const browserProcesses = this.countBrowserProcesses();

      this.hostStatus = {
        online: true,
        cpuUsage: Math.round(cpuUsage * 100) / 100,
        memoryUsage: Math.round(memoryUsage * 100) / 100,
        browserProcesses,
        lastError: this.hostStatus.lastError
      };

    } catch (error) {
      console.error('Error updating host status:', error);
      this.hostStatus.lastError = error instanceof Error ? error.message : 'Unknown error';
    }
  }

  private getCPUUsage(): number {
    // Simplified CPU usage calculation
    // In a real implementation, you'd use a proper CPU monitoring library
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;

    cpus.forEach(cpu => {
      for (const type in cpu.times) {
        totalTick += cpu.times[type as keyof typeof cpu.times];
      }
      totalIdle += cpu.times.idle;
    });

    const idle = totalIdle / cpus.length;
    const total = totalTick / cpus.length;
    
    return 100 - (100 * idle / total);
  }

  private countBrowserProcesses(): number {
    // Simplified browser process counting
    // In a real implementation, you'd check for actual Electron renderer processes
    return this.tvStatuses.size;
  }

  public getSystemStatus(): HealthCheckResponse {
    const systemInfo = this.configManager.getSystemInfo();
    
    return {
      hostStatus: this.hostStatus,
      tvStatuses: Array.from(this.tvStatuses.values()),
      systemInfo: {
        uptime: systemInfo.uptime,
        platform: systemInfo.platform,
        nodeVersion: systemInfo.nodeVersion,
        agentVersion: systemInfo.agentVersion
      }
    };
  }

  public updateTVStatus(tvId: string, updates: Partial<TVStatus>): void {
    const currentStatus = this.tvStatuses.get(tvId);
    if (currentStatus) {
      this.tvStatuses.set(tvId, {
        ...currentStatus,
        ...updates
      });
    }
  }

  public getTVStatus(tvId: string): TVStatus | undefined {
    return this.tvStatuses.get(tvId);
  }

  public getAllTVStatuses(): TVStatus[] {
    return Array.from(this.tvStatuses.values());
  }

  public reportError(error: string, tvId?: string): void {
    console.error('Host service error:', error);
    
    if (tvId) {
      const tvStatus = this.tvStatuses.get(tvId);
      if (tvStatus) {
        this.updateTVStatus(tvId, {
          errorCount: tvStatus.errorCount + 1,
          lastError: error,
          isResponsive: false
        });
      }
    } else {
      this.hostStatus.lastError = error;
    }
  }

  public clearError(tvId?: string): void {
    if (tvId) {
      const tvStatus = this.tvStatuses.get(tvId);
      if (tvStatus) {
        this.updateTVStatus(tvId, {
          lastError: undefined,
          errorCount: 0,
          isResponsive: true
        });
      }
    } else {
      this.hostStatus.lastError = undefined;
    }
  }

  public createApiResponse<T>(success: boolean, data?: T, error?: string): ApiResponse<T> {
    return {
      success,
      data,
      error,
      timestamp: new Date()
    };
  }

  public destroy(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }
}
