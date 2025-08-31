import { app, BrowserWindow, ipcMain } from 'electron';
// 🚀 gRPC Migration: Express/REST imports removed - using gRPC only
// import express from 'express';
// import cors from 'cors';
// import { createServer } from 'http';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createConnection } from 'net';

// Enable hot reload in development
if (process.env.NODE_ENV === 'development') {
  try {
    require('electron-reloader')(module);
    console.log('🔥 Hot reload enabled with electron-reloader!');
  } catch (_) {
    console.log('⚠️ Hot reload not available');
  }
}

import { HostService } from './services/host-service';
import { MDNSService } from './services/mdns-service';
import { DebugService } from './services/debug-service';
import { DisplayIdentifier } from './services/display-identifier';
import { DisplayMonitor } from './services/display-monitor';
import { GrpcService } from './services/grpc-service';
import { StateManager } from './services/state-manager';
import { AutoRestoreService } from './services/auto-restore-service';
import { WindowManager } from './managers/window-manager';
import { ConfigManager } from './managers/config-manager';
import { DebugOverlayManager } from './managers/debug-overlay-manager';
import { SystemTrayManager } from './managers/system-tray-manager';
import { CookieManager } from './managers/cookie-manager';
import { logger } from './utils/logger';

// Port availability check
function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createConnection({ port }, () => {
      server.end();
      resolve(false); // Port is in use
    });
    
    server.on('error', () => {
      resolve(true); // Port is available
    });
    
    // Timeout after 1 second
    setTimeout(() => {
      server.destroy();
      resolve(true);
    }, 1000);
  });
}

async function ensurePortAvailable(port: number): Promise<boolean> {
  const available = await isPortAvailable(port);
  if (!available) {
    console.error(`❌ Port ${port} is already in use!`);
    console.error('This could mean another instance is running or another service is using the port.');
    return false;
  }
  console.log(`✅ Port ${port} is available`);
  return true;
}

// Single instance lock mechanism
const LOCK_FILE_NAME = 'office-tv-host-agent.lock';
const lockFilePath = path.join(os.tmpdir(), LOCK_FILE_NAME);

function ensureSingleInstance(): boolean {
  try {
    // Check if lock file exists
    if (fs.existsSync(lockFilePath)) {
      // Read the PID from the lock file
      const lockContent = fs.readFileSync(lockFilePath, 'utf8');
      const pid = parseInt(lockContent.trim());
      
      // Check if the process is still running
      try {
        process.kill(pid, 0); // Signal 0 doesn't kill the process, just checks if it exists
        console.log(`🚫 Another instance is already running (PID: ${pid})`);
        
        // Try to force kill the existing instance
        try {
          console.log(`🔪 Attempting to force kill existing instance (PID: ${pid})...`);
          process.kill(pid, 'SIGKILL');
          
          // Wait a bit for the process to be killed
          setTimeout(() => {
            try {
              // Check if process is still running
              process.kill(pid, 0);
              console.log(`⚠️ Process ${pid} is still running after SIGKILL`);
            } catch (error) {
              console.log(`✅ Process ${pid} successfully terminated`);
              // Remove the lock file since the process is dead
              if (fs.existsSync(lockFilePath)) {
                fs.unlinkSync(lockFilePath);
                console.log('Lock file removed after killing existing instance');
              }
            }
          }, 1000);
          
          // Continue with this instance
          console.log('Proceeding with current instance...');
          return true;
        } catch (killError) {
          console.log(`❌ Failed to kill process ${pid}:`, killError);
          console.log('Attempting to continue anyway...');
          
          // Try to remove the lock file and continue
          try {
            if (fs.existsSync(lockFilePath)) {
              fs.unlinkSync(lockFilePath);
              console.log('Lock file removed, continuing with current instance');
            }
            return true;
          } catch (removeError) {
            console.log('Failed to remove lock file:', removeError);
            return false;
          }
        }
      } catch (error) {
        // Process is not running, remove stale lock file
        console.log('Removing stale lock file...');
        fs.unlinkSync(lockFilePath);
      }
    }
    
    // Create lock file with current PID
    fs.writeFileSync(lockFilePath, process.pid.toString());
    console.log(`✅ Single instance lock created (PID: ${process.pid})`);
    
    // Clean up lock file on exit
    process.on('exit', () => {
      try {
        if (fs.existsSync(lockFilePath)) {
          fs.unlinkSync(lockFilePath);
        }
      } catch (error) {
        // Ignore errors during cleanup
      }
    });
    
    // Also clean up on unexpected termination
    process.on('SIGINT', cleanupAndExit);
    process.on('SIGTERM', cleanupAndExit);
    process.on('SIGQUIT', cleanupAndExit);
    
    return true;
  } catch (error) {
    console.error('Error setting up single instance lock:', error);
    return false;
  }
}

function cleanupAndExit(): void {
  try {
    if (fs.existsSync(lockFilePath)) {
      fs.unlinkSync(lockFilePath);
      console.log('Lock file cleaned up');
    }
  } catch (error) {
    // Ignore cleanup errors
  }
  process.exit(0);
}

// Check if this is the only instance
if (!ensureSingleInstance()) {
  // If we get here, it means we couldn't resolve the single instance issue
  console.log('❌ Failed to resolve single instance issue');
  console.log('Exiting duplicate instance...');
  app.quit();
  process.exit(0);
}

class HostAgent {
  private hostService: HostService;
  private mdnsService: MDNSService;
  private debugService: DebugService;
  private displayIdentifier: DisplayIdentifier;
  private displayMonitor: DisplayMonitor;
  private grpcService: GrpcService;
  private stateManager: StateManager;
  private autoRestoreService: AutoRestoreService;
  private windowManager: WindowManager;
  private configManager: ConfigManager;
  private debugOverlayManager: DebugOverlayManager;
  private systemTrayManager: SystemTrayManager;
  private cookieManager: CookieManager;
  // 🚀 gRPC Migration: Express/REST server removed - using gRPC only
  // private expressApp: express.Application;
  // private server: any;
  
  constructor() {
    this.configManager = new ConfigManager();
    this.hostService = new HostService(this.configManager);
    this.mdnsService = new MDNSService(this.configManager);
    this.debugService = new DebugService(this.configManager);
    this.displayIdentifier = new DisplayIdentifier();
    this.displayMonitor = new DisplayMonitor();
    this.stateManager = new StateManager();
    this.windowManager = new WindowManager();
    
    // Set window manager reference for display identifier
    this.displayIdentifier.setWindowManager(this.windowManager);
    this.grpcService = new GrpcService(
      8082,
      this.hostService,
      this.windowManager,
      this.debugService,
      this.displayIdentifier,
      this.displayMonitor,
      this.mdnsService,
      this.configManager,
      this.stateManager
    );
    this.autoRestoreService = new AutoRestoreService(this.stateManager, this.windowManager);
    this.debugOverlayManager = new DebugOverlayManager(
      this.debugService,
      this.windowManager,
      this.configManager
    );
    this.systemTrayManager = new SystemTrayManager(this.configManager);
    this.cookieManager = new CookieManager();
    // 🚀 gRPC Migration: Express/REST API removed - using gRPC only
    // this.expressApp = express();
    // this.setupExpress();
    this.setupElectron();
    // setupDisplayMonitoring() moved to after app is ready
  }

  // 🚀 gRPC Migration: Express/REST API removed - using gRPC only
  private async setupExpress(): Promise<void> {
    console.log('⚠️ setupExpress() is deprecated - using gRPC only');
    return;
    
    /* REMOVED: REST API Server
    // Check if port is available before starting server
    const port = this.configManager.getApiPort();
    const portAvailable = await ensurePortAvailable(port);
    
    if (!portAvailable) {
      console.error(`Cannot start server - port ${port} is not available`);
      console.error('Please check if another instance is running or if another service is using this port');
      process.exit(1);
    }
    
    // Middleware
    this.expressApp.use(cors());
    this.expressApp.use(express.json());
    
    // Health check endpoint
    this.expressApp.get('/health', (req, res) => {
      res.json({
        success: true,
        data: {
          status: 'healthy',
          uptime: process.uptime(),
          version: this.configManager.getVersion(),
          timestamp: new Date()
        }
      });
    });
    
    // API routes
    const apiRouter = new ApiRouter(this.hostService, this.windowManager, this.debugService, this.displayIdentifier, this.displayMonitor, this.mdnsService, this.configManager, this.stateManager);
    this.expressApp.use('/api', apiRouter.getRouter());
    
    // Start server
    this.server = this.expressApp.listen(port, async () => {
      logger.success(`Host agent API server listening on port ${port}`);
    });
    */ 
  }

  // 🚀 NEW: Start gRPC service independently 
  private async startGrpcService(): Promise<void> {
    try {
      await this.grpcService.start();
      logger.success('✅ gRPC service started - no REST API needed');
    } catch (error) {
      logger.error('❌ Failed to start gRPC service:', error);
    }
  }

  private setupElectron(): void {
    // Configure app settings for system tray behavior
    if (process.platform === 'win32') {
      app.setAppUserModelId('com.vtex.office-display.host-agent');
      
      // Configure app to continue running in background
      app.commandLine.appendSwitch('--disable-background-timer-throttling');
      app.commandLine.appendSwitch('--disable-backgrounding-occluded-windows');
    }
    
    // Handle app ready
    app.whenReady().then(() => {
      logger.success('Electron app ready');
      
      // Initialize display monitor first (needs app to be ready)
      this.displayMonitor.initialize();
      
      // Initialize debug overlay manager (needs app to be ready)
      this.debugOverlayManager.initialize();
      
      // Initialize system tray (needs app to be ready)
      this.systemTrayManager.initialize();
      
      // Set up system tray callbacks
      this.systemTrayManager.setCallbacks({
        onRefreshDisplays: () => this.handleRefreshDisplays(),
        onShowDebugOverlay: () => this.handleToggleDebugOverlay(),
        onOpenCookieEditor: () => this.handleOpenCookieEditor()
      });
      
      // Update display configuration from system
      this.configManager.updateDisplaysFromSystem();
      
      // 🚀 Start gRPC service first
      this.startGrpcService();
      
      // Start mDNS service advertising
      this.mdnsService.startAdvertising();
      
      // Initialize window manager
      this.windowManager.initialize();
      
      // Listen for window manager events
      this.setupWindowManagerEvents();
      
      // Setup IPC handlers
      this.setupIPC();
      
      // Setup display monitoring after everything is initialized
      this.setupDisplayMonitoring();
      
      // Restore dashboards after a short delay to ensure everything is ready
      setTimeout(async () => {
        try {
          await this.autoRestoreService.restoreAllDashboards();
        } catch (error) {
          logger.error('Failed to restore dashboards on startup:', error);
        }
        
        // Update system tray with initial status
        this.updateSystemTrayStatus();
      }, 3000); // 3 second delay
    });

    // Handle all windows closed
    app.on('window-all-closed', () => {
      // On Windows/Linux, keep the app running even if all windows are closed
      // The host agent should continue running to serve API requests
      // System tray icon will remain visible
    });

    // Handle app activation (macOS)
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        // Don't create windows automatically
      }
    });

    // Handle app quit
    app.on('before-quit', () => {
      this.cleanup();
    });
  }

  private setupIPC(): void {
    // Handle window management commands
    ipcMain.handle('window:create', async (event, config) => {
      return await this.windowManager.createWindow(config);
    });

    ipcMain.handle('window:close', async (event, windowId) => {
      return await this.windowManager.closeWindow(windowId);
    });

    ipcMain.handle('window:navigate', async (event, windowId, url) => {
      return await this.windowManager.navigateWindow(windowId, url);
    });

    // Handle system status requests
    ipcMain.handle('system:status', async () => {
      return this.hostService.getSystemStatus();
    });

    // Handle display refresh requests
    ipcMain.handle('displays:refresh', async () => {
      logger.debug('IPC: Refreshing displays from system...');
      
      // Update configuration from system
      this.configManager.updateDisplaysFromSystem();
      
      // Refresh display statuses in host service
      this.hostService.refreshDisplayStatuses();
      
      return { success: true, message: 'Displays refreshed successfully' };
    });

    // Handle debug overlay IPC requests
    ipcMain.handle('debug:get-events', async () => {
      return this.debugService.getRecentEvents(100);
    });

    ipcMain.handle('debug:get-metrics', async () => {
      return this.debugService.getSystemMetrics();
    });

    ipcMain.handle('debug:clear-events', async () => {
      return this.debugService.clearEvents();
    });

    ipcMain.handle('debug:export-events', async (event, format) => {
      return this.debugService.exportEvents(format);
    });

    ipcMain.handle('debug:get-state', async () => {
      return {
        pinned: false,
        activeTab: 'events'
      };
    });

    ipcMain.handle('debug:toggle-pin', async () => {
      // Simple toggle for now
      return false;
    });

    ipcMain.handle('debug:set-tab', async (event, tab) => {
      // Simple tab setting for now
      return tab;
    });

    // Handle window control IPC requests
    ipcMain.handle('window:minimize', async () => {
      this.debugOverlayManager.hideOverlay();
      return true;
    });

    ipcMain.handle('window:maximize', async () => {
      // Find the cookie editor window
      if (this.cookieManager && (this.cookieManager as any).cookieWindow) {
        const window = (this.cookieManager as any).cookieWindow;
        if (!window.isDestroyed()) {
          if (window.isMaximized()) {
            window.unmaximize();
          } else {
            window.maximize();
          }
        }
      }
      return true;
    });

    // Handle debug overlay close
    ipcMain.handle('debug:close', async () => {
      this.debugOverlayManager.disable();
      return true;
    });

    // Handle cookie management IPC requests
    ipcMain.handle('get-all-cookies', async () => {
      return await this.cookieManager.getAllCookies();
    });

    ipcMain.handle('set-cookie', async (event, url, cookie) => {
      return await this.cookieManager.setCookie(url, cookie);
    });

    ipcMain.handle('remove-cookie', async (event, url, name) => {
      return await this.cookieManager.removeCookie(url, name);
    });

    ipcMain.handle('clear-all-cookies', async () => {
      return await this.cookieManager.clearAllCookies();
    });

    // Cookie editor window controls
    ipcMain.handle('cookie-editor:close', () => {
      this.cookieManager.close();
    });
  }

  private setupDisplayMonitoring(): void {
    // Start display monitoring
    this.displayMonitor.startMonitoring();
    
    // Listen for display changes and log to debug
    this.displayMonitor.on('display-change', (event) => {
      logger.info(`Display change detected: ${event.type} (${event.displays.length} total displays)`);
      
      // Update configuration when displays change
      this.configManager.updateDisplaysFromSystem();
      
      // Force refresh display statuses from system
      this.hostService.forceRefreshFromSystem();
      
      logger.debug('Configuration and display statuses updated after display change');
      
      // Update system tray status
      this.updateSystemTrayStatus();
      
      // Log to debug service
      this.debugService.logEvent('system_event', 'Display', `Display ${event.type}`, {
        displayCount: event.displays.length,
        changedDisplay: event.changedDisplay?.id,
        timestamp: event.timestamp
      });
      
      // Trigger dashboard restoration after display changes
      this.autoRestoreService.onDisplayChange();
      
      // 🚀 NEW: Broadcast display changes via gRPC streaming
      this.broadcastDisplaysChangedEvent(event);
    });

    // Listen for debug state changes (sync between hotkey and remote control)
    this.debugService.on('debug-state-changed', async (event) => {
      logger.debug(`Debug state synchronized: ${event.enabled ? 'ON' : 'OFF'} (via ${event.source})`);
      
      // Update overlay manager state to match debug service
      if (event.enabled && !this.debugOverlayManager.isEnabled()) {
        await this.debugOverlayManager.enable();
        
        // Log a test event to verify the overlay is working
        this.debugService.logEvent('system_event', 'Debug Overlay', 'Debug overlay enabled via hotkey', {
          source: event.source,
          timestamp: new Date(),
          test: true
        });
      } else if (!event.enabled && this.debugOverlayManager.isEnabled()) {
        this.debugOverlayManager.disable();
      }
    });
  }

  // 🚀 NEW: Broadcast display changes via gRPC streaming
  private broadcastDisplaysChangedEvent(displayChangeEvent: any): void {
    try {
      const grpcEvent = {
        event_id: `displays_changed_${Date.now()}`,
        type: 'DISPLAYS_CHANGED',
        timestamp: { 
          seconds: Math.floor(displayChangeEvent.timestamp.getTime() / 1000), 
          nanos: (displayChangeEvent.timestamp.getTime() % 1000) * 1000000
        },
        displays_changed: {
          displays: displayChangeEvent.displays.map(this.convertDisplayToGrpc.bind(this)),
          change_type: displayChangeEvent.type,
          changed_display: displayChangeEvent.changedDisplay ? 
            this.convertDisplayToGrpc(displayChangeEvent.changedDisplay) : undefined
        }
      };

      // Broadcast to all gRPC stream clients
      this.grpcService.broadcastEvent(grpcEvent);
      
      logger.info(`📡 gRPC: Broadcasted DISPLAYS_CHANGED event (${displayChangeEvent.type})`);
    } catch (error) {
      logger.error('Failed to broadcast display change event via gRPC:', error);
    }
  }

  private convertDisplayToGrpc(displayInfo: any): any {
    return {
      display_id: `display-${displayInfo.id}`,
      electron_id: displayInfo.id,
      bounds: {
        x: displayInfo.bounds.x,
        y: displayInfo.bounds.y,
        width: displayInfo.bounds.width,
        height: displayInfo.bounds.height
      },
      work_area: {
        x: displayInfo.workArea.x,
        y: displayInfo.workArea.y,
        width: displayInfo.workArea.width,
        height: displayInfo.workArea.height
      },
      primary: displayInfo.isPrimary,
      scale_factor: displayInfo.scaleFactor,
      name: displayInfo.name || `Display ${displayInfo.id}`
    };
  }

  private setupWindowManagerEvents(): void {
    // Listen for window created/closed events
    this.windowManager.on('window-created', (event) => {
      logger.debug(`Window created: ${event.windowId}, total: ${event.totalWindows}`);
      this.updateSystemTrayStatus();
    });

    this.windowManager.on('window-closed', (event) => {
      logger.debug(`Window closed: ${event.windowId}, total: ${event.totalWindows}`);
      this.updateSystemTrayStatus();
    });
  }

  private updateSystemTrayStatus(): void {
    try {
      const displays = this.configManager.getDisplays();
      const systemStatus = this.hostService.getSystemStatus();
      const activeWindows = this.windowManager.getAllWindows().length;
      
      this.systemTrayManager.updateStatus({
        connected: true, // We're running, so we're connected
        totalDisplays: displays.length,
        activeWindows: activeWindows
      });
    } catch (error) {
      logger.error('Failed to update system tray status:', error);
    }
  }

  private handleRefreshDisplays(): void {
    logger.info('Refreshing displays from system tray request');
    
    // Update configuration from system
    this.configManager.updateDisplaysFromSystem();
    
    // Refresh display statuses in host service
    this.hostService.refreshDisplayStatuses();
    
    // Update system tray status
    this.updateSystemTrayStatus();
    
    logger.success('Displays refreshed successfully from system tray');
  }

  private handleToggleDebugOverlay(): void {
    logger.info('Toggling debug overlay from system tray request');
    
    try {
      if (this.debugOverlayManager.isEnabled()) {
        this.debugOverlayManager.disable();
      } else {
        this.debugOverlayManager.enable();
      }
    } catch (error) {
      logger.error('Failed to toggle debug overlay:', error);
    }
  }

  private async handleOpenCookieEditor(): Promise<void> {
    logger.info('Opening cookie editor from system tray request');
    
    try {
      await this.cookieManager.openCookieEditor();
    } catch (error) {
      logger.error('Failed to open cookie editor:', error);
    }
  }

  private cleanup(): void {
    logger.info('Cleaning up host agent...');
    
    // Cleanup display monitor
    if (this.displayMonitor) {
      this.displayMonitor.cleanup();
    }
    
    // Cleanup debug overlay
    if (this.debugOverlayManager) {
      this.debugOverlayManager.cleanup();
    }
    
    // Cleanup system tray
    if (this.systemTrayManager) {
      this.systemTrayManager.cleanup();
    }
    
    // Cleanup cookie manager
    if (this.cookieManager) {
      this.cookieManager.close();
    }
    
    // Cleanup display identifier
    if (this.displayIdentifier) {
      this.displayIdentifier.cleanup();
    }
    
    // Stop mDNS advertising
    if (this.mdnsService) {
      this.mdnsService.stopAdvertising();
    }
    
    // Close all managed windows
    if (this.windowManager) {
      this.windowManager.closeAllWindows();
    }
    

    // Stop gRPC service
    if (this.grpcService) {
      this.grpcService.stop();
    }
    
    // Cleanup state manager
    if (this.stateManager) {
      this.stateManager.cleanup();
    }
    
    // Express server removed - using gRPC only
    // Server cleanup is handled by gRPC service
  }

  public start(): void {
    logger.system('Starting Office TV Host Agent...');
    logger.info(`Agent ID: ${this.configManager.getAgentId()}`);
    logger.info(`Version: ${this.configManager.getVersion()}`);
    logger.info('Debug Mode: Press Ctrl+Shift+D to toggle debug overlay');
  }
}

// Initialize and start the host agent
const hostAgent = new HostAgent();
hostAgent.start();
