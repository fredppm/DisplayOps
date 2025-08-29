import { app, BrowserWindow, ipcMain } from 'electron';
import { join } from 'path';
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import BonjourService from 'bonjour-service';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createConnection } from 'net';

import { HostService } from './services/host-service';
import { MDNSService } from './services/mdns-service';
import { DebugService } from './services/debug-service';
import { DisplayIdentifier } from './services/display-identifier';
import { DisplayMonitor } from './services/display-monitor';
import { ApiRouter } from './routes/api-router';
import { WindowManager } from './managers/window-manager';
import { ConfigManager } from './managers/config-manager';
import { DebugOverlayManager } from './managers/debug-overlay-manager';

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
        console.log('Focusing existing instance...');
        
        // Try to focus existing instance by sending a custom event
        // This will be handled by the existing instance
        return false;
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
  // Another instance is running, exit this one
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
  private windowManager: WindowManager;
  private configManager: ConfigManager;
  private debugOverlayManager: DebugOverlayManager;
  private expressApp: express.Application;
  private server: any;
  
  constructor() {
    this.configManager = new ConfigManager();
    this.hostService = new HostService(this.configManager);
    this.mdnsService = new MDNSService(this.configManager);
    this.debugService = new DebugService(this.configManager);
    this.displayIdentifier = new DisplayIdentifier();
    this.displayMonitor = new DisplayMonitor();
    this.windowManager = new WindowManager();
    this.debugOverlayManager = new DebugOverlayManager(
      this.debugService,
      this.windowManager,
      this.configManager
    );
    this.expressApp = express();
    
    this.setupExpress();
    this.setupElectron();
    // setupDisplayMonitoring() moved to after app is ready
  }

  private async setupExpress(): Promise<void> {
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
    const apiRouter = new ApiRouter(this.hostService, this.windowManager, this.debugService, this.displayIdentifier, this.displayMonitor, this.mdnsService, this.configManager);
    this.expressApp.use('/api', apiRouter.getRouter());
    
    // Start server
    this.server = this.expressApp.listen(port, () => {
      console.log(`Host agent API server listening on port ${port}`);
    });
  }

  private setupElectron(): void {
    // Handle app ready
    app.whenReady().then(() => {
      console.log('Electron app ready');
      
      // Initialize display monitor first (needs app to be ready)
      this.displayMonitor.initialize();
      
      // Initialize debug overlay manager (needs app to be ready)
      this.debugOverlayManager.initialize();
      
      // Update display configuration from system
      this.configManager.updateDisplaysFromSystem();
      
      // Start mDNS service advertising
      this.mdnsService.startAdvertising();
      
      // Initialize window manager
      this.windowManager.initialize();
      
      // Setup IPC handlers
      this.setupIPC();
      
      // Setup display monitoring after everything is initialized
      this.setupDisplayMonitoring();
    });

    // Handle all windows closed
    app.on('window-all-closed', () => {
      // On Windows/Linux, keep the app running even if all windows are closed
      // The host agent should continue running to serve API requests
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
      console.log('🔄 IPC: Refreshing displays from system...');
      
      // Update configuration from system
      this.configManager.updateDisplaysFromSystem();
      
      // Refresh display statuses in host service
      this.hostService.refreshDisplayStatuses();
      
      return { success: true, message: 'Displays refreshed successfully' };
    });
  }

  private setupDisplayMonitoring(): void {
    // Start display monitoring
    this.displayMonitor.startMonitoring();
    
    // Listen for display changes and log to debug
    this.displayMonitor.on('display-change', (event) => {
      console.log(`🖥️ Display change detected: ${event.type}`);
      console.log(`   Total displays: ${event.displays.length}`);
      
      // Update configuration when displays change
      this.configManager.updateDisplaysFromSystem();
      
      // Force refresh display statuses from system
      this.hostService.forceRefreshFromSystem();
      
      console.log(`🔄 Configuration and display statuses updated after display change`);
      
      // Log to debug service
      this.debugService.logEvent('system_event', 'Display', `Display ${event.type}`, {
        displayCount: event.displays.length,
        changedDisplay: event.changedDisplay?.id,
        timestamp: event.timestamp
      });
      
      // Could broadcast to connected web controllers via WebSocket here
      // For now, they can poll the /api/displays endpoint
    });

    // Listen for debug state changes (sync between hotkey and remote control)
    this.debugService.on('debug-state-changed', (event) => {
      console.log(`🔄 Debug state synchronized: ${event.enabled ? 'ON' : 'OFF'} (via ${event.source})`);
      
      // Update overlay manager state to match debug service
      if (event.enabled && !this.debugOverlayManager.isEnabled()) {
        this.debugOverlayManager.enable();
      } else if (!event.enabled && this.debugOverlayManager.isEnabled()) {
        this.debugOverlayManager.disable();
      }
    });
  }

  private cleanup(): void {
    console.log('Cleaning up host agent...');
    
    // Cleanup display monitor
    if (this.displayMonitor) {
      this.displayMonitor.cleanup();
    }
    
    // Cleanup debug overlay
    if (this.debugOverlayManager) {
      this.debugOverlayManager.cleanup();
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
    
    // Close Express server
    if (this.server) {
      this.server.close(() => {
        console.log('Express server closed');
      });
    }
  }

  public start(): void {
    console.log('Starting Office TV Host Agent...');
    console.log('Agent ID:', this.configManager.getAgentId());
    console.log('Version:', this.configManager.getVersion());
    console.log('Debug Mode: Press Ctrl+Shift+D to toggle debug overlay');
  }
}

// Initialize and start the host agent
const hostAgent = new HostAgent();
hostAgent.start();
