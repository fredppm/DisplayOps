import { EventEmitter } from 'events';

export interface RefreshConfig {
  windowId: string;
  interval: number; // in milliseconds
  url: string;
  lastRefresh: Date;
}

export interface RefreshEvent {
  windowId: string;
  url: string;
  timestamp: Date;
  success: boolean;
  error?: string;
}

export class RefreshManager extends EventEmitter {
  private refreshTimers: Map<string, NodeJS.Timeout> = new Map();
  private refreshConfigs: Map<string, RefreshConfig> = new Map();
  private readonly MIN_REFRESH_INTERVAL = 30000; // 30 seconds minimum
  private readonly MAX_REFRESH_INTERVAL = 3600000; // 1 hour maximum

  constructor() {
    super();
  }

  /**
   * Adds a window for automatic refresh management
   */
  public addWindow(windowId: string, url: string, refreshInterval?: number): void {
    console.log(`Adding window ${windowId} for refresh management`);

    // Remove existing timer if any
    this.removeWindow(windowId);

    // Use default interval if none specified or if invalid
    const interval = this.validateRefreshInterval(refreshInterval || 300000); // default 5 minutes

    const config: RefreshConfig = {
      windowId,
      interval,
      url,
      lastRefresh: new Date()
    };

    this.refreshConfigs.set(windowId, config);
    this.startRefreshTimer(windowId);
  }

  /**
   * Removes a window from refresh management
   */
  public removeWindow(windowId: string): void {
    console.log(`Removing window ${windowId} from refresh management`);

    // Clear existing timer
    const existingTimer = this.refreshTimers.get(windowId);
    if (existingTimer) {
      clearInterval(existingTimer);
      this.refreshTimers.delete(windowId);
    }

    // Remove config
    this.refreshConfigs.delete(windowId);
  }

  /**
   * Updates the refresh interval for a window
   */
  public updateRefreshInterval(windowId: string, newInterval: number): void {
    const config = this.refreshConfigs.get(windowId);
    if (!config) {
      console.warn(`Cannot update refresh interval: window ${windowId} not found`);
      return;
    }

    const validInterval = this.validateRefreshInterval(newInterval);
    
    console.log(`Updating refresh interval for window ${windowId}: ${validInterval}ms`);
    
    config.interval = validInterval;
    this.refreshConfigs.set(windowId, config);
    
    // Restart timer with new interval
    this.removeWindow(windowId);
    this.addWindow(windowId, config.url, validInterval);
  }

  /**
   * Updates the URL for a window
   */
  public updateURL(windowId: string, newUrl: string): void {
    const config = this.refreshConfigs.get(windowId);
    if (!config) {
      console.warn(`Cannot update URL: window ${windowId} not found`);
      return;
    }

    console.log(`Updating URL for window ${windowId}: ${newUrl}`);
    config.url = newUrl;
    this.refreshConfigs.set(windowId, config);
  }

  /**
   * Manually triggers a refresh for a window
   */
  public triggerRefresh(windowId: string): void {
    const config = this.refreshConfigs.get(windowId);
    if (!config) {
      console.warn(`Cannot trigger refresh: window ${windowId} not found`);
      return;
    }

    console.log(`Manually triggering refresh for window ${windowId}`);
    this.performRefresh(windowId, config);
  }

  /**
   * Gets the current refresh configuration for a window
   */
  public getRefreshConfig(windowId: string): RefreshConfig | undefined {
    return this.refreshConfigs.get(windowId);
  }

  /**
   * Gets all refresh configurations
   */
  public getAllConfigs(): RefreshConfig[] {
    return Array.from(this.refreshConfigs.values());
  }

  /**
   * Pauses refresh for a window
   */
  public pauseRefresh(windowId: string): void {
    console.log(`Pausing refresh for window ${windowId}`);
    
    const timer = this.refreshTimers.get(windowId);
    if (timer) {
      clearInterval(timer);
      this.refreshTimers.delete(windowId);
    }
  }

  /**
   * Resumes refresh for a window
   */
  public resumeRefresh(windowId: string): void {
    console.log(`Resuming refresh for window ${windowId}`);
    
    const config = this.refreshConfigs.get(windowId);
    if (config && !this.refreshTimers.has(windowId)) {
      this.startRefreshTimer(windowId);
    }
  }

  /**
   * Cleans up all timers and configurations
   */
  public cleanup(): void {
    console.log('Cleaning up refresh manager...');
    
    // Clear all timers
    for (const [windowId, timer] of this.refreshTimers) {
      clearInterval(timer);
    }
    
    this.refreshTimers.clear();
    this.refreshConfigs.clear();
    this.removeAllListeners();
  }

  private validateRefreshInterval(interval: number): number {
    if (interval < this.MIN_REFRESH_INTERVAL) {
      console.warn(`Refresh interval ${interval}ms is too low, using minimum: ${this.MIN_REFRESH_INTERVAL}ms`);
      return this.MIN_REFRESH_INTERVAL;
    }
    
    if (interval > this.MAX_REFRESH_INTERVAL) {
      console.warn(`Refresh interval ${interval}ms is too high, using maximum: ${this.MAX_REFRESH_INTERVAL}ms`);
      return this.MAX_REFRESH_INTERVAL;
    }
    
    return interval;
  }

  private startRefreshTimer(windowId: string): void {
    const config = this.refreshConfigs.get(windowId);
    if (!config) {
      console.error(`Cannot start refresh timer: config for window ${windowId} not found`);
      return;
    }

    const timer = setInterval(() => {
      this.performRefresh(windowId, config);
    }, config.interval);

    this.refreshTimers.set(windowId, timer);
    console.log(`Refresh timer started for window ${windowId} with interval ${config.interval}ms`);
  }

  private performRefresh(windowId: string, config: RefreshConfig): void {
    console.log(`Performing scheduled refresh for window ${windowId}`);

    const event: RefreshEvent = {
      windowId,
      url: config.url,
      timestamp: new Date(),
      success: false
    };

    try {
      // Update last refresh time
      config.lastRefresh = new Date();
      this.refreshConfigs.set(windowId, config);

      // Emit refresh event
      event.success = true;
      this.emit('refresh', event);
      
      console.log(`Refresh event emitted for window ${windowId}`);

    } catch (error) {
      console.error(`Error performing refresh for window ${windowId}:`, error);
      
      event.success = false;
      event.error = error instanceof Error ? error.message : 'Unknown error';
      this.emit('refresh', event);
    }
  }
}
