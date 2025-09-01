import { BrowserWindow, globalShortcut, screen } from 'electron';
import { join } from 'path';
import { DebugService } from '../services/debug-service';
import { WindowManager } from './window-manager';
import { ConfigManager } from './config-manager';
import { DebugOverlayConfig, DebugOverlayState } from '../types/debug-types';
import fs from 'fs';
import { logger } from '../utils/logger';

export class DebugOverlayManager {
  private overlayWindow: BrowserWindow | null = null;
  private debugService: DebugService;
  private windowManager: WindowManager;
  private configManager: ConfigManager;
  private config: DebugOverlayConfig;
  private state: DebugOverlayState;
  private updateInterval: NodeJS.Timeout | null = null;
  private fileWatcher: fs.FSWatcher | null = null;

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
      position: 'right',
      opacity: 1,
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
    try {
      if (this.overlayWindow) {
        this.overlayWindow.focus();
        return;
      }

      logger.debug('Creating debug overlay...');

      // Get cursor position to determine which display to use
      const cursorPoint = screen.getCursorScreenPoint();
      const currentDisplay = screen.getDisplayNearestPoint(cursorPoint);
      const { x: displayX, y: displayY, width: screenWidth, height: screenHeight } = currentDisplay.workArea;

      // Position window on the right side of the current display
      const x = displayX + screenWidth - 400;
      const y = displayY;

      logger.debug(`Positioning overlay to cover entire screen: x=${x}, y=${y}`);

      this.overlayWindow = new BrowserWindow({
        width: 400,
        height: screenHeight,
        x,
        y,
        frame: false,
        transparent: true,
        skipTaskbar: true,
        resizable: false,
        minimizable: false,
        maximizable: false,
        closable: true,
        alwaysOnTop: true,
        focusable: true,
        opacity: this.config.opacity,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          preload: join(__dirname, '../preload/debug-preload.js'),
          webSecurity: false
        }
      });

      logger.debug('BrowserWindow created successfully');

      // Load the debug overlay HTML
      // Try multiple paths to handle both development and production
      let debugOverlayPath: string;
      let htmlFileFound = false;
      
      // First try the compiled path
      debugOverlayPath = join(__dirname, '../renderer/debug-overlay.html');
      
      if (require('fs').existsSync(debugOverlayPath)) {
        htmlFileFound = true;
      } else {
        // If that doesn't exist, try the source path (for development)
        debugOverlayPath = join(__dirname, '../../src/renderer/debug-overlay.html');
        
        if (require('fs').existsSync(debugOverlayPath)) {
          htmlFileFound = true;
        } else {
          // If still doesn't exist, try the current working directory
          debugOverlayPath = join(process.cwd(), 'src/renderer/debug-overlay.html');
          
          if (require('fs').existsSync(debugOverlayPath)) {
            htmlFileFound = true;
          }
        }
      }
      
      if (!htmlFileFound) {
        throw new Error(`Debug overlay HTML file not found. Tried all paths. Current __dirname: ${__dirname}`);
      }
      
      logger.debug(`Loading HTML file: ${debugOverlayPath}`);
      
      // Check if the window is still valid before loading
      if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
        await this.overlayWindow.loadFile(debugOverlayPath);
        logger.debug('HTML file loaded successfully');
      } else {
        throw new Error('BrowserWindow was destroyed before loading HTML');
      }

      // Handle window events
      this.overlayWindow.on('closed', () => {
        logger.debug('Debug overlay closed');
        this.overlayWindow = null;
        this.state.visible = false;
        this.stopUpdates();
        this.stopFileWatching();
      });

      this.overlayWindow.on('blur', () => {
        if (!this.state.pinned) {
          this.overlayWindow?.setOpacity(0.9);
        }
      });

      this.overlayWindow.on('focus', () => {
        this.overlayWindow?.setOpacity(this.config.opacity);
      });

      // Setup IPC handlers for the overlay
      this.setupOverlayIPC();

      this.state.visible = true;
      this.startUpdates();
      this.startFileWatching();

      logger.success('Debug overlay created successfully!');
      
    } catch (error) {
      logger.critical('Failed to create debug overlay:', error);
      
      // Clean up if there was an error
      if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
        this.overlayWindow.close();
        this.overlayWindow = null;
      }
      
      this.state.visible = false;
      this.stopUpdates();
      this.stopFileWatching();
      
      // Re-throw the error so the caller knows something went wrong
      throw error;
    }
  }

  public hideOverlay(): void {
    if (this.overlayWindow) {
      this.overlayWindow.hide();
      this.state.visible = false;
      this.stopUpdates();
      this.stopFileWatching();
    }
  }

  public showOverlay(): void {
    if (this.overlayWindow) {
      this.overlayWindow.show();
      this.overlayWindow.focus();
      this.state.visible = true;
      this.startUpdates();
      this.startFileWatching();
    }
  }

  public async toggleOverlay(): Promise<void> {
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
      await this.createOverlay();
    }

    // Notify that debug state was toggled via hotkey
    const newState = this.debugService.toggleFromHotkey();
    logger.info(`Debug toggled via hotkey: ${newState ? 'ENABLED' : 'DISABLED'}`);
  }

  public async enable(): Promise<void> {
    this.config.enabled = true;
    this.debugService.enableFromHotkey();
    await this.createOverlay();
    
    logger.success('Debug overlay enabled - Press Ctrl+Shift+D to toggle');
  }

  public disable(): void {
    this.config.enabled = false;
    this.debugService.disableFromHotkey();
    
    if (this.overlayWindow) {
      this.overlayWindow.close();
    }
    
    this.stopUpdates();
    this.stopFileWatching();
    logger.info('Debug overlay disabled');
  }

  public isEnabled(): boolean {
    return this.config.enabled;
  }

  private setupHotkeys(): void {
    globalShortcut.register(this.config.hotkey, async () => {
      try {
        await this.toggleOverlay();
      } catch (error) {
        logger.error('Failed to toggle overlay via hotkey:', error);
      }
    });

    // Adicionar ESC para fechar o overlay
    globalShortcut.register('Escape', () => {
      if (this.state.visible && this.overlayWindow && this.overlayWindow.isFocused()) {
        this.hideOverlay();
      }
    });
  }

  private setupOverlayIPC(): void {
    if (!this.overlayWindow) return;

    // NOTA: Os handlers IPC para debug (getEvents, getMetrics, etc.) 
    // são gerenciados pelo main process (main.ts) via contextBridge
    // Aqui só configuramos handlers básicos de controle de janela
    
    logger.debug('Basic IPC handlers configured for overlay');
  }

  private startUpdates(): void {
    if (this.updateInterval) return;

    logger.debug('Starting real-time updates for overlay...');

    this.updateInterval = setInterval(() => {
      if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
        // Send real-time updates to overlay
        const metrics = this.debugService.getSystemMetrics();
        const recentEvents = this.debugService.getRecentEvents(10);

        // Only log updates if there are significant changes or errors
        if (recentEvents.some(event => event.type === 'error')) {
          logger.warn(`Sending update to overlay: ${recentEvents.length} events, ${recentEvents.filter(e => e.type === 'error').length} errors`);
        }

        this.overlayWindow.webContents.send('debug:update', {
          metrics,
          events: recentEvents,
          timestamp: new Date()
        });
      }
    }, 1000); // Update every second

    logger.debug('Real-time updates started');
  }

  private stopUpdates(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  private startFileWatching(): void {
    if (this.fileWatcher) return;

    try {
      // Watch the source renderer directory for changes (not the compiled one)
      const rendererPath = join(process.cwd(), 'src/renderer');
      logger.debug(`Watching renderer files for changes: ${rendererPath}`);
      
      this.fileWatcher = fs.watch(rendererPath, { recursive: true }, (eventType, filename) => {
        if (filename && this.overlayWindow && !this.overlayWindow.isDestroyed()) {
          logger.debug(`Renderer file changed: ${filename}, reloading...`);
          this.overlayWindow.webContents.reload();
        }
      });
      
      logger.debug('File watcher started for renderer hot reload');
    } catch (error) {
      logger.error('Failed to start file watcher:', error);
    }
  }

  private stopFileWatching(): void {
    if (this.fileWatcher) {
      this.fileWatcher.close();
      this.fileWatcher = null;
      logger.debug('File watcher stopped');
    }
  }

  public updateConfig(newConfig: Partial<DebugOverlayConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    if (this.overlayWindow) {
      // Apply new config to existing window
      if (newConfig.opacity !== undefined) {
        this.overlayWindow.setOpacity(newConfig.opacity);
      }
    }
  }

  /**
   * Ajusta a opacidade da janela de debug
   * @param opacity Valor entre 0.1 (10%) e 1.0 (100%)
   */
  public setOpacity(opacity: number): void {
    // Garantir que a opacidade esteja entre 0.1 e 1.0
    const clampedOpacity = Math.max(0.1, Math.min(1.0, opacity));
    
    this.config.opacity = clampedOpacity;
    
    if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
      this.overlayWindow.setOpacity(clampedOpacity);
      logger.debug(`Debug overlay opacity adjusted to: ${Math.round(clampedOpacity * 100)}%`);
    }
  }

  /**
   * Ajusta a opacidade quando a janela não tem foco
   * @param opacity Valor entre 0.1 (10%) e 1.0 (100%)
   */
  public setBlurOpacity(opacity: number): void {
    // Garantir que a opacidade esteja entre 0.1 e 1.0
    const clampedOpacity = Math.max(0.1, Math.min(1.0, opacity));
    
    // Atualizar o evento de blur para usar a nova opacidade
    if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
      this.overlayWindow.removeAllListeners('blur');
      this.overlayWindow.on('blur', () => {
        if (!this.state.pinned) {
          this.overlayWindow?.setOpacity(clampedOpacity);
        }
      });
      logger.debug(`Blur opacity adjusted to: ${Math.round(clampedOpacity * 100)}%`);
    }
  }

  public cleanup(): void {
    this.stopUpdates();
    this.stopFileWatching();
    
    if (this.overlayWindow) {
      this.overlayWindow.close();
    }

    // Unregister hotkeys
    globalShortcut.unregister(this.config.hotkey);
    globalShortcut.unregister('Escape');
    
    logger.debug('Debug overlay manager cleaned up');
  }
}
