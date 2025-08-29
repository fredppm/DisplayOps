import { BrowserWindow, globalShortcut, screen } from 'electron';
import { join } from 'path';
import { DebugService } from '../services/debug-service';
import { WindowManager } from './window-manager';
import { ConfigManager } from './config-manager';
import { DebugOverlayConfig, DebugOverlayState } from '../types/debug-types';

export class DebugOverlayManager {
  private overlayWindow: BrowserWindow | null = null;
  private debugService: DebugService;
  private windowManager: WindowManager;
  private configManager: ConfigManager;
  private config: DebugOverlayConfig;
  private state: DebugOverlayState;
  private updateInterval: NodeJS.Timeout | null = null;

  constructor(
    debugService: DebugService,
    windowManager: WindowManager,
    configManager: ConfigManager
  ) {
    this.debugService = debugService;
    this.windowManager = windowManager;
    this.configManager = configManager;

    this.config = {
      enabled: false,
      position: 'top-right',
      opacity: 0.9,
      width: 320,
      height: 400,
      alwaysOnTop: true,
      hotkey: 'CommandOrControl+Shift+D'
    };

    this.state = {
      visible: false,
      pinned: false,
      collapsed: false,
      activeTab: 'events'
    };

    // Don't setup hotkeys in constructor - wait for app ready
  }

  public initialize(): void {
    this.setupHotkeys();
  }

  public async createOverlay(): Promise<void> {
    if (this.overlayWindow) {
      this.overlayWindow.focus();
      return;
    }

    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;

    // Calculate position based on config
    let x, y;
    switch (this.config.position) {
      case 'top-left':
        x = 20;
        y = 20;
        break;
      case 'top-right':
        x = screenWidth - this.config.width - 20;
        y = 20;
        break;
      case 'bottom-left':
        x = 20;
        y = screenHeight - this.config.height - 20;
        break;
      case 'bottom-right':
        x = screenWidth - this.config.width - 20;
        y = screenHeight - this.config.height - 20;
        break;
    }

    this.overlayWindow = new BrowserWindow({
      width: this.config.width,
      height: this.config.height,
      x,
      y,
      frame: false,
      transparent: true,
      alwaysOnTop: this.config.alwaysOnTop,
      skipTaskbar: true,
      resizable: true,
      minimizable: false,
      maximizable: false,
      closable: true,
      opacity: this.config.opacity,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: join(__dirname, '../preload/debug-preload.js'),
        webSecurity: false
      }
    });

    // Load the debug overlay HTML
    const debugOverlayPath = join(__dirname, '../renderer/debug-overlay.html');
    await this.overlayWindow.loadFile(debugOverlayPath);

    // Handle window events
    this.overlayWindow.on('closed', () => {
      this.overlayWindow = null;
      this.state.visible = false;
      this.stopUpdates();
    });

    this.overlayWindow.on('blur', () => {
      if (!this.state.pinned) {
        // Auto-hide when losing focus (unless pinned)
        this.overlayWindow?.setOpacity(0.3);
      }
    });

    this.overlayWindow.on('focus', () => {
      this.overlayWindow?.setOpacity(this.config.opacity);
    });

    // Setup IPC handlers for the overlay
    this.setupOverlayIPC();

    this.state.visible = true;
    this.startUpdates();

    console.log('Debug overlay created');
  }

  public hideOverlay(): void {
    if (this.overlayWindow) {
      this.overlayWindow.hide();
      this.state.visible = false;
      this.stopUpdates();
    }
  }

  public showOverlay(): void {
    if (this.overlayWindow) {
      this.overlayWindow.show();
      this.overlayWindow.focus();
      this.state.visible = true;
      this.startUpdates();
    }
  }

  public toggleOverlay(): void {
    if (!this.config.enabled) {
      this.enable();
      return;
    }

    if (this.overlayWindow) {
      if (this.state.visible) {
        this.hideOverlay();
      } else {
        this.showOverlay();
      }
    } else {
      this.createOverlay();
    }

    // Notify that debug state was toggled via hotkey
    const newState = this.debugService.toggleFromHotkey();
    console.log(`🎛️ Debug toggled via hotkey: ${newState ? 'ENABLED' : 'DISABLED'}`);
  }

  public enable(): void {
    this.config.enabled = true;
    this.debugService.enableFromHotkey();
    this.createOverlay();
    
    console.log('Debug overlay enabled - Press Ctrl+Shift+D to toggle');
  }

  public disable(): void {
    this.config.enabled = false;
    this.debugService.disableFromHotkey();
    
    if (this.overlayWindow) {
      this.overlayWindow.close();
    }
    
    this.stopUpdates();
    console.log('Debug overlay disabled');
  }

  public isEnabled(): boolean {
    return this.config.enabled;
  }

  private setupHotkeys(): void {
    globalShortcut.register(this.config.hotkey, () => {
      this.toggleOverlay();
    });
  }

  private setupOverlayIPC(): void {
    if (!this.overlayWindow) return;

    // Handle requests for debug data
    this.overlayWindow.webContents.ipc.handle('debug:get-events', () => {
      return this.debugService.getRecentEvents(20);
    });

    this.overlayWindow.webContents.ipc.handle('debug:get-metrics', () => {
      return this.debugService.getSystemMetrics();
    });

    this.overlayWindow.webContents.ipc.handle('debug:clear-events', () => {
      this.debugService.clearEvents();
    });

    this.overlayWindow.webContents.ipc.handle('debug:export-events', (event, format: 'json' | 'csv') => {
      return this.debugService.exportEvents(format);
    });

    this.overlayWindow.webContents.ipc.handle('debug:toggle-pin', () => {
      this.state.pinned = !this.state.pinned;
      return this.state.pinned;
    });

    this.overlayWindow.webContents.ipc.handle('debug:set-tab', (event, tab: string) => {
      this.state.activeTab = tab as any;
      return this.state.activeTab;
    });

    this.overlayWindow.webContents.ipc.handle('debug:get-state', () => {
      return this.state;
    });

    // Handle window controls
    this.overlayWindow.webContents.ipc.handle('window:minimize', () => {
      this.overlayWindow?.minimize();
    });

    this.overlayWindow.webContents.ipc.handle('window:close', () => {
      this.overlayWindow?.close();
    });
  }

  private startUpdates(): void {
    if (this.updateInterval) return;

    this.updateInterval = setInterval(() => {
      if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
        // Send real-time updates to overlay
        const metrics = this.debugService.getSystemMetrics();
        const recentEvents = this.debugService.getRecentEvents(10);

        this.overlayWindow.webContents.send('debug:update', {
          metrics,
          events: recentEvents,
          timestamp: new Date()
        });
      }
    }, 1000); // Update every second
  }

  private stopUpdates(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  public updateConfig(newConfig: Partial<DebugOverlayConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    if (this.overlayWindow) {
      // Apply new config to existing window
      if (newConfig.opacity !== undefined) {
        this.overlayWindow.setOpacity(newConfig.opacity);
      }
      
      if (newConfig.alwaysOnTop !== undefined) {
        this.overlayWindow.setAlwaysOnTop(newConfig.alwaysOnTop);
      }
    }
  }

  public cleanup(): void {
    this.stopUpdates();
    
    if (this.overlayWindow) {
      this.overlayWindow.close();
    }

    // Unregister hotkeys
    globalShortcut.unregister(this.config.hotkey);
    
    console.log('Debug overlay manager cleaned up');
  }
}
