import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger';

export interface DisplayState {
  displayId: string;
  assignedDashboard?: {
    dashboardId: string;
    url: string;
    refreshInterval: number;
    deployedAt: Date;
  };
  windowId?: string;
  isActive: boolean;
  lastRefresh: Date;
  isResponsive: boolean;
}

export interface PersistedState {
  version: string;
  lastUpdated: Date;
  displays: Record<string, DisplayState>;
}

export class StateManager {
  private state: PersistedState;
  private stateFilePath: string;
  private saveTimeout: NodeJS.Timeout | null = null;

  constructor(dataDir?: string) {
    const baseDir = dataDir || path.join(process.cwd(), 'data');
    
    // Ensure data directory exists
    if (!fs.existsSync(baseDir)) {
      fs.mkdirSync(baseDir, { recursive: true });
    }
    
    this.stateFilePath = path.join(baseDir, 'display-state.json');
    this.state = this.loadState();
  }

  private loadState(): PersistedState {
    try {
      if (fs.existsSync(this.stateFilePath)) {
        const data = fs.readFileSync(this.stateFilePath, 'utf8');
        const parsed = JSON.parse(data);
        
        // Convert date strings back to Date objects
        parsed.lastUpdated = new Date(parsed.lastUpdated);
        Object.values(parsed.displays).forEach((display: any) => {
          display.lastRefresh = new Date(display.lastRefresh);
          if (display.assignedDashboard?.deployedAt) {
            display.assignedDashboard.deployedAt = new Date(display.assignedDashboard.deployedAt);
          }
        });
        
        logger.info(`📁 Loaded display state from ${this.stateFilePath}`);
        logger.debug(`State contains ${Object.keys(parsed.displays).length} displays`);
        
        return parsed;
      }
    } catch (error) {
      logger.error('Error loading display state:', error);
    }

    // Return default state if file doesn't exist or has errors
    const defaultState: PersistedState = {
      version: '1.0.0',
      lastUpdated: new Date(),
      displays: {}
    };
    
    logger.info('📁 Created new display state file');
    return defaultState;
  }

  private saveState(): void {
    try {
      this.state.lastUpdated = new Date();
      const data = JSON.stringify(this.state, null, 2);
      fs.writeFileSync(this.stateFilePath, data, 'utf8');
      logger.debug(`💾 Saved display state to ${this.stateFilePath}`);
    } catch (error) {
      logger.error('Error saving display state:', error);
    }
  }

  private debouncedSave(): void {
    // Debounce saves to avoid excessive file writes
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    
    this.saveTimeout = setTimeout(() => {
      this.saveState();
      this.saveTimeout = null;
    }, 1000); // Save after 1 second of inactivity
  }

  public saveDisplayState(displayId: string, state: Partial<DisplayState>): void {
    const currentState = this.state.displays[displayId] || {
      displayId,
      isActive: false,
      lastRefresh: new Date(),
      isResponsive: false
    };

    // Merge the new state with existing state
    this.state.displays[displayId] = {
      ...currentState,
      ...state,
      displayId, // Ensure displayId is always set
      lastRefresh: new Date()
    };

    logger.info(`💾 Updated state for ${displayId}:`, {
      isActive: this.state.displays[displayId].isActive,
      hasAssignedDashboard: !!this.state.displays[displayId].assignedDashboard,
      dashboardId: this.state.displays[displayId].assignedDashboard?.dashboardId
    });

    this.debouncedSave();
  }

  public getDisplayState(displayId: string): DisplayState | null {
    return this.state.displays[displayId] || null;
  }

  public getAllDisplayStates(): Record<string, DisplayState> {
    return { ...this.state.displays };
  }

  public saveDashboardDeployment(displayId: string, dashboardId: string, url: string, refreshInterval: number = 300): void {
    this.saveDisplayState(displayId, {
      assignedDashboard: {
        dashboardId,
        url,
        refreshInterval,
        deployedAt: new Date()
      },
      isActive: true,
      isResponsive: true
    });

    logger.success(`🚀 Saved dashboard deployment: ${dashboardId} → ${displayId}`);
  }

  public markDisplayRefreshed(displayId: string, windowId?: string): void {
    const currentState = this.getDisplayState(displayId);
    
    this.saveDisplayState(displayId, {
      windowId,
      lastRefresh: new Date(),
      isResponsive: true,
      // Keep existing dashboard assignment if any
      assignedDashboard: currentState?.assignedDashboard
    });

    logger.info(`🔄 Marked display refreshed: ${displayId}`);
  }

  public clearDisplayState(displayId: string): void {
    if (this.state.displays[displayId]) {
      delete this.state.displays[displayId];
      this.debouncedSave();
      logger.info(`🗑️ Cleared state for ${displayId}`);
    }
  }

  public hasAssignedDashboard(displayId: string): boolean {
    const state = this.getDisplayState(displayId);
    return !!(state?.assignedDashboard);
  }

  public getAssignedDashboard(displayId: string): DisplayState['assignedDashboard'] | null {
    const state = this.getDisplayState(displayId);
    return state?.assignedDashboard || null;
  }

  public getDisplaysWithAssignedDashboards(): string[] {
    return Object.keys(this.state.displays).filter(displayId => 
      this.hasAssignedDashboard(displayId)
    );
  }

  public cleanup(): void {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
      this.saveState(); // Final save
    }
  }

  // Statistics and debugging
  public getStateStats(): {
    totalDisplays: number;
    activeDisplays: number;
    displaysWithDashboards: number;
    lastUpdated: Date;
  } {
    const displays = Object.values(this.state.displays);
    
    return {
      totalDisplays: displays.length,
      activeDisplays: displays.filter(d => d.isActive).length,
      displaysWithDashboards: displays.filter(d => d.assignedDashboard).length,
      lastUpdated: this.state.lastUpdated
    };
  }

  public exportState(): PersistedState {
    return JSON.parse(JSON.stringify(this.state)); // Deep copy
  }

  public importState(newState: PersistedState): void {
    this.state = newState;
    this.saveState();
    logger.info('📥 Imported new display state');
  }
}
