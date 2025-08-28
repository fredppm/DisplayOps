import { app, BrowserWindow, ipcMain } from 'electron';
import { join } from 'path';
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import BonjourService from 'bonjour-service';

import { HostService } from './services/host-service';
import { MDNSService } from './services/mdns-service';
import { ApiRouter } from './routes/api-router';
import { WindowManager } from './managers/window-manager';
import { ConfigManager } from './managers/config-manager';

class HostAgent {
  private hostService: HostService;
  private mdnsService: MDNSService;
  private windowManager: WindowManager;
  private configManager: ConfigManager;
  private expressApp: express.Application;
  private server: any;
  
  constructor() {
    this.configManager = new ConfigManager();
    this.hostService = new HostService(this.configManager);
    this.mdnsService = new MDNSService(this.configManager);
    this.windowManager = new WindowManager();
    this.expressApp = express();
    
    this.setupExpress();
    this.setupElectron();
  }

  private setupExpress(): void {
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
    const apiRouter = new ApiRouter(this.hostService, this.windowManager);
    this.expressApp.use('/api', apiRouter.getRouter());
    
    // Start server
    const port = this.configManager.getApiPort();
    this.server = this.expressApp.listen(port, () => {
      console.log(`Host agent API server listening on port ${port}`);
    });
  }

  private setupElectron(): void {
    // Handle app ready
    app.whenReady().then(() => {
      console.log('Electron app ready');
      
      // Start mDNS service advertising
      this.mdnsService.startAdvertising();
      
      // Initialize window manager
      this.windowManager.initialize();
      
      // Setup IPC handlers
      this.setupIPC();
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
  }

  private cleanup(): void {
    console.log('Cleaning up host agent...');
    
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
  }
}

// Initialize and start the host agent
const hostAgent = new HostAgent();
hostAgent.start();
