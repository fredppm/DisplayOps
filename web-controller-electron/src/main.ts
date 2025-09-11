import { app, BrowserWindow, Tray, Menu, shell, dialog, ipcMain, MenuItem } from 'electron';
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import log from 'electron-log';
import { autoUpdater } from 'electron-updater';
import AutoLaunch from 'auto-launch';
import { AutoUpdaterService } from './auto-updater';
import { ConfigManager } from './config-manager';
import { SetupDialog } from './setup-dialog';

// Configure logging
log.transports.file.level = 'info';
log.transports.console.level = 'debug';

class DisplayOpsController {
  private mainWindow: BrowserWindow | null = null;
  private consoleWindow: BrowserWindow | null = null;
  private tray: Tray | null = null;
  private nextServer: ChildProcess | null = null;
  private serverPort: number = 3000;
  private serverReady: boolean = false;
  private autoLauncher: AutoLaunch;
  private autoUpdaterService: AutoUpdaterService;
  private configManager: ConfigManager;
  private setupDialog: SetupDialog;
  private serverLogs: string[] = [];
  private consoleUpdateTimeout: NodeJS.Timeout | null = null;

  constructor() {
    this.autoLauncher = new AutoLaunch({
      name: 'DisplayOps Controller',
      path: process.execPath,
    });

    this.configManager = new ConfigManager();
    this.autoUpdaterService = new AutoUpdaterService();
    this.setupDialog = new SetupDialog(this.configManager, () => this.autoLauncher.isEnabled());
    this.setupApp();
  }

  private setupApp(): void {
    // Handle app events
    app.whenReady().then(() => this.onReady());
    app.on('window-all-closed', this.onWindowAllClosed.bind(this));
    app.on('activate', this.onActivate.bind(this));
    app.on('before-quit', this.onBeforeQuit.bind(this));

    // Prevent multiple instances
    const gotTheLock = app.requestSingleInstanceLock();
    if (!gotTheLock) {
      app.quit();
      return;
    }

    app.on('second-instance', () => {
      if (this.mainWindow) {
        if (this.mainWindow.isMinimized()) this.mainWindow.restore();
        this.mainWindow.focus();
      } else {
        this.showMainWindow();
      }
    });

    // Auto-updater is configured in AutoUpdaterService
    
    // Setup IPC handlers for console window controls
    this.setupConsoleIpcHandlers();
  }
  
  private setupConsoleIpcHandlers(): void {
    ipcMain.handle('console-minimize', () => {
      if (this.consoleWindow) {
        this.consoleWindow.minimize();
      }
    });
    
    ipcMain.handle('console-maximize', () => {
      if (this.consoleWindow) {
        if (this.consoleWindow.isMaximized()) {
          this.consoleWindow.unmaximize();
        } else {
          this.consoleWindow.maximize();
        }
      }
    });
    
    ipcMain.handle('console-close', () => {
      if (this.consoleWindow) {
        this.consoleWindow.close();
      }
    });
  }

  private async onReady(): Promise<void> {
    log.info('App is ready, starting DisplayOps Controller...');
    
    // Create a hidden main window to keep the process alive
    this.createMainWindow();
    if (this.mainWindow) {
      this.mainWindow.hide();
    }
    
    // Check if this is first run
    if (this.configManager.isFirstRun()) {
      log.info('First run detected, showing setup dialog...');
      try {
        const config = await this.setupDialog.showSetupDialog();
        this.serverPort = config.serverPort;
        log.info('Setup completed with config:', config);
        
        // Now start server with chosen configuration
        await this.startNextServer();
      } catch (error) {
        log.error('Setup dialog failed:', error);
        // Use defaults if setup fails
        this.serverPort = 3000;
        await this.startNextServer();
      }
    } else {
      // Load saved configuration
      const config = this.configManager.loadConfig();
      this.serverPort = config.serverPort;
      log.info('Loaded saved configuration:', config);
      
      // Start server with saved configuration (in background)
      this.startNextServer().catch(error => {
        log.error('Failed to start server:', error);
      });
    }
    
    // Create tray after everything is initialized
    this.createTray();
    
    // Check for updates after startup
    setTimeout(() => {
      this.autoUpdaterService.checkForUpdates();
    }, 5000); // Wait 5 seconds after startup
    
    // Don't show window initially - run in background
    // this.createMainWindow();

    log.info('DisplayOps Controller started successfully');
  }

  private onWindowAllClosed(): void {
    // Keep app running even when all windows are closed (system tray app)
    // Don't quit on macOS unless explicitly requested
  }

  private onActivate(): void {
    // Don't create windows - this is a tray-only app
  }

  private quitApplication(): void {
    log.info('Quit requested from tray menu...');
    (app as any).isQuiting = true;
    
    // Force cleanup and quit
    this.cleanup().then(() => {
      app.quit();
    }).catch((error) => {
      log.error('Error during cleanup:', error);
      app.quit(); // Force quit even if cleanup fails
    });
  }

  private async onBeforeQuit(): Promise<void> {
    log.info('App is quitting, cleaning up...');
    await this.cleanup();
  }

  private async cleanup(): Promise<void> {
    log.info('Starting cleanup...');
    
    if (this.nextServer) {
      log.info('Stopping Next.js server...');
      this.nextServer.kill('SIGTERM');
      
      // Give it a moment to gracefully shut down
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      if (this.nextServer && !this.nextServer.killed) {
        log.info('Force killing Next.js server...');
        this.nextServer.kill('SIGKILL');
      }
      this.nextServer = null;
    }
    
    if (this.tray) {
      log.info('Destroying tray...');
      this.tray.destroy();
      this.tray = null;
    }
    
    if (this.consoleWindow) {
      log.info('Closing console window...');
      this.consoleWindow.close();
      this.consoleWindow = null;
    }
    
    if (this.consoleUpdateTimeout) {
      clearTimeout(this.consoleUpdateTimeout);
      this.consoleUpdateTimeout = null;
    }
    
    log.info('Cleanup completed');
  }

  private async startNextServer(): Promise<void> {
    return new Promise((resolve, reject) => {
      log.info('Starting embedded Next.js server...');
      
      const webControllerPath = this.getWebControllerPath();
      const isProduction = app.isPackaged || process.env.NODE_ENV === 'production' || !webControllerPath.includes('node_modules');
      
      log.info(`Debug - app.isPackaged: ${app.isPackaged}`);
      log.info(`Debug - NODE_ENV: ${process.env.NODE_ENV}`);
      log.info(`Debug - webControllerPath: ${webControllerPath}`);
      log.info(`Debug - isProduction: ${isProduction}`);
      
      if (!fs.existsSync(webControllerPath)) {
        const error = `Web controller path not found: ${webControllerPath}`;
        log.error(error);
        reject(new Error(error));
        return;
      }

      // Find available port starting from configured port
      this.findAvailablePort(this.serverPort).then(port => {
        if (port !== this.serverPort) {
          log.info(`Configured port ${this.serverPort} unavailable, using ${port}`);
          this.serverPort = port;
        }
        process.env.PORT = port.toString();
        
        // Use configured hostname
        const config = this.configManager.loadConfig();
        process.env.HOSTNAME = config.hostname;

        // Always use the standalone server.js to avoid npm/next dependency issues
        const serverPath = path.join(webControllerPath, 'server.js');
        const command = process.execPath; // Always use bundled Node.js
        const args = [serverPath];

        log.info(`Starting server on port ${port} at ${webControllerPath}`);
        log.info(`Command: ${command} ${args.join(' ')}`);
        
        this.addToServerLog(`🚀 Starting Next.js server on port ${port}`, 'info');
        this.addToServerLog(`📁 Working directory: ${webControllerPath}`, 'info');
        this.addToServerLog(`⚡ Command: ${command} ${args.join(' ')}`, 'info');

        this.nextServer = spawn(command, args, {
          cwd: webControllerPath,
          stdio: ['ignore', 'pipe', 'pipe'],
          shell: false, // Don't use shell to avoid path escaping issues
          env: {
            ...process.env,
            NODE_ENV: isProduction ? 'production' : 'development',
            PORT: port.toString(),
            HOSTNAME: '0.0.0.0'
          }
        });

        let startupTimeout: NodeJS.Timeout | null = null;

        this.nextServer.stdout?.on('data', (data) => {
          const output = data.toString().trim();
          if (output) {
            log.info(`Next.js stdout: ${output}`);
            this.addToServerLog(output, 'info');
          }
          
          // Check if server is ready
          if (output.includes('Ready on') || output.includes('started server on') || output.includes('Ready in')) {
            if (!this.serverReady) {
              this.serverReady = true;
              if (startupTimeout) {
                clearTimeout(startupTimeout);
              }
              log.info('Next.js server is ready');
              this.addToServerLog('✅ Server is ready and accepting connections', 'success');
              resolve();
            }
          }
        });

        this.nextServer.stderr?.on('data', (data) => {
          const output = data.toString().trim();
          if (output) {
            log.error(`Next.js stderr: ${output}`);
            this.addToServerLog(output, 'error');
          }
        });

        this.nextServer.on('close', (code) => {
          log.warn(`Next.js server exited with code ${code}`);
          this.addToServerLog(`❌ Server exited with code ${code}`, 'error');
          this.serverReady = false;
        });

        this.nextServer.on('error', (error) => {
          log.error('Failed to start Next.js server:', error);
          this.addToServerLog(`❌ Failed to start server: ${error.message}`, 'error');
          if (startupTimeout) {
            clearTimeout(startupTimeout);
          }
          reject(error);
        });

        // Timeout after 30 seconds
        startupTimeout = setTimeout(() => {
          if (!this.serverReady) {
            log.error('Next.js server startup timeout');
            reject(new Error('Server startup timeout'));
          }
        }, 30000);
      });
    });
  }

  private getWebControllerPath(): string {
    if (app.isPackaged) {
      // In production, look for the embedded web-controller
      return path.join(process.resourcesPath, 'web-controller');
    } else {
      // In development, use the relative path
      return path.join(__dirname, '..', '..', 'web-controller');
    }
  }

  private async findAvailablePort(startPort: number): Promise<number> {
    const net = require('net');
    
    return new Promise((resolve, reject) => {
      const server = net.createServer();
      
      server.listen(startPort, '0.0.0.0', () => {
        const port = server.address()?.port;
        server.close(() => {
          if (port) {
            resolve(port);
          } else {
            reject(new Error('Could not determine port'));
          }
        });
      });
      
      server.on('error', () => {
        // Try next port
        this.findAvailablePort(startPort + 1).then(resolve).catch(reject);
      });
    });
  }

  private createTray(): void {
    log.info('Creating system tray...');
    const trayIconPath = this.getTrayIconPath();
    log.info(`Looking for tray icon at: ${trayIconPath}`);
    
    if (!fs.existsSync(trayIconPath)) {
      log.warn(`Tray icon not found: ${trayIconPath}`);
      return;
    }

    this.tray = new Tray(trayIconPath);
    
    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Open Interface',
        click: () => this.openInBrowser()
      },
      {
        label: 'Show Console',
        click: () => this.showConsoleWindow()
      },
      { type: 'separator' },
      {
        label: `Server: localhost:${this.serverPort}`,
        enabled: false
      },
      {
        label: `Network: ${this.getNetworkIP()}:${this.serverPort}`,
        enabled: false
      },
      { type: 'separator' },
      {
        label: 'Start with System',
        type: 'checkbox',
        checked: false,
        click: (menuItem: MenuItem) => this.toggleAutoStart(menuItem.checked)
      },
      {
        label: 'Reconfigure Server',
        click: () => this.showReconfigureDialog()
      },
      { type: 'separator' },
      {
        label: 'Check for Updates',
        click: () => this.autoUpdaterService.manualCheckForUpdates()
      },
      {
        label: 'About',
        click: () => this.showAbout()
      },
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => this.quitApplication()
      }
    ]);

    this.tray.setContextMenu(contextMenu);
    this.tray.setToolTip('DisplayOps Controller');
    
    this.tray.on('double-click', () => {
      this.openInBrowser();
    });

    // Check initial auto-start status
    this.checkAutoStartStatus();
  }

  private getTrayIconPath(): string {
    // Use smaller icon for system tray (32x32 is ideal)
    const iconName = process.platform === 'win32' ? 'icon-32.png' : 
                    process.platform === 'darwin' ? 'icon-32.png' : 'icon-32.png';
    
    if (app.isPackaged) {
      return path.join(process.resourcesPath, 'assets', iconName);
    } else {
      return path.join(__dirname, '..', 'assets', iconName);
    }
  }

  private openInBrowser(): void {
    const url = `http://localhost:${this.serverPort}`;
    log.info(`Opening browser: ${url}`);
    shell.openExternal(url);
  }

  private showMainWindow(): void {
    if (this.mainWindow) {
      this.mainWindow.show();
      this.mainWindow.focus();
      return;
    }

    this.createMainWindow();
  }

  private createMainWindow(): void {
    this.mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        webSecurity: true
      },
      icon: this.getTrayIconPath(),
      title: 'DisplayOps Controller'
    });

    const url = `http://localhost:${this.serverPort}`;
    this.mainWindow.loadURL(url);

    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
    });

    // Hide to tray instead of closing
    this.mainWindow.on('close', (event) => {
      if (!(app as any).isQuiting) {
        event.preventDefault();
        this.mainWindow?.hide();
      }
    });
  }

  private getNetworkIP(): string {
    const interfaces = os.networkInterfaces();
    
    for (const name of Object.keys(interfaces)) {
      const nets = interfaces[name];
      if (nets) {
        for (const net of nets) {
          if (net.family === 'IPv4' && !net.internal) {
            return net.address;
          }
        }
      }
    }
    
    return 'localhost';
  }

  private async checkAutoStartStatus(): Promise<void> {
    try {
      const isEnabled = await this.autoLauncher.isEnabled();
      this.updateAutoStartMenuItem(isEnabled);
    } catch (error) {
      log.error('Error checking auto-start status:', error);
    }
  }

  private async toggleAutoStart(enabled: boolean): Promise<void> {
    try {
      if (enabled) {
        await this.autoLauncher.enable();
        log.info('Auto-start enabled');
      } else {
        await this.autoLauncher.disable();
        log.info('Auto-start disabled');
      }
    } catch (error) {
      log.error('Error toggling auto-start:', error);
      dialog.showErrorBox('Auto-start Error', `Failed to ${enabled ? 'enable' : 'disable'} auto-start: ${error}`);
    }
  }

  private updateAutoStartMenuItem(checked: boolean): void {
    if (this.tray) {
      // Update the menu without recreating the entire tray
      const contextMenu = Menu.buildFromTemplate([
        {
          label: 'Open Interface',
          click: () => this.openInBrowser()
        },
        {
          label: 'Show Console',
          click: () => this.showConsoleWindow()
        },
        { type: 'separator' },
        {
          label: `Server: localhost:${this.serverPort}`,
          enabled: false
        },
        {
          label: `Network: ${this.getNetworkIP()}:${this.serverPort}`,
          enabled: false
        },
        { type: 'separator' },
        {
          label: 'Start with System',
          type: 'checkbox',
          checked: checked,
          click: (menuItem: MenuItem) => this.toggleAutoStart(menuItem.checked)
        },
        {
          label: 'Reconfigure Server',
          click: () => this.showReconfigureDialog()
        },
        { type: 'separator' },
        {
          label: 'Check for Updates',
          click: () => this.autoUpdaterService.manualCheckForUpdates()
        },
        {
          label: 'About',
          click: () => this.showAbout()
        },
        { type: 'separator' },
        {
          label: 'Quit',
          click: () => this.quitApplication()
        }
      ]);
      this.tray.setContextMenu(contextMenu);
    }
  }

  private showSettings(): void {
    dialog.showMessageBox({
      type: 'info',
      title: 'Settings',
      message: 'Settings',
      detail: `Server running on:\n- Local: http://localhost:${this.serverPort}\n- Network: http://${this.getNetworkIP()}:${this.serverPort}\n\nClick "Open Interface" to access the web interface.`,
      buttons: ['OK', 'Open Interface'],
      defaultId: 1
    }).then(result => {
      if (result.response === 1) {
        this.openInBrowser();
      }
    });
  }

  private async showReconfigureDialog(): Promise<void> {
    try {
        // Show setup dialog first (don't stop server until we have new config)
        const config = await this.setupDialog.showSetupDialog();
        
        // Only restart server if port actually changed
        if (config.serverPort !== this.serverPort) {
          log.info(`Port changed from ${this.serverPort} to ${config.serverPort}, restarting server...`);
          
          // Stop current server gracefully
          if (this.nextServer) {
            log.info('Stopping current server for reconfiguration...');
            this.nextServer.kill('SIGTERM');
            
            // Wait for graceful shutdown
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            if (this.nextServer && !this.nextServer.killed) {
              log.info('Force killing server...');
              this.nextServer.kill('SIGKILL');
            }
            this.nextServer = null;
            this.serverReady = false;
          }

          // Update port and restart
          this.serverPort = config.serverPort;
          await this.startNextServer();
        } else {
          log.info('Port unchanged, no server restart needed');
          this.serverPort = config.serverPort;
        }
        
        // Update tray menu to reflect any changes
        this.updateAutoStartMenuItem(config.autoStart || false);
        
        dialog.showMessageBox({
          type: 'info',
          title: 'Configuration Updated',
          message: 'Configuration updated successfully!',
          detail: `Server address:\n• Local: http://localhost:${this.serverPort}\n• Network: http://${this.getNetworkIP()}:${this.serverPort}`,
          buttons: ['OK', 'Open Interface']
        }).then(result => {
          if (result.response === 1) {
            this.openInBrowser();
          }
        });
        
    } catch (error) {
      log.error('Reconfiguration failed:', error);
      
      // Show more user-friendly error message
      let errorMsg = 'An unexpected error occurred during reconfiguration.';
      if (error instanceof Error) {
        if (error.message.includes('timeout')) {
          errorMsg = 'The server took too long to start. Please try again or check if the port is available.';
        } else if (error.message.includes('EADDRINUSE')) {
          errorMsg = 'The selected port is already in use. Please choose a different port.';
        }
      }
      
      dialog.showErrorBox('Reconfiguration Failed', errorMsg);
      
      // Ensure we have a running server
      if (!this.nextServer || !this.serverReady) {
        log.info('Attempting to restart server with previous settings...');
        try {
          await this.startNextServer();
        } catch (restartError) {
          log.error('Failed to restart server with previous settings:', restartError);
        }
      }
    }
  }

  private showConsoleWindow(): void {
    if (this.consoleWindow) {
      this.consoleWindow.show();
      this.consoleWindow.focus();
      return;
    }

    this.consoleWindow = new BrowserWindow({
      width: 1000,
      height: 600,
      frame: false,
      transparent: true,
      backgroundColor: '#00000000',
      title: 'DisplayOps Server Console',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'console-preload.js')
      },
      icon: this.getTrayIconPath(),
      show: true,
      resizable: true,
      minimizable: true,
      maximizable: true,
      closable: true,
      alwaysOnTop: false,
      skipTaskbar: false
    });

    // Generate console HTML with logs
    const consoleHtml = this.generateConsoleHtml();
    this.consoleWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(consoleHtml)}`);

    this.consoleWindow.on('closed', () => {
      this.consoleWindow = null;
    });
  }

  private generateConsoleHtml(): string {
    const logs = this.serverLogs.slice(-500).join(''); // Show last 500 lines
    const currentTime = new Date().toLocaleString();
    
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>DisplayOps Server Console</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', 'Monaco', monospace;
            background: linear-gradient(135deg, #0c0c0c 0%, #1a1a1a 100%);
            color: #e0e0e0;
            font-size: 13px;
            line-height: 1.5;
            height: 100vh;
            overflow: hidden;
            border-radius: 12px;
            border: 1px solid rgba(255, 255, 255, 0.1);
        }
        
        .window-controls {
            display: flex;
            gap: 0;
        }
        
        .window-control {
            width: 36px;
            height: 28px;
            border: none;
            background: transparent;
            color: #e0e0e0;
            font-size: 10px;
            font-family: 'Segoe UI Symbol', Arial, sans-serif;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: background-color 0.2s ease;
            border-radius: 4px;
            margin-left: 2px;
        }
        
        .window-control:hover {
            background: rgba(255, 255, 255, 0.1);
        }
        
        .window-control.close:hover {
            background: #e74c3c;
        }
        
        .window-control.maximize:hover {
            background: rgba(255, 255, 255, 0.15);
        }
        
        .window-control.minimize:hover {
            background: rgba(255, 255, 255, 0.15);
        }
        
        .header {
            background: rgba(255, 255, 255, 0.05);
            backdrop-filter: blur(10px);
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            padding: 16px 24px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .header-left {
            display: flex;
            align-items: center;
            gap: 12px;
        }
        
        .logo {
            width: 32px;
            height: 32px;
            background-image: url('data:image/png;base64,${this.getLogoBase64()}');
            background-size: cover;
            background-repeat: no-repeat;
            background-position: center;
            border-radius: 8px;
        }
        
        .title {
            font-size: 18px;
            font-weight: 600;
            color: #ffffff;
            margin: 0;
        }
        
        .subtitle {
            font-size: 12px;
            color: #888;
            margin: 2px 0 0 0;
        }
        
        .status-bar {
            display: flex;
            gap: 20px;
            align-items: center;
            font-size: 12px;
        }
        
        .status-item {
            display: flex;
            align-items: center;
            gap: 6px;
        }
        
        .status-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            animation: pulse 2s infinite;
        }
        
        .status-running { background: #4caf50; }
        .status-starting { background: #ff9800; }
        .status-error { background: #f44336; }
        
        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
        }
        
        .console-container {
            height: calc(100vh - 80px);
            padding: 0;
            background: #0d1117;
        }
        
        .console {
            height: 100%;
            padding: 20px;
            overflow-y: auto;
            font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
            font-size: 12px;
            line-height: 1.6;
        }
        
        .log-line {
            margin-bottom: 4px;
            padding: 2px 0;
            border-left: 3px solid transparent;
            padding-left: 8px;
            transition: all 0.2s ease;
        }
        
        .log-line:hover {
            background: rgba(255, 255, 255, 0.02);
            border-left-color: #667eea;
        }
        
        .timestamp {
            color: #6e7681;
            font-size: 11px;
            margin-right: 12px;
            min-width: 80px;
            display: inline-block;
        }
        
        .log-type-icon {
            margin-right: 6px;
            font-weight: bold;
        }
        
        .info { 
            color: #58a6ff; 
        }
        .info .log-type-icon::before { 
            content: "ℹ️"; 
        }
        
        .error { 
            color: #f85149; 
            background: rgba(248, 81, 73, 0.1);
            border-left-color: #f85149 !important;
        }
        .error .log-type-icon::before { 
            content: "❌"; 
        }
        
        .warn { 
            color: #d29922; 
            background: rgba(210, 153, 34, 0.1);
        }
        .warn .log-type-icon::before { 
            content: "⚠️"; 
        }
        
        .success { 
            color: #3fb950; 
        }
        .success .log-type-icon::before { 
            content: "✅"; 
        }
        
        .empty-state {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 60%;
            color: #6e7681;
            text-align: center;
        }
        
        .empty-state-icon {
            font-size: 48px;
            margin-bottom: 16px;
            opacity: 0.5;
        }
        
        ::-webkit-scrollbar {
            width: 8px;
        }
        
        ::-webkit-scrollbar-track {
            background: rgba(255, 255, 255, 0.05);
        }
        
        ::-webkit-scrollbar-thumb {
            background: rgba(255, 255, 255, 0.2);
            border-radius: 4px;
        }
        
        ::-webkit-scrollbar-thumb:hover {
            background: rgba(255, 255, 255, 0.3);
        }
        
        .footer {
            position: absolute;
            bottom: 8px;
            right: 12px;
            font-size: 10px;
            color: #6e7681;
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="header-left">
            <div class="logo"></div>
            <div>
                <div class="title">Server Console</div>
                <div class="subtitle">Last updated: ${currentTime}</div>
            </div>
        </div>
        <div class="status-bar">
            <div class="status-item">
                <div class="status-dot ${this.serverReady ? 'status-running' : 'status-starting'}"></div>
                <span>${this.serverReady ? 'Running' : 'Starting'}</span>
            </div>
            <div class="status-item">
                <span>Port: <strong>${this.serverPort}</strong></span>
            </div>
            <div class="status-item">
                <span>Lines: <strong>${this.serverLogs.length}</strong></span>
            </div>
            <div class="window-controls">
                <button class="window-control minimize" onclick="minimizeWindow()">🗕</button>
                <button class="window-control maximize" onclick="maximizeWindow()">🗖</button>
                <button class="window-control close" onclick="closeWindow()">🗙</button>
            </div>
        </div>
    </div>
    
    <div class="console-container">
        <div class="console" id="console">
            ${logs || `
                <div class="empty-state">
                    <div class="empty-state-icon">📡</div>
                    <div><strong>Waiting for server output...</strong></div>
                    <div>Server logs will appear here when available</div>
                </div>
            `}
        </div>
    </div>
    
    <div class="footer">
        Auto-refresh enabled • Press F12 to inspect
    </div>
    
    <script>
        // Auto-scroll to bottom with smooth behavior
        function scrollToBottom() {
            const console = document.getElementById('console');
            console.scrollTo({
                top: console.scrollHeight,
                behavior: 'smooth'
            });
        }
        
        // Initial scroll
        scrollToBottom();
        
        // Window controls
        function minimizeWindow() {
            if (window.electronAPI && window.electronAPI.minimize) {
                window.electronAPI.minimize();
            }
        }
        
        function maximizeWindow() {
            if (window.electronAPI && window.electronAPI.maximize) {
                window.electronAPI.maximize();
            }
        }
        
        function closeWindow() {
            if (window.electronAPI && window.electronAPI.close) {
                window.electronAPI.close();
            } else {
                window.close();
            }
        }
        
        // Listen for new log entries from main process
        if (window.electronAPI && window.electronAPI.onNewLog) {
            window.electronAPI.onNewLog((data) => {
                const consoleDiv = document.getElementById('console');
                const wasAtBottom = consoleDiv.scrollHeight - consoleDiv.scrollTop <= consoleDiv.clientHeight + 50;
                
                // Add new log entry
                consoleDiv.insertAdjacentHTML('beforeend', data.html);
                
                // Only auto-scroll if user was already at bottom
                if (wasAtBottom) {
                    scrollToBottom();
                }
                
                // Limit console entries (keep performance good)
                const logLines = consoleDiv.querySelectorAll('.log-line');
                if (logLines.length > 500) {
                    // Remove oldest entries
                    for (let i = 0; i < 50; i++) {
                        if (logLines[i]) logLines[i].remove();
                    }
                }
            });
        }
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'End') scrollToBottom();
            if (e.key === 'Home') console.scrollTop = 0;
            if (e.ctrlKey && e.key === 'r') location.reload();
        });
    </script>
</body>
</html>`;
  }

  private addToServerLog(message: string, type: 'info' | 'error' | 'warn' | 'success' = 'info'): void {
    const timestamp = new Date().toLocaleTimeString();
    const escapedMessage = message.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const logLine = `<div class="log-line ${type}"><span class="timestamp">[${timestamp}]</span><span class="log-type-icon"></span>${escapedMessage}</div>`;
    
    this.serverLogs.push(logLine);
    
    // Keep only last 1000 log lines to prevent memory issues
    if (this.serverLogs.length > 1000) {
      this.serverLogs = this.serverLogs.slice(-500);
    }
    
    // Update console window content smoothly without page reload
    if (this.consoleWindow && !this.consoleWindow.isDestroyed()) {
      // Send new log line to renderer via webContents
      this.consoleWindow.webContents.send('new-log', {
        html: logLine,
        timestamp: new Date().toISOString()
      });
    }
  }

  private getLogoBase64(): string {
    try {
      const logoPath = this.getTrayIconPath(); // Reutiliza o mesmo ícone do tray
      if (fs.existsSync(logoPath)) {
        const logoBuffer = fs.readFileSync(logoPath);
        return logoBuffer.toString('base64');
      }
    } catch (error) {
      log.error('Error loading logo for console:', error);
    }
    
    // Fallback: create a simple SVG logo as base64
    const svgLogo = `<svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="32" rx="6" fill="#4f46e5"/>
      <rect x="6" y="6" width="20" height="20" rx="3" fill="white"/>
      <rect x="8" y="8" width="8" height="5" rx="1" fill="#4f46e5"/>
      <rect x="16" y="8" width="8" height="5" rx="1" fill="#4f46e5"/>
      <rect x="8" y="16" width="8" height="5" rx="1" fill="#4f46e5"/>
      <rect x="16" y="16" width="8" height="5" rx="1" fill="#4f46e5"/>
    </svg>`;
    
    return Buffer.from(svgLogo).toString('base64');
  }

  private showAbout(): void {
    const { app } = require('electron');
    const config = this.configManager.loadConfig();
    
    dialog.showMessageBox({
      type: 'info',
      title: 'About DisplayOps Controller',
      message: 'DisplayOps Controller',
      detail: `Version: ${app.getVersion()}\n\nCurrent Configuration:\n• Port: ${this.serverPort}\n• Network Access: ${config.hostname === '0.0.0.0' ? 'Enabled' : 'Local Only'}\n• Auto-start: ${config.autoStart ? 'Enabled' : 'Disabled'}\n\nA comprehensive solution for managing multiple displays in office environments.\n\nFeatures:\n• Centralized web interface\n• Network access support\n• Auto-start capability\n• System tray integration\n• Automatic updates\n\nDeveloped with ❤️ using Electron + Next.js`,
      buttons: ['OK', 'Visit Website'],
      defaultId: 0
    }).then(result => {
      if (result.response === 1) {
        shell.openExternal('https://github.com/yourusername/displayops');
      }
    });
  }
}

// Create and start the application
new DisplayOpsController();