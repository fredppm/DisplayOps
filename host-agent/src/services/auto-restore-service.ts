import { StateManager } from './state-manager';
import { WindowManager, WindowConfig } from '../managers/window-manager';
import { logger } from '../utils/logger';

export class AutoRestoreService {
  private stateManager: StateManager;
  private windowManager: WindowManager;

  constructor(stateManager: StateManager, windowManager: WindowManager) {
    this.stateManager = stateManager;
    this.windowManager = windowManager;
  }

  public async restoreAllDashboards(): Promise<void> {
    logger.info('🔄 Starting dashboard auto-restoration...');
    
    const displaysWithDashboards = this.stateManager.getDisplaysWithAssignedDashboards();
    
    if (displaysWithDashboards.length === 0) {
      logger.info('📭 No dashboards to restore');
      return;
    }

    logger.info(`🔄 Found ${displaysWithDashboards.length} displays with assigned dashboards`);

    let restoredCount = 0;
    let failedCount = 0;

    for (const displayId of displaysWithDashboards) {
      try {
        const restored = await this.restoreDashboard(displayId);
        if (restored) {
          restoredCount++;
        } else {
          failedCount++;
        }
      } catch (error) {
        logger.error(`Failed to restore dashboard for ${displayId}:`, error);
        failedCount++;
      }
    }

    logger.success(`✅ Dashboard restoration complete: ${restoredCount} restored, ${failedCount} failed`);
  }

  public async restoreDashboard(displayId: string): Promise<boolean> {
    const displayState = this.stateManager.getDisplayState(displayId);
    
    if (!displayState?.assignedDashboard) {
      logger.warn(`No assigned dashboard found for ${displayId}`);
      return false;
    }

    const { dashboardId, url, refreshInterval } = displayState.assignedDashboard;
    
    logger.info(`🔄 Restoring dashboard ${dashboardId} on ${displayId}...`);

    try {
      // Extract monitor index from displayId (e.g., "display-1" -> 0)
      const monitorIndex = this.extractMonitorIndex(displayId);
      
      if (monitorIndex === -1) {
        throw new Error(`Invalid display ID format: ${displayId}`);
      }

      // Check if a window already exists for this display
      const existingWindows = this.windowManager.getAllWindows();
      const existingWindow = existingWindows.find(w => w.id.includes(displayId));
      
      if (existingWindow) {
        logger.info(`Window already exists for ${displayId}, skipping restoration`);
        return true;
      }

      // Create window configuration
      const windowConfig: WindowConfig = {
        id: `dashboard-${dashboardId}-${displayId}-restored-${Date.now()}`,
        url,
        displayId,
        fullscreen: true, // Default to fullscreen for restored dashboards
        refreshInterval
      };

      // Create the window
      const windowId = await this.windowManager.createWindow(windowConfig);
      
      // Update state with new window ID
      this.stateManager.saveDisplayState(displayId, {
        windowId,
        isActive: true,
        isResponsive: true,
        lastRefresh: new Date()
      });

      logger.success(`✅ Restored dashboard ${dashboardId} on ${displayId} (window: ${windowId})`);
      return true;

    } catch (error) {
      logger.error(`Failed to restore dashboard ${dashboardId} on ${displayId}:`, error);
      
      // Mark as failed in state but keep the assignment for future attempts
      this.stateManager.saveDisplayState(displayId, {
        isActive: false,
        isResponsive: false,
        lastRefresh: new Date()
      });
      
      return false;
    }
  }

  private extractMonitorIndex(displayId: string): number {
    // Extract number from displayId like "display-1", "display-2", etc.
    const match = displayId.match(/display-(\d+)/);
    if (match) {
      return parseInt(match[1]) - 1; // Convert to 0-based index
    }
    return -1;
  }

  public async restoreDisplayOnStartup(displayId: string): Promise<void> {
    // Wait a bit for the system to be fully ready
    setTimeout(async () => {
      try {
        await this.restoreDashboard(displayId);
      } catch (error) {
        logger.error(`Startup restoration failed for ${displayId}:`, error);
      }
    }, 2000); // 2 second delay
  }

  public getRestorableDisplays(): string[] {
    return this.stateManager.getDisplaysWithAssignedDashboards();
  }

  public getRestoreStats(): {
    totalDisplays: number;
    restorableDisplays: number;
    activeDisplays: number;
  } {
    const stats = this.stateManager.getStateStats();
    const restorableDisplays = this.getRestorableDisplays();
    
    return {
      totalDisplays: stats.totalDisplays,
      restorableDisplays: restorableDisplays.length,
      activeDisplays: stats.activeDisplays
    };
  }

  // Method to be called when a window is manually closed
  public onWindowClosed(windowId: string): void {
    // Find which display this window belonged to
    const allStates = this.stateManager.getAllDisplayStates();
    
    for (const [displayId, state] of Object.entries(allStates)) {
      if (state.windowId === windowId) {
        logger.info(`Window ${windowId} closed for ${displayId}, marking as inactive`);
        
        // Mark as inactive but keep the dashboard assignment
        this.stateManager.saveDisplayState(displayId, {
          windowId: undefined,
          isActive: false,
          isResponsive: false,
          lastRefresh: new Date()
        });
        
        break;
      }
    }
  }

  // Method to be called when system detects a display change
  public async onDisplayChange(): Promise<void> {
    logger.info('🖥️ Display change detected, checking for dashboards to restore...');
    
    // Wait a moment for displays to stabilize
    setTimeout(async () => {
      await this.restoreAllDashboards();
    }, 3000); // 3 second delay
  }
}
