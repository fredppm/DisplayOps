import { Tray, Menu, nativeImage, app } from 'electron';
import path from 'path';
import { logger } from '../utils/logger';
import { ConfigManager } from './config-manager';

export class SystemTrayManager {
  private tray: Tray | null = null;
  private configManager: ConfigManager;
  private isConnected: boolean = true;
  private totalDisplays: number = 0;
  private activeWindows: number = 0;
  private currentState: 'idle' | 'ready' | 'error' = 'idle';
  private onRefreshDisplaysCallback?: () => void;
  private onShowDebugOverlayCallback?: () => void;
  private onOpenCookieEditorCallback?: () => void;

  constructor(configManager: ConfigManager) {
    this.configManager = configManager;
  }

  public setCallbacks(callbacks: {
    onRefreshDisplays?: () => void;
    onShowDebugOverlay?: () => void;
    onOpenCookieEditor?: () => void;
  }): void {
    this.onRefreshDisplaysCallback = callbacks.onRefreshDisplays;
    this.onShowDebugOverlayCallback = callbacks.onShowDebugOverlay;
    this.onOpenCookieEditorCallback = callbacks.onOpenCookieEditor;
  }

  public initialize(): void {
    try {
      // Create tray icon with initial state
      this.createTrayWithIcon(this.currentState);
      
      logger.success('System tray initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize system tray:', error);
    }
  }

  private createTrayWithIcon(state: 'idle' | 'ready' | 'error'): void {
    const iconPath = this.getIconPath(state);
    logger.info(`Attempting to load tray icon from: ${iconPath}`);
    
    let icon: Electron.NativeImage | undefined;
    
    if (iconPath && iconPath !== '') {
      icon = nativeImage.createFromPath(iconPath);
      logger.info(`Icon loaded, isEmpty: ${icon.isEmpty()}, size: ${JSON.stringify(icon.getSize())}`);
    }
    
    // If icon is empty or path not found, create a simple fallback icon
    if (!iconPath || iconPath === '' || !icon || icon.isEmpty()) {
      logger.warn('No valid icon found, creating fallback icon');
      icon = this.createFallbackIcon(state);
    }
    
    // Resize icon for system tray (16x16 on Windows)
    const resizedIcon = icon.resize({ width: 16, height: 16 });
    
    if (!this.tray) {
      this.tray = new Tray(resizedIcon);
      this.tray.setToolTip('Office Display Host Agent - VTEX');
      
      // Configure for Windows system tray behavior
      if (process.platform === 'win32') {
        // Enable double click events
        this.tray.setIgnoreDoubleClickEvents(false);
        
        // Set image to ensure visibility and proper rendering
        this.tray.setImage(resizedIcon);
        
        // Force the tray to be visible by setting a title (invisible)
        this.tray.setTitle('');
        
        // Try to prevent the icon from being hidden in overflow
        // by periodically refreshing the tray state
        setInterval(() => {
          if (this.tray && !this.tray.isDestroyed()) {
            this.tray.setImage(resizedIcon);
          }
        }, 30000); // Refresh every 30 seconds
      }
      
      // Set up context menu
      this.updateContextMenu();
      
      // Handle click events
      this.tray.on('click', () => {
        // Show a simple status notification
        if (this.tray) {
          this.tray.displayBalloon({
            title: 'Office Display Host Agent',
            content: `Status: ${this.isConnected ? 'Online' : 'Offline'} | ${this.totalDisplays} displays | ${this.activeWindows} windows`,
            iconType: 'info'
          });
        }
      });

      this.tray.on('double-click', () => {
        this.openWebController();
      });
    } else {
      // Just update the existing tray icon
      this.tray.setImage(resizedIcon);
    }
  }

  private getIconPath(state: 'idle' | 'ready' | 'error' = 'idle'): string {
    // Try multiple path strategies for different build contexts
    const iconPaths = [
      // For compiled/built version
      path.join(__dirname, `../../assets/vtex-tray-icon-${state}.png`),
      path.join(__dirname, `../assets/vtex-tray-icon-${state}.png`),
      
      // For development version
      path.join(__dirname, `../../../assets/vtex-tray-icon-${state}.png`),
      path.join(process.cwd(), `host-agent/assets/vtex-tray-icon-${state}.png`),
      path.join(process.cwd(), `assets/vtex-tray-icon-${state}.png`),
      
      // Fallback to default icons
      path.join(__dirname, '../../assets/vtex-tray-icon.png'),
      path.join(__dirname, '../assets/vtex-tray-icon.png'),
      path.join(__dirname, '../../../assets/vtex-tray-icon.png'),
      path.join(process.cwd(), 'host-agent/assets/vtex-tray-icon.png'),
      path.join(process.cwd(), 'assets/vtex-tray-icon.png'),
      
      // SVG fallbacks
      path.join(__dirname, '../../assets/vtex-icon.svg'),
      path.join(__dirname, '../../assets/icon.png')
    ];

    // Check if any icon exists and return the first found
    const fs = require('fs');
    for (const iconPath of iconPaths) {
      if (fs.existsSync(iconPath)) {
        logger.info(`✅ Found icon at: ${iconPath}`);
        return iconPath;
      }
    }

    // Fallback to empty string (Electron default)
    logger.warn('🚨 No icon files found in expected locations');
    return '';
  }

  private createFallbackIcon(state: 'idle' | 'ready' | 'error' = 'idle'): Electron.NativeImage {
    logger.warn(`Creating fallback icon for state: ${state}`);
    
    // Create state-specific fallback icon colors
    const stateColors = {
      idle: '#666666',    // Gray for idle
      ready: '#00C851',   // Green for ready
      error: '#FF4444'    // Red for error
    };
    
    const color = stateColors[state];
    
    try {
      // Create a simple 16x16 circle with "V" for VTEX in state color
      const canvas = `
        <svg width="16" height="16" xmlns="http://www.w3.org/2000/svg">
          <circle cx="8" cy="8" r="7" fill="${color}" stroke="#ffffff" stroke-width="1"/>
          <text x="8" y="12" font-family="Arial" font-size="10" font-weight="bold" fill="white" text-anchor="middle">V</text>
        </svg>
      `;
      
      const buffer = Buffer.from(canvas, 'utf8');
      const icon = nativeImage.createFromBuffer(buffer);
      
      logger.info(`Fallback icon created successfully, isEmpty: ${icon.isEmpty()}, size: ${JSON.stringify(icon.getSize())}`);
      
      // If SVG doesn't work, create a simple bitmap fallback
      if (icon.isEmpty()) {
        logger.warn('SVG fallback failed, creating bitmap fallback');
        return this.createBitmapFallback(state);
      }
      
      return icon;
    } catch (error) {
      logger.error('Failed to create SVG fallback icon:', error);
      return this.createBitmapFallback(state);
    }
  }

  private createBitmapFallback(state: 'idle' | 'ready' | 'error' = 'idle'): Electron.NativeImage {
    // Create a simple 16x16 bitmap as absolute fallback
    const size = 16;
    const buffer = Buffer.alloc(size * size * 4); // RGBA
    
    // Fill with transparent background
    for (let i = 0; i < buffer.length; i += 4) {
      buffer[i] = 0;     // R
      buffer[i + 1] = 0; // G
      buffer[i + 2] = 0; // B
      buffer[i + 3] = 0; // A (transparent)
    }
    
    // Draw a simple colored square in the middle
    const stateColors = {
      idle: [102, 102, 102],    // Gray
      ready: [0, 200, 81],      // Green  
      error: [255, 68, 68]      // Red
    };
    
    const [r, g, b] = stateColors[state];
    
    // Draw 8x8 square in center
    for (let y = 4; y < 12; y++) {
      for (let x = 4; x < 12; x++) {
        const index = (y * size + x) * 4;
        buffer[index] = r;       // R
        buffer[index + 1] = g;   // G
        buffer[index + 2] = b;   // B
        buffer[index + 3] = 255; // A (opaque)
      }
    }
    
    const icon = nativeImage.createFromBuffer(buffer, { width: size, height: size });
    logger.info(`Bitmap fallback created, isEmpty: ${icon.isEmpty()}`);
    
    return icon;
  }

  public updateStatus(status: {
    connected: boolean;
    totalDisplays: number;
    activeWindows: number;
  }): void {
    this.isConnected = status.connected;
    this.totalDisplays = status.totalDisplays;
    this.activeWindows = status.activeWindows;

    // Determine new state based on status
    let newState: 'idle' | 'ready' | 'error' = 'idle';
    
    if (!status.connected) {
      newState = 'error';
    } else if (status.totalDisplays > 0 && status.activeWindows > 0) {
      newState = 'ready';
    } else if (status.totalDisplays > 0) {
      newState = 'idle'; // Has displays but no active windows
    }
    
    // Update icon if state changed
    if (newState !== this.currentState) {
      this.currentState = newState;
      this.createTrayWithIcon(this.currentState);
      logger.info(`Tray icon state changed to: ${this.currentState}`);
    }

    // Update tooltip
    const statusText = status.connected ? 'Online' : 'Offline';
    const tooltip = `Office TV Host Agent - ${statusText}\n${status.totalDisplays} displays, ${status.activeWindows} active windows`;
    
    if (this.tray) {
      this.tray.setToolTip(tooltip);
      
      // Update context menu to reflect new status
      this.updateContextMenu();
    }
  }

  private updateContextMenu(): void {
    if (!this.tray) return;

    const contextMenu = Menu.buildFromTemplate([
      {
        label: `Office Display Host Agent`,
        enabled: false
      },
      {
        type: 'separator'
      },
      {
        label: `Status: ${this.isConnected ? '🟢 Online' : '🔴 Offline'}`,
        enabled: false
      },
      {
        label: `Displays: ${this.totalDisplays}`,
        enabled: false
      },
      {
        label: `Active Windows: ${this.activeWindows}`,
        enabled: false
      },
      {
        type: 'separator'
      },
      {
        label: 'Open Web Controller',
        click: () => this.openWebController()
      },
      {
        label: 'Show Debug Overlay',
        click: () => this.showDebugOverlay()
      },
      {
        label: 'Refresh Displays',
        click: () => this.refreshDisplays()
      },
      {
        type: 'separator'
      },
      {
        label: 'Cookie Editor (Debug)',
        click: () => this.openCookieEditor()
      },
      {
        type: 'separator'
      },
      {
        label: 'Quit',
        click: () => this.quit()
      }
    ]);

    this.tray.setContextMenu(contextMenu);
  }


  private openWebController(): void {
    // Try common web controller ports
    const possibleUrls = [
      'http://localhost:3000',
      'http://localhost:3001'
    ];
    
    // For now, just try the default port (user can manually navigate if needed)
    const url = possibleUrls[0];
    
    // Open in default browser
    import('electron').then(({ shell }) => {
      shell.openExternal(url);
    });
    
    logger.info(`Opening web controller at ${url}`);
    
    // Show notification
    if (this.tray) {
      this.tray.displayBalloon({
        title: 'Web Controller',
        content: `Opening ${url}\nIf not running, start it with "npm run dev:web"`,
        iconType: 'info'
      });
    }
  }

  private showDebugOverlay(): void {
    logger.info('Debug overlay requested from system tray');
    
    if (this.onShowDebugOverlayCallback) {
      this.onShowDebugOverlayCallback();
    } else {
      // Fallback message
      if (this.tray) {
        this.tray.displayBalloon({
          title: 'Debug Overlay',
          content: 'Use Ctrl+Shift+D to toggle debug overlay',
          iconType: 'info'
        });
      }
    }
  }

  private refreshDisplays(): void {
    logger.info('Display refresh requested from system tray');
    
    if (this.onRefreshDisplaysCallback) {
      this.onRefreshDisplaysCallback();
    }
    
    if (this.tray) {
      this.tray.displayBalloon({
        title: 'Displays Refreshed',
        content: 'Display configuration has been refreshed',
        iconType: 'info'
      });
    }
  }


  private openCookieEditor(): void {
    logger.info('Cookie Editor requested from system tray');
    
    if (this.onOpenCookieEditorCallback) {
      this.onOpenCookieEditorCallback();
    }
  }

  private quit(): void {
    logger.info('Quit requested from system tray');
    app.quit();
  }

  public showNotification(title: string, message: string, type: 'info' | 'warning' | 'error' = 'info'): void {
    if (this.tray) {
      this.tray.displayBalloon({
        title,
        content: message,
        iconType: type
      });
    }
  }

  public cleanup(): void {
    if (this.tray) {
      this.tray.destroy();
      this.tray = null;
      logger.debug('System tray cleaned up');
    }
  }
}