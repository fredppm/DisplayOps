import { BrowserWindow, dialog, ipcMain } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import log from 'electron-log';
import { ConfigManager, AppConfig } from './config-manager';

export class SetupDialog {
  private setupWindow: BrowserWindow | null = null;
  private configManager: ConfigManager;
  private resolvePromise: ((config: AppConfig) => void) | null = null;
  private getSystemAutoStartStatusFn: (() => Promise<boolean>) | null = null;

  constructor(configManager: ConfigManager, getSystemAutoStartStatus?: () => Promise<boolean>) {
    this.configManager = configManager;
    this.getSystemAutoStartStatusFn = getSystemAutoStartStatus || null;
    this.setupIpcHandlers();
  }

  public async showSetupDialog(): Promise<AppConfig> {
    log.info('ShowSetupDialog called - about to create setup window');
    return new Promise((resolve) => {
      this.resolvePromise = resolve;
      this.createSetupWindow();
      
      // Add error handling to debug what's causing the close
      setTimeout(() => {
        log.info('Debug: Window should still be open after 5 seconds');
        if (!this.setupWindow || this.setupWindow.isDestroyed()) {
          log.error('Debug: Window was destroyed unexpectedly');
        } else {
          log.info('Debug: Window is still alive');
        }
      }, 5000);
    });
  }

  private createSetupWindow(): void {
    log.info('Creating minimal setup window...');
    this.setupWindow = new BrowserWindow({
      width: 520,
      height: 500,
      resizable: false,
      frame: false,
      transparent: true,
      backgroundColor: '#00000000',
      skipTaskbar: true,
      alwaysOnTop: true,
      title: 'DisplayOps Controller - Setup',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'setup-preload.js')
      },
      roundedCorners: true,
      show: true
    });

    // Load the proper setup HTML
    log.info('Loading setup dialog HTML...');
    this.generateSetupHtml().then(setupHtml => {
      this.setupWindow?.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(setupHtml)}`);
    }).catch(error => {
      log.error('Failed to generate setup HTML:', error);
    });
    
    log.info('Setup window should now be visible');
    
    // Add comprehensive event listeners for debugging
    this.setupWindow.on('closed', () => {
      log.info('Setup window was closed');
      this.setupWindow = null;
      // If window is closed without completing setup, use defaults
      if (this.resolvePromise) {
        log.info('Resolving with default configuration');
        const defaultConfig = this.configManager.updateConfig({ firstRun: false });
        this.resolvePromise(defaultConfig);
        this.resolvePromise = null;
      }
    });
    
    this.setupWindow.on('close', (event) => {
      log.info('Setup window close event triggered');
    });
    
    this.setupWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
      log.error('Setup window failed to load:', errorCode, errorDescription);
    });
    
    this.setupWindow.webContents.on('crashed', (event, killed) => {
      log.error('Setup window renderer crashed, killed:', killed);
    });
    
    log.info('Setup window created successfully');
  }

  private async generateSetupHtml(): Promise<string> {
    const currentConfig = this.configManager.loadConfig();
    
    // Check actual auto-start status from system instead of just config
    let actualAutoStartStatus = currentConfig.autoStart;
    try {
      // We'll get this from the main process since we can't import auto-launch here
      actualAutoStartStatus = await this.getActualAutoStartStatus();
    } catch (error) {
      log.error('Failed to get auto-start status, using config value:', error);
    }
    
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>DisplayOps Controller Setup</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: hidden;
        }
        .container {
            background: rgba(255, 255, 255, 0.95);
            padding: 40px;
            border-radius: 16px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            max-width: 420px;
            width: 100%;
            color: #1f2937;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.2);
        }
        .header {
            margin-bottom: 32px;
        }
        h1 {
            margin: 0;
            font-size: 22px;
            color: #1f2937;
            text-align: center;
        }
        .field-group {
            margin-bottom: 18px;
        }
        label {
            display: block;
            margin-bottom: 8px;
            font-weight: 500;
        }
        input, select {
            width: 100%;
            padding: 10px;
            border: 1px solid #d1d5db;
            border-radius: 8px;
            font-size: 14px;
            background: white;
            color: #1f2937;
            box-sizing: border-box;
            transition: border-color 0.2s, box-shadow 0.2s;
        }
        .checkbox-wrapper {
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .checkbox-wrapper input[type="checkbox"] {
            width: auto;
            margin: 0;
        }
        .checkbox-wrapper label {
            margin: 0;
            cursor: pointer;
            font-weight: 500;
        }
        input:focus, select:focus {
            outline: none;
            box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.5);
        }
        .help-text {
            font-size: 11px;
            margin-top: 4px;
            opacity: 0.8;
            color: #6b7280;
        }
        .button-group {
            display: flex;
            gap: 10px;
            margin-top: 24px;
        }
        button {
            flex: 1;
            padding: 12px;
            border: none;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.3s ease;
        }
        .btn-primary {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
        }
        .btn-primary:hover {
            background: linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%);
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(102, 126, 234, 0.6);
        }
        .btn-secondary {
            background: rgba(255, 255, 255, 0.1);
            color: #667eea;
            border: 2px solid rgba(102, 126, 234, 0.3);
        }
        .btn-secondary:hover {
            background: rgba(255, 255, 255, 0.2);
            border-color: rgba(102, 126, 234, 0.5);
        }
        .error {
            color: #ff6b6b;
            font-size: 12px;
            margin-top: 5px;
        }
        .icon {
            font-size: 48px;
            text-align: center;
            margin-bottom: 20px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Server Configuration</h1>
        </div>
        
        <form id="setupForm">
            <div class="field-group">
                <label for="serverPort">Server Port</label>
                <input type="number" id="serverPort" value="${currentConfig.serverPort}" min="1024" max="65535">
                <div class="help-text">Port for the web interface (1024-65535)</div>
                <div class="error" id="portError"></div>
            </div>
            
            <div class="field-group">
                <label for="networkAccess">Network Access</label>
                <select id="networkAccess">
                    <option value="network" ${currentConfig.hostname === '0.0.0.0' ? 'selected' : ''}>
                        Allow network access (other devices can connect)
                    </option>
                    <option value="local" ${currentConfig.hostname === '127.0.0.1' ? 'selected' : ''}>
                        Local only (this computer only)
                    </option>
                </select>
                <div class="help-text">Choose who can access the web interface</div>
            </div>
            
            <div class="field-group">
                <div class="checkbox-wrapper">
                    <input type="checkbox" id="autoStart" ${actualAutoStartStatus ? 'checked' : ''}>
                    <label for="autoStart">Start with Windows</label>
                </div>
                <div class="help-text">Automatically start when your computer boots</div>
            </div>
        </form>
        
        <div class="button-group">
            <button type="button" class="btn-secondary" onclick="cancelConfiguration()" style="flex: 0 0 auto; width: 120px;">
                Cancel
            </button>
            <button type="button" class="btn-primary" onclick="saveConfiguration()" style="flex: 1;">
                Save & Continue
            </button>
        </div>
    </div>

    <script>
        async function saveConfiguration() {
            console.log('Save configuration clicked');
            const serverPort = parseInt(document.getElementById('serverPort').value);
            const networkAccess = document.getElementById('networkAccess').value;
            const autoStart = document.getElementById('autoStart').checked;
            
            console.log('Form values:', { serverPort, networkAccess, autoStart });
            
            // Clear previous errors
            document.getElementById('portError').textContent = '';
            
            // Validate port
            if (isNaN(serverPort) || serverPort < 1024 || serverPort > 65535) {
                document.getElementById('portError').textContent = 'Port must be between 1024 and 65535';
                return;
            }
            
            // Check if port is available
            const isAvailable = await window.electronAPI.isPortAvailable(serverPort);
            if (!isAvailable) {
                document.getElementById('portError').textContent = 'Port is already in use. Please choose another port.';
                return;
            }
            
            const config = {
                serverPort: serverPort,
                hostname: networkAccess === 'network' ? '0.0.0.0' : '127.0.0.1',
                autoStart: autoStart,
                firstRun: false
            };
            
            console.log('Saving config:', config);
            const result = await window.electronAPI.saveSetupConfig(config);
            console.log('Save result:', result);
        }
        
        function cancelConfiguration() {
            console.log('Cancel clicked');
            window.close();
        }
        
        function useDefaults() {
            console.log('Use defaults clicked');
            window.electronAPI.saveSetupConfig({
                serverPort: 3000,
                hostname: '0.0.0.0',
                autoStart: false,
                firstRun: false
            });
        }
        
        // Load actual auto-start status when page loads
        document.addEventListener('DOMContentLoaded', async function() {
            try {
                const actualAutoStart = await window.electronAPI.getAutoStartStatus();
                document.getElementById('autoStart').checked = actualAutoStart;
                console.log('Loaded auto-start status:', actualAutoStart);
            } catch (error) {
                console.error('Failed to load auto-start status:', error);
            }
        });
        
        // Auto-check port availability when user changes port
        document.getElementById('serverPort').addEventListener('change', async function() {
            const port = parseInt(this.value);
            const errorDiv = document.getElementById('portError');
            
            if (isNaN(port) || port < 1024 || port > 65535) {
                errorDiv.textContent = 'Port must be between 1024 and 65535';
                return;
            }
            
            const isAvailable = await window.electronAPI.isPortAvailable(port);
            if (!isAvailable) {
                errorDiv.textContent = 'Port is already in use';
            } else {
                errorDiv.textContent = '';
            }
        });
    </script>
</body>
</html>`;
  }

  private getLogoBase64(): string {
    try {
      const logoPath = path.join(__dirname, '..', 'assets', 'source-logo.png');
      if (fs.existsSync(logoPath)) {
        const logoBuffer = fs.readFileSync(logoPath);
        return logoBuffer.toString('base64');
      }
    } catch (error) {
      log.error('Error loading logo:', error);
    }
    
    // Fallback: create a simple SVG logo as base64
    const svgLogo = `<svg width="48" height="48" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
      <rect width="48" height="48" rx="8" fill="#4f46e5"/>
      <rect x="8" y="8" width="32" height="32" rx="4" fill="white"/>
      <rect x="12" y="12" width="12" height="8" rx="2" fill="#4f46e5"/>
      <rect x="24" y="12" width="12" height="8" rx="2" fill="#4f46e5"/>
      <rect x="12" y="24" width="12" height="8" rx="2" fill="#4f46e5"/>
      <rect x="24" y="24" width="12" height="8" rx="2" fill="#4f46e5"/>
    </svg>`;
    
    return Buffer.from(svgLogo).toString('base64');
  }

  private async getActualAutoStartStatus(): Promise<boolean> {
    if (this.getSystemAutoStartStatusFn) {
      try {
        return await this.getSystemAutoStartStatusFn();
      } catch (error) {
        log.error('Failed to get system auto-start status:', error);
      }
    }
    // Fallback to config value
    return this.configManager.loadConfig().autoStart;
  }

  private async getSystemAutoStartStatus(): Promise<boolean> {
    if (this.getSystemAutoStartStatusFn) {
      return await this.getSystemAutoStartStatusFn();
    }
    return this.configManager.loadConfig().autoStart;
  }

  private setupIpcHandlers(): void {
    ipcMain.handle('setup-isPortAvailable', async (event, port: number) => {
      try {
        return await this.configManager.isPortAvailable(port);
      } catch (error) {
        log.error('Error checking port availability:', error);
        return false;
      }
    });

    ipcMain.handle('setup-getAutoStartStatus', async () => {
      try {
        // We'll get this from main process since we need access to autoLauncher
        return await this.getSystemAutoStartStatus();
      } catch (error) {
        log.error('Error getting auto-start status:', error);
        return false;
      }
    });

    ipcMain.handle('setup-saveConfig', (event, config: Partial<AppConfig>) => {
      try {
        // Ensure firstRun is marked as false
        const configWithFirstRunComplete = { ...config, firstRun: false };
        const updatedConfig = this.configManager.updateConfig(configWithFirstRunComplete);
        log.info('Setup configuration saved:', updatedConfig);
        
        // Close setup window and resolve promise
        if (this.setupWindow) {
          this.setupWindow.close();
        }
        
        if (this.resolvePromise) {
          this.resolvePromise(updatedConfig);
          this.resolvePromise = null;
        }
        
        return true;
      } catch (error) {
        log.error('Error saving setup configuration:', error);
        return false;
      }
    });
  }

  public destroy(): void {
    if (this.setupWindow) {
      this.setupWindow.close();
      this.setupWindow = null;
    }
    
    // Remove IPC handlers
    ipcMain.removeAllListeners('setup-isPortAvailable');
    ipcMain.removeAllListeners('setup-saveConfig');
  }
}