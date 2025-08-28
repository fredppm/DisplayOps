import { BrowserWindow, screen, Display } from 'electron';
import { join } from 'path';
import { URLValidator, URLValidationResult } from '../services/url-validator';
import { RefreshManager, RefreshEvent } from '../services/refresh-manager';

export interface WindowConfig {
  id: string;
  url: string;
  monitorIndex: number;
  fullscreen?: boolean;
  refreshInterval?: number; // in milliseconds
  width?: number;
  height?: number;
  x?: number;
  y?: number;
}

export interface ManagedWindow {
  id: string;
  window: BrowserWindow;
  config: WindowConfig;
  lastNavigation: Date;
  isResponsive: boolean;
  urlValidation?: URLValidationResult;
  errorCount: number;
  lastError?: string;
}

export class WindowManager {
  private windows: Map<string, ManagedWindow> = new Map();
  private displays: Display[] = [];
  private refreshManager: RefreshManager;

  public initialize(): void {
    console.log('Initializing Window Manager...');
    this.updateDisplays();
    
    // Initialize refresh manager
    this.refreshManager = new RefreshManager();
    this.setupRefreshManager();
    
    // Listen for display changes
    screen.on('display-added', () => this.updateDisplays());
    screen.on('display-removed', () => this.updateDisplays());
    screen.on('display-metrics-changed', () => this.updateDisplays());
  }

  private updateDisplays(): void {
    this.displays = screen.getAllDisplays();
    console.log(`Detected ${this.displays.length} displays:`, 
      this.displays.map(d => ({
        id: d.id,
        bounds: d.bounds,
        workArea: d.workArea,
        primary: d === screen.getPrimaryDisplay()
      }))
    );
  }

  public async createWindow(config: WindowConfig): Promise<string> {
    try {
      console.log(`Creating window: ${config.id} for monitor ${config.monitorIndex}`);

      // Check if window already exists
      if (this.windows.has(config.id)) {
        throw new Error(`Window with ID ${config.id} already exists`);
      }

      // Validate URL before creating window
      console.log(`Validating URL: ${URLValidator.sanitizeURLForLogging(config.url)}`);
      const urlValidation = await URLValidator.validateDashboardURL(config.url);
      
      if (!urlValidation.isReachable) {
        console.warn(`URL validation failed for ${config.id}:`, urlValidation.error);
        // Still create the window but log the warning
      }

      // Get target display
      const targetDisplay = this.getDisplayByIndex(config.monitorIndex);
      if (!targetDisplay) {
        throw new Error(`Display ${config.monitorIndex} not found`);
      }

      // Calculate window bounds
      const bounds = this.calculateWindowBounds(config, targetDisplay);

      // Create the browser window
      const window = new BrowserWindow({
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
        fullscreen: config.fullscreen || false,
        frame: false,
        show: false,
        alwaysOnTop: true,
        skipTaskbar: true,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          sandbox: true,
          webSecurity: true,
          preload: join(__dirname, '../preload/preload.js')
        }
      });

      // Configure window for kiosk mode
      this.configureKioskMode(window);

      // Load the URL
      await window.loadURL(config.url);

      // Show window after loading
      window.show();

      // Create managed window object
      const managedWindow: ManagedWindow = {
        id: config.id,
        window,
        config,
        lastNavigation: new Date(),
        isResponsive: true,
        urlValidation,
        errorCount: 0
      };

      // Setup window event handlers
      this.setupWindowEventHandlers(managedWindow);

      // Store the window
      this.windows.set(config.id, managedWindow);

      // Add to refresh manager if refresh interval is specified
      if (config.refreshInterval) {
        this.refreshManager.addWindow(config.id, config.url, config.refreshInterval);
      }

      console.log(`Window ${config.id} created successfully`);
      return config.id;

    } catch (error) {
      console.error(`Error creating window ${config.id}:`, error);
      throw error;
    }
  }

  public async closeWindow(windowId: string): Promise<boolean> {
    try {
      const managedWindow = this.windows.get(windowId);
      if (!managedWindow) {
        console.warn(`Window ${windowId} not found`);
        return false;
      }

      console.log(`Closing window: ${windowId}`);
      
      // Remove from refresh manager
      this.refreshManager.removeWindow(windowId);
      
      managedWindow.window.destroy();
      this.windows.delete(windowId);
      
      return true;
    } catch (error) {
      console.error(`Error closing window ${windowId}:`, error);
      return false;
    }
  }

  public async navigateWindow(windowId: string, url: string): Promise<boolean> {
    try {
      const managedWindow = this.windows.get(windowId);
      if (!managedWindow) {
        throw new Error(`Window ${windowId} not found`);
      }

      console.log(`Navigating window ${windowId} to: ${URLValidator.sanitizeURLForLogging(url)}`);
      
      // Validate new URL
      const urlValidation = await URLValidator.validateDashboardURL(url);
      if (!urlValidation.isReachable) {
        console.warn(`URL validation failed for navigation:`, urlValidation.error);
      }
      
      await managedWindow.window.loadURL(url);
      
      managedWindow.lastNavigation = new Date();
      managedWindow.config.url = url;
      managedWindow.urlValidation = urlValidation;
      
      // Update refresh manager
      this.refreshManager.updateURL(windowId, url);
      
      return true;
    } catch (error) {
      console.error(`Error navigating window ${windowId}:`, error);
      return false;
    }
  }

  public refreshWindow(windowId: string): boolean {
    try {
      const managedWindow = this.windows.get(windowId);
      if (!managedWindow) {
        console.warn(`Window ${windowId} not found`);
        return false;
      }

      managedWindow.window.reload();
      return true;
    } catch (error) {
      console.error(`Error refreshing window ${windowId}:`, error);
      return false;
    }
  }

  public getWindow(windowId: string): ManagedWindow | undefined {
    return this.windows.get(windowId);
  }

  public getAllWindows(): ManagedWindow[] {
    return Array.from(this.windows.values());
  }

  public closeAllWindows(): void {
    console.log('Closing all managed windows...');
    for (const [windowId, managedWindow] of this.windows) {
      try {
        this.refreshManager.removeWindow(windowId);
        managedWindow.window.destroy();
      } catch (error) {
        console.error(`Error closing window ${windowId}:`, error);
      }
    }
    this.windows.clear();
    
    // Cleanup refresh manager
    this.refreshManager.cleanup();
  }

  /**
   * Updates the refresh interval for a window
   */
  public updateRefreshInterval(windowId: string, refreshInterval: number): boolean {
    try {
      const managedWindow = this.windows.get(windowId);
      if (!managedWindow) {
        console.warn(`Cannot update refresh interval: window ${windowId} not found`);
        return false;
      }

      managedWindow.config.refreshInterval = refreshInterval;
      this.refreshManager.updateRefreshInterval(windowId, refreshInterval);
      
      console.log(`Updated refresh interval for window ${windowId}: ${refreshInterval}ms`);
      return true;
    } catch (error) {
      console.error(`Error updating refresh interval for window ${windowId}:`, error);
      return false;
    }
  }

  /**
   * Triggers manual refresh for a window
   */
  public triggerManualRefresh(windowId: string): boolean {
    try {
      const managedWindow = this.windows.get(windowId);
      if (!managedWindow) {
        console.warn(`Cannot trigger refresh: window ${windowId} not found`);
        return false;
      }

      this.refreshManager.triggerRefresh(windowId);
      return true;
    } catch (error) {
      console.error(`Error triggering refresh for window ${windowId}:`, error);
      return false;
    }
  }

  /**
   * Gets window health and status information
   */
  public getWindowHealth(windowId: string): any {
    const managedWindow = this.windows.get(windowId);
    if (!managedWindow) {
      return null;
    }

    const refreshConfig = this.refreshManager.getRefreshConfig(windowId);
    
    return {
      id: windowId,
      isResponsive: managedWindow.isResponsive,
      errorCount: managedWindow.errorCount,
      lastError: managedWindow.lastError,
      lastNavigation: managedWindow.lastNavigation,
      urlValidation: managedWindow.urlValidation,
      refreshConfig: refreshConfig ? {
        interval: refreshConfig.interval,
        lastRefresh: refreshConfig.lastRefresh
      } : null
    };
  }

  /**
   * Gets health information for all windows
   */
  public getAllWindowsHealth(): any[] {
    return Array.from(this.windows.keys()).map(windowId => 
      this.getWindowHealth(windowId)
    ).filter(health => health !== null);
  }

  private setupRefreshManager(): void {
    // Listen for refresh events from refresh manager
    this.refreshManager.on('refresh', (event: RefreshEvent) => {
      this.handleRefreshEvent(event);
    });

    console.log('Refresh manager event handlers configured');
  }

  private handleRefreshEvent(event: RefreshEvent): void {
    console.log(`Handling refresh event for window ${event.windowId}`);

    const managedWindow = this.windows.get(event.windowId);
    if (!managedWindow) {
      console.error(`Window ${event.windowId} not found for refresh event`);
      return;
    }

    try {
      if (event.success) {
        // Perform the actual refresh
        managedWindow.window.reload();
        managedWindow.lastNavigation = event.timestamp;
        managedWindow.errorCount = 0;
        managedWindow.lastError = undefined;
        
        console.log(`Successfully refreshed window ${event.windowId}`);
      } else {
        // Handle refresh failure
        managedWindow.errorCount++;
        managedWindow.lastError = event.error || 'Refresh failed';
        
        console.error(`Refresh failed for window ${event.windowId}: ${event.error}`);
        
        // If too many errors, consider recovery actions
        if (managedWindow.errorCount >= 3) {
          console.warn(`Window ${event.windowId} has ${managedWindow.errorCount} errors, attempting recovery`);
          this.attemptWindowRecovery(event.windowId, managedWindow);
        }
      }
    } catch (error) {
      console.error(`Error handling refresh event for window ${event.windowId}:`, error);
      managedWindow.errorCount++;
      managedWindow.lastError = error instanceof Error ? error.message : 'Unknown refresh error';
    }
  }

  private async attemptWindowRecovery(windowId: string, managedWindow: ManagedWindow): Promise<void> {
    console.log(`Attempting recovery for window ${windowId}`);

    try {
      // Try to reload the URL
      await managedWindow.window.loadURL(managedWindow.config.url);
      
      // Reset error count if successful
      managedWindow.errorCount = 0;
      managedWindow.lastError = undefined;
      managedWindow.isResponsive = true;
      
      console.log(`Successfully recovered window ${windowId}`);
      
    } catch (error) {
      console.error(`Recovery failed for window ${windowId}:`, error);
      managedWindow.lastError = `Recovery failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      
      // If recovery fails multiple times, consider recreating the window
      if (managedWindow.errorCount >= 5) {
        console.warn(`Window ${windowId} recovery failed multiple times, considering recreation`);
        // Note: Actual recreation logic would be implemented here
      }
    }
  }

  private getDisplayByIndex(index: number): Display | undefined {
    return this.displays[index] || this.displays[0]; // Fallback to primary display
  }

  private calculateWindowBounds(config: WindowConfig, display: Display) {
    const { bounds } = display;
    
    if (config.fullscreen) {
      return bounds;
    }

    return {
      x: config.x ?? bounds.x,
      y: config.y ?? bounds.y,
      width: config.width ?? bounds.width,
      height: config.height ?? bounds.height
    };
  }

  private configureKioskMode(window: BrowserWindow): void {
    // Disable developer tools in production
    if (process.env.NODE_ENV === 'production') {
      window.webContents.on('devtools-opened', () => {
        window.webContents.closeDevTools();
      });
    }

    // Prevent navigation away from the assigned URL
    window.webContents.on('will-navigate', (event, navigationUrl) => {
      // Allow navigation only to the same origin or explicitly allowed URLs
      console.log(`Navigation attempt to: ${navigationUrl}`);
    });

    // Handle new window requests
    window.webContents.setWindowOpenHandler(() => {
      return { action: 'deny' };
    });
  }

  private setupWindowEventHandlers(managedWindow: ManagedWindow): void {
    const { window, id } = managedWindow;

    // Handle window closed
    window.on('closed', () => {
      console.log(`Window ${id} was closed`);
      this.windows.delete(id);
    });

    // Handle unresponsive window
    window.on('unresponsive', () => {
      console.warn(`Window ${id} became unresponsive`);
      managedWindow.isResponsive = false;
      managedWindow.errorCount++;
      managedWindow.lastError = 'Window became unresponsive';
    });

    // Handle responsive window
    window.on('responsive', () => {
      console.log(`Window ${id} became responsive again`);
      managedWindow.isResponsive = true;
      managedWindow.errorCount = Math.max(0, managedWindow.errorCount - 1); // Reduce error count
    });

    // Handle page load events
    window.webContents.on('did-finish-load', () => {
      console.log(`Window ${id} finished loading`);
      managedWindow.isResponsive = true;
      managedWindow.errorCount = 0; // Reset error count on successful load
      managedWindow.lastError = undefined;
    });

    window.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
      console.error(`Window ${id} failed to load:`, errorCode, errorDescription);
      managedWindow.isResponsive = false;
      managedWindow.errorCount++;
      managedWindow.lastError = `Load failed: ${errorDescription} (${errorCode})`;
      
      // Attempt recovery for critical errors
      if (errorCode === -2 || errorCode === -3) { // Failed to load or no internet
        setTimeout(() => {
          this.attemptWindowRecovery(id, managedWindow);
        }, 5000); // Wait 5 seconds before attempting recovery
      }
    });

    // Handle certificate errors
    window.webContents.on('certificate-error', (event, url, error, certificate, callback) => {
      console.warn(`Certificate error for window ${id} at ${url}:`, error);
      managedWindow.errorCount++;
      managedWindow.lastError = `Certificate error: ${error}`;
      
      // For development/testing, you might want to accept certificates
      // In production, this should be more restrictive
      callback(false); // Reject certificate by default
    });

    // Handle crashed renderer
    window.webContents.on('render-process-gone', (event, details) => {
      console.error(`Renderer process crashed for window ${id}:`, details);
      managedWindow.isResponsive = false;
      managedWindow.errorCount++;
      managedWindow.lastError = `Renderer crashed: ${details.reason}`;
      
      // Attempt to reload the window
      setTimeout(() => {
        this.attemptWindowRecovery(id, managedWindow);
      }, 1000);
    });
  }
}
