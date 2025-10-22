import { BrowserWindow, screen, Display } from 'electron';
import { join } from 'path';
import { EventEmitter } from 'events';
import { URLValidator, URLValidationResult } from '../services/url-validator';
import { RefreshManager, RefreshEvent } from '../services/refresh-manager';
import { StateManager } from '../services/state-manager';
import { logger } from '../utils/logger';

export interface WindowConfig {
  id: string;
  url: string;
  displayId: string;
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
  lastRestoreAttempt?: Date;
}

export class WindowManager extends EventEmitter {
  private windows: Map<string, ManagedWindow> = new Map();
  private displays: Display[] = [];
  private refreshManager!: RefreshManager;
  private stateManager?: StateManager;

  constructor(stateManager?: StateManager) {
    super();
    this.stateManager = stateManager;
  }

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
      console.log(`Creating window: ${config.id} for display ${config.displayId}`);

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

      // Get target display by displayId
      const targetDisplay = this.getDisplayByDisplayId(config.displayId);
      if (!targetDisplay) {
        throw new Error(`Display ${config.displayId} not found`);
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
          preload: join(__dirname, '../preload/preload.js'),
          devTools: process.env.NODE_ENV !== 'production'
        }
      });

      // Configure window for kiosk mode
      this.configureKioskMode(window);
      
      // Log dev tools availability
      if (process.env.NODE_ENV !== 'production') {
        console.log(`Dev tools enabled for window ${config.id}. Press F12 to toggle.`);
      }

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

      // Update StateManager to mark display as active
      if (this.stateManager) {
        this.stateManager.saveDisplayState(config.displayId, {
          windowId: config.id,
          isActive: true,
          isResponsive: true
        });
        logger.debug(`Marked display ${config.displayId} as active (window: ${config.id})`);
      }

      // Emit window created event
      this.emit('window-created', { windowId: config.id, totalWindows: this.windows.size });

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
      
      // Update StateManager to mark display as inactive
      if (this.stateManager) {
        this.stateManager.saveDisplayState(managedWindow.config.displayId, {
          isActive: false,
          windowId: undefined // Clear windowId since window is being closed
        });
        logger.debug(`Marked display ${managedWindow.config.displayId} as inactive (closed window: ${windowId})`);
      }
      
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
    if (index < 0 || index >= this.displays.length) {
      console.error(`❌ Display index ${index} out of range. Available displays: ${this.displays.length}`);
      return undefined;
    }
    return this.displays[index];
  }

  private getDisplayByDisplayId(displayId: string): Display | undefined {
    // Extract index from displayId like "display-1", "display-2", etc.
    const match = displayId.match(/display-(\d+)/);
    if (match) {
      const index = parseInt(match[1]) - 1; // Convert to 0-based index
      const display = this.getDisplayByIndex(index);
      if (display) {
        console.log(`✅ Found display for ${displayId}: index ${index}, bounds:`, display.bounds);
        return display;
      } else {
        console.error(`❌ Display not found for ${displayId} (index ${index}). Available displays:`, this.displays.length);
        throw new Error(`Display ${displayId} not found. Available displays: ${this.displays.length}`);
      }
    }
    
    console.error(`❌ Invalid displayId format: ${displayId}. Expected format: display-1, display-2, etc.`);
    throw new Error(`Invalid displayId format: ${displayId}. Expected format: display-1, display-2, etc.`);
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
    } else {
      // In development, allow F12 to toggle dev tools
      window.webContents.on('before-input-event', (event, input) => {
        if (input.key === 'F12' && input.type === 'keyDown') {
          if (window.webContents.isDevToolsOpened()) {
            window.webContents.closeDevTools();
          } else {
            window.webContents.openDevTools();
          }
        }
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
      logger.info(`Window ${id} closed on display ${managedWindow.config.displayId}`);
      
      // Update StateManager to mark display as inactive and clear dashboard assignment
      if (this.stateManager) {
        // Clear the assigned dashboard completely when window is closed
        this.stateManager.clearAssignedDashboard(managedWindow.config.displayId);
        logger.debug(`Cleared dashboard assignment for display ${managedWindow.config.displayId}`);
      }
      
      this.windows.delete(id);
      logger.debug(`Emitting 'window-closed' event for ${managedWindow.config.displayId}`);
      this.emit('window-closed', { 
        windowId: id, 
        displayId: managedWindow.config.displayId,
        totalWindows: this.windows.size 
      });
      logger.debug('Window-closed event emitted successfully');
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
      
      // Check if this was a refresh and if we need to restore dashboard
      this.checkAndRestoreDashboardAfterLoad(managedWindow);
    });

    // Handle page navigation
    window.webContents.on('did-navigate', (event, url) => {
      console.log(`Window ${id} navigated to: ${url}`);
      managedWindow.lastNavigation = new Date();
    });

    // Handle page refresh detection
    window.webContents.on('did-start-loading', () => {
      console.log(`Window ${id} started loading`);
      // This fires on both initial load and refresh
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

  private async checkAndRestoreDashboardAfterLoad(managedWindow: ManagedWindow): Promise<void> {
    try {
      // Wait a moment for the page to fully load
      setTimeout(async () => {
        const currentUrl = managedWindow.window.webContents.getURL();
        logger.debug(`Checking dashboard restoration for window ${managedWindow.id}`);
        
        // Check if we've attempted restoration recently (prevent loops)
        const now = new Date();
        if (managedWindow.lastRestoreAttempt) {
          const timeSinceLastRestore = now.getTime() - managedWindow.lastRestoreAttempt.getTime();
          if (timeSinceLastRestore < 30000) { // 30 seconds cooldown
            console.log(`⏳ Skipping restoration for ${managedWindow.id} - cooldown period (${Math.round(timeSinceLastRestore/1000)}s ago)`);
            return;
          }
        }
        
        // Check if the current URL looks like a blank page or error page
        const needsRestore = this.shouldRestoreDashboard(currentUrl, managedWindow);
        
        if (needsRestore) {
          logger.debug(`Dashboard restoration needed for window ${managedWindow.id}`);
          managedWindow.lastRestoreAttempt = now;
          await this.restoreDashboardForWindow(managedWindow);
        }
      }, 2000); // Wait 2 seconds for page to stabilize
    } catch (error) {
      console.error(`Error checking dashboard restoration for window ${managedWindow.id}:`, error);
    }
  }

  private shouldRestoreDashboard(currentUrl: string, managedWindow: ManagedWindow): boolean {
    // Check if URL indicates a problem that needs restoration
    const problematicUrls = [
      'about:blank',
      'chrome-error://',
      'chrome://network-error/',
      'data:text/html,chromewebdata',
      ''
    ];
    
    // URLs that are legitimate redirects and should NOT trigger restoration
    const legitimateRedirects = [
      'accounts.google.com',
      'login.microsoftonline.com',
      'auth0.com',
      'okta.com',
      'oauth',
      'login',
      'signin',
      'auth'
    ];
    
    // Check if current URL is problematic
    const hasProblematicUrl = problematicUrls.some(problemUrl => 
      currentUrl.startsWith(problemUrl) || currentUrl === problemUrl
    );
    
    // Check if this is a legitimate redirect (like authentication)
    const isLegitimateRedirect = legitimateRedirects.some(redirect => 
      currentUrl.toLowerCase().includes(redirect.toLowerCase())
    );
    
    // Only restore if it's a problematic URL AND not a legitimate redirect
    const shouldRestore = hasProblematicUrl && !isLegitimateRedirect;
    
    logger.debug(`Restoration check for ${managedWindow.id}: ${shouldRestore ? 'needed' : 'not needed'}`);
    
    return shouldRestore;
  }

  private async restoreDashboardForWindow(managedWindow: ManagedWindow): Promise<void> {
    try {
      logger.debug(`Restoring dashboard for window ${managedWindow.id}`);
      
      // Navigate back to the original URL
      const originalUrl = managedWindow.config.url;
      await managedWindow.window.loadURL(originalUrl);
      
      // Update the last navigation time
      managedWindow.lastNavigation = new Date();
      
      logger.info(`Dashboard restored for window ${managedWindow.id}`);
      
      // Emit an event that can be picked up by other services
      this.emit('dashboard-restored', {
        windowId: managedWindow.id,
        url: originalUrl,
        timestamp: new Date()
      });
      
    } catch (error) {
      console.error(`❌ Failed to restore dashboard for window ${managedWindow.id}:`, error);
      managedWindow.errorCount++;
      managedWindow.lastError = `Dashboard restoration failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  // gRPC compatibility methods
  public async deployDashboard(config: { url: string; displayId: string; fullscreen?: boolean; refreshInterval?: number; dashboardId?: string }): Promise<{ success: boolean; url?: string; error?: string }> {
    try {
      console.log(`🚀 Deploying dashboard to ${config.displayId}:`, {
        url: config.url,
        displayId: config.displayId,
        fullscreen: config.fullscreen,
        refreshInterval: config.refreshInterval,
        dashboardId: config.dashboardId
      });

      // Validate displayId before proceeding
      const targetDisplay = this.getDisplayByDisplayId(config.displayId);
      if (!targetDisplay) {
        throw new Error(`Display ${config.displayId} not found`);
      }

      console.log(`✅ Target display confirmed:`, {
        displayId: config.displayId,
        bounds: targetDisplay.bounds,
        isPrimary: targetDisplay === screen.getPrimaryDisplay()
      });

      const windowConfig: WindowConfig = {
        id: `dashboard_${config.displayId}_${Date.now()}`,
        url: config.url,
        displayId: config.displayId,
        fullscreen: config.fullscreen !== false,
        refreshInterval: config.refreshInterval || 0
      };

      const windowId = await this.createWindow(windowConfig);
      
      // Save dashboard deployment in StateManager
      if (this.stateManager) {
        this.stateManager.saveDashboardDeployment(
          config.displayId,
          config.dashboardId || 'dashboard', // Use provided dashboardId or default
          config.url,
          Math.floor((config.refreshInterval || 300000) / 1000) // Convert ms to seconds
        );
        logger.debug(`Saved dashboard deployment for ${config.displayId}`);
      }
      
      console.log(`✅ Dashboard deployed successfully to ${config.displayId} (window: ${windowId})`);
      return { success: true, url: config.url };
    } catch (error) {
      console.error(`❌ Failed to deploy dashboard to ${config.displayId}:`, error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  public async refreshDisplay(displayId: string): Promise<{ success: boolean; url?: string; error?: string }> {
    try {
      logger.debug(`Refreshing display: ${displayId}`);
      
      // Find window for this display
      const window = Array.from(this.windows.values()).find(w => 
        w.config.displayId === displayId
      );

      if (!window) {
        return { success: false, error: `No window found for display ${displayId}` };
      }

      // Try to get the original dashboard URL from StateManager
      let targetUrl = window.config.url; // fallback to current config URL
      
      if (this.stateManager) {
        const assignedDashboard = this.stateManager.getAssignedDashboard(displayId);
        if (assignedDashboard && assignedDashboard.url) {
          targetUrl = assignedDashboard.url;
          logger.debug(`Found assigned dashboard URL for ${displayId}`);
        } else {
          logger.debug(`No assigned dashboard found for ${displayId}, using config URL`);
        }
      }

      // Navigate to the original URL instead of just reloading
      logger.debug(`Navigating ${displayId} to dashboard URL`);
      const success = await this.navigateWindow(window.id, targetUrl);
      
      return { 
        success, 
        url: targetUrl,
        error: success ? undefined : 'Failed to navigate to dashboard URL'
      };
    } catch (error) {
      console.error(`❌ [WINDOW-MANAGER] Error refreshing display ${displayId}:`, error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  public async takeScreenshot(displayId: string, options?: { format?: string; quality?: number }): Promise<{ data: Buffer; format: string; width: number; height: number }> {
    // Find window for this display
    const window = Array.from(this.windows.values()).find(w => 
      w.config.displayId === displayId
    );

    if (!window) {
      throw new Error(`No window found for display ${displayId}`);
    }

    const image = await window.window.webContents.capturePage();
    const buffer = options?.format === 'jpeg' 
      ? image.toJPEG(options.quality || 90)
      : image.toPNG();

    return {
      data: buffer,
      format: options?.format || 'png',
      width: image.getSize().width,
      height: image.getSize().height
    };
  }
}
