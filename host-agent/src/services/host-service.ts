import { ConfigManager } from '../managers/config-manager';
import { HealthCheckResponse, HostStatus, DisplayStatus, ApiResponse } from '../../../shared/types';
import os from 'os';

export class HostService {
  private configManager: ConfigManager;
  private hostStatus: HostStatus;
  private displayStatuses: Map<string, DisplayStatus>;
  private healthCheckInterval: NodeJS.Timeout | null = null;

  constructor(configManager: ConfigManager) {
    this.configManager = configManager;
    this.hostStatus = this.initializeHostStatus();
    this.displayStatuses = new Map();
    
    this.initializeDisplayStatuses();
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

  private initializeDisplayStatuses(): void {
    const displays = this.configManager.getDisplays();
    
    displays.forEach(display => {
      this.displayStatuses.set(display.id, {
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
    return this.displayStatuses.size;
  }

  public getSystemStatus(): HealthCheckResponse {
    const systemInfo = this.configManager.getSystemInfo();
    
    return {
      hostStatus: this.hostStatus,
      tvStatuses: [], // Empty array for now, can be populated later
      displayStatuses: Array.from(this.displayStatuses.values()),
      systemInfo: {
        uptime: systemInfo.uptime,
        platform: systemInfo.platform,
        nodeVersion: systemInfo.nodeVersion,
        agentVersion: systemInfo.agentVersion
      }
    };
  }

  public updateDisplayStatus(displayId: string, updates: Partial<DisplayStatus>): void {
    const currentStatus = this.displayStatuses.get(displayId);
    if (currentStatus) {
      this.displayStatuses.set(displayId, {
        ...currentStatus,
        ...updates
      });
    }
  }

  public getDisplayStatus(displayId: string): DisplayStatus | undefined {
    return this.displayStatuses.get(displayId);
  }

  public getAllDisplayStatuses(): DisplayStatus[] {
    return Array.from(this.displayStatuses.values());
  }

  public refreshDisplayStatuses(): void {
    // Clear existing display statuses
    this.displayStatuses.clear();
    
    // Reinitialize with current configuration
    this.initializeDisplayStatuses();
    
    console.log(`🔄 Refreshed display statuses: ${this.displayStatuses.size} displays`);
  }

  public forceRefreshFromSystem(): void {
    console.log('🔄 Force refreshing displays from system...');
    
    // Clear existing display statuses
    this.displayStatuses.clear();
    
    // Get fresh display configuration from system
    const displays = this.configManager.getDisplays();
    
    // Create new display statuses
    displays.forEach(display => {
      this.displayStatuses.set(display.id, {
        active: false,
        currentUrl: undefined,
        lastRefresh: new Date(),
        isResponsive: true,
        errorCount: 0,
        lastError: undefined
      });
    });
    
    console.log(`🔄 Force refreshed display statuses: ${this.displayStatuses.size} displays`);
  }

  public reportError(error: string, displayId?: string): void {
    console.error('Host service error:', error);
    
    if (displayId) {
      const displayStatus = this.displayStatuses.get(displayId);
      if (displayStatus) {
        this.updateDisplayStatus(displayId, {
          errorCount: displayStatus.errorCount + 1,
          lastError: error,
          isResponsive: false
        });
      }
    } else {
      this.hostStatus.lastError = error;
    }
  }

  public clearError(displayId?: string): void {
    if (displayId) {
      const displayStatus = this.displayStatuses.get(displayId);
      if (displayStatus) {
        this.updateDisplayStatus(displayId, {
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
