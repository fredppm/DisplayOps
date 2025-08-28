import { BrowserWindow, screen, Display } from 'electron';
import { join } from 'path';

export interface WindowConfig {
  id: string;
  url: string;
  monitorIndex: number;
  fullscreen?: boolean;
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
}

export class WindowManager {
  private windows: Map<string, ManagedWindow> = new Map();
  private displays: Display[] = [];

  public initialize(): void {
    console.log('Initializing Window Manager...');
    this.updateDisplays();
    
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
        isResponsive: true
      };

      // Setup window event handlers
      this.setupWindowEventHandlers(managedWindow);

      // Store the window
      this.windows.set(config.id, managedWindow);

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

      console.log(`Navigating window ${windowId} to: ${url}`);
      await managedWindow.window.loadURL(url);
      
      managedWindow.lastNavigation = new Date();
      managedWindow.config.url = url;
      
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
        managedWindow.window.destroy();
      } catch (error) {
        console.error(`Error closing window ${windowId}:`, error);
      }
    }
    this.windows.clear();
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
    });

    // Handle responsive window
    window.on('responsive', () => {
      console.log(`Window ${id} became responsive again`);
      managedWindow.isResponsive = true;
    });

    // Handle page load events
    window.webContents.on('did-finish-load', () => {
      console.log(`Window ${id} finished loading`);
      managedWindow.isResponsive = true;
    });

    window.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
      console.error(`Window ${id} failed to load:`, errorCode, errorDescription);
      managedWindow.isResponsive = false;
    });
  }
}
