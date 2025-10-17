import { Tray, Menu, nativeImage, app } from 'electron';
import path from 'path';
import { logger } from '../utils/logger';
import { ConfigManager } from './config-manager';
import { UpdateStatus } from '../auto-updater';

export class SystemTrayManager {
  private tray: Tray | null = null;
  private configManager: ConfigManager;
  private isConnected: boolean = true;
  private totalDisplays: number = 0;
  private activeWindows: number = 0;
  private currentState: 'idle' | 'ready' | 'error' | 'synced' = 'idle';
  private autoUpdaterStatus: UpdateStatus = { state: 'idle' };
  private onRefreshDisplaysCallback?: () => void;
  private onShowDebugOverlayCallback?: () => void;
  private onOpenCookieEditorCallback?: () => void;
  private onCheckForUpdatesCallback?: () => void;
  private onIdentifyDisplaysCallback?: () => void;
  private onOpenAdminCallback?: () => void;
  
  // Preloaded icons cache to prevent missing images when system goes offline
  private preloadedIcons: Map<string, Electron.NativeImage> = new Map();
  private iconStates: ('idle' | 'ready' | 'error' | 'synced')[] = ['idle', 'ready', 'error', 'synced'];

  constructor(configManager: ConfigManager) {
    this.configManager = configManager;
  }

  public setCallbacks(callbacks: {
    onRefreshDisplays?: () => void;
    onShowDebugOverlay?: () => void;
    onOpenCookieEditor?: () => void;
    onCheckForUpdates?: () => void;
    onIdentifyDisplays?: () => void;
    onOpenAdmin?: () => void;
  }): void {
    this.onRefreshDisplaysCallback = callbacks.onRefreshDisplays;
    this.onShowDebugOverlayCallback = callbacks.onShowDebugOverlay;
    this.onOpenCookieEditorCallback = callbacks.onOpenCookieEditor;
    this.onCheckForUpdatesCallback = callbacks.onCheckForUpdates;
    this.onIdentifyDisplaysCallback = callbacks.onIdentifyDisplays;
    this.onOpenAdminCallback = callbacks.onOpenAdmin;
  }

  /**
   * Preload all possible icon states to ensure they're available even when filesystem access is limited
   * This prevents icons from disappearing when the system goes offline or has I/O issues
   */
  private preloadAllIconStates(): void {
    logger.info('🎯 Preloading all tray icon states for offline resilience...');
    
    const isWindows = process.platform === 'win32';
    
    // Preload all state-specific icons
    this.iconStates.forEach(state => {
      try {
        const iconPath = this.getIconPath(state);
        let icon: Electron.NativeImage;
        
        if (iconPath && iconPath !== '') {
          const fs = require('fs');
          if (fs.existsSync(iconPath)) {
            icon = nativeImage.createFromPath(iconPath);
            logger.info(`✅ Preloaded icon for state '${state}' from: ${iconPath}`);
            
            // On Windows with .ico files, don't resize - ICO already has multiple sizes
            if (isWindows && iconPath.endsWith('.ico')) {
              logger.info(`🪟 Using native ICO file for Windows (no resize needed)`);
              this.preloadedIcons.set(state, icon);
              return; // Skip resize
            }
          } else {
            logger.warn(`⚠️  Icon file not found for state '${state}': ${iconPath}`);
            icon = this.createFallbackIcon(state);
            logger.info(`🔧 Created fallback icon for state '${state}'`);
          }
        } else {
          logger.warn(`⚠️  No icon path found for state '${state}', creating fallback`);
          icon = this.createFallbackIcon(state);
        }
        
        // Store the preloaded icon with 16x16 size ready for tray use (non-ICO files)
        const resizedIcon = icon.resize({ width: 16, height: 16 });
        this.preloadedIcons.set(state, resizedIcon);
        
        logger.debug(`📦 Cached icon for state '${state}', isEmpty: ${resizedIcon.isEmpty()}, size: ${JSON.stringify(resizedIcon.getSize())}`);
        
      } catch (error) {
        logger.error(`❌ Failed to preload icon for state '${state}':`, error);
        // Create emergency fallback
        const emergencyIcon = this.createBitmapFallback(state as 'idle' | 'ready' | 'error' | 'synced').resize({ width: 16, height: 16 });
        this.preloadedIcons.set(state, emergencyIcon);
        logger.warn(`🚨 Using emergency bitmap fallback for state '${state}'`);
      }
    });
    
    // Also preload a default/generic icon
    try {
      const defaultIconPath = this.getIconPath();  // No state = default
      if (defaultIconPath && defaultIconPath !== '') {
        const fs = require('fs');
        if (fs.existsSync(defaultIconPath)) {
          const defaultIcon = nativeImage.createFromPath(defaultIconPath).resize({ width: 16, height: 16 });
          this.preloadedIcons.set('default', defaultIcon);
          logger.info(`✅ Preloaded default icon from: ${defaultIconPath}`);
        }
      }
    } catch (error) {
      logger.warn('Could not preload default icon, fallbacks will be used');
    }
    
    logger.success(`🎉 Icon preloading completed! ${this.preloadedIcons.size} icons cached in memory`);
    
    // Log the cached icons for debugging
    const cachedStates = Array.from(this.preloadedIcons.keys());
    logger.info(`📋 Available cached icon states: ${cachedStates.join(', ')}`);
    
    // Only preload fallback icons if some icons failed to load from files
    const hasAllMainIcons = this.iconStates.every(state => this.preloadedIcons.has(state));
    if (!hasAllMainIcons) {
      logger.info('⚠️  Some icons missing, preloading fallback icons...');
      this.preloadFallbackIcons();
    } else {
      logger.debug('✅ All main icons loaded successfully, skipping fallback generation');
    }
  }

  /**
   * Preload all fallback icon variants to ensure complete offline resilience
   * This guarantees that even if file system access fails completely, we still have icons
   */
  private preloadFallbackIcons(): void {
    logger.info('🔧 Preloading fallback icons for maximum resilience...');
    
    this.iconStates.forEach(state => {
      const stateKey = state as 'idle' | 'ready' | 'error' | 'synced';
      
      try {
        // Create and cache SVG fallback
        const svgFallback = this.createFallbackIcon(stateKey).resize({ width: 16, height: 16 });
        this.preloadedIcons.set(`${state}-svg-fallback`, svgFallback);
        
        // Create and cache bitmap fallback
        const bitmapFallback = this.createBitmapFallback(stateKey).resize({ width: 16, height: 16 });
        this.preloadedIcons.set(`${state}-bitmap-fallback`, bitmapFallback);
        
        logger.debug(`📦 Cached fallback icons for state '${state}'`);
      } catch (error) {
        logger.error(`❌ Failed to create fallback icons for state '${state}':`, error);
      }
    });
    
    logger.info(`🛡️  Fallback icon preloading completed! Total icons cached: ${this.preloadedIcons.size}`);
  }

  public initialize(): void {
    try {
      // Preload all possible icon states to prevent missing images
      this.preloadAllIconStates();
      
      // Create tray icon with initial state
      this.createTrayWithIcon(this.currentState);
      
      logger.success('System tray initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize system tray:', error);
    }
  }

  private createTrayWithIcon(state: 'idle' | 'ready' | 'error' | 'synced'): void {
    logger.info(`🖼️  Setting tray icon to state: ${state}`);
    
    // Try to use preloaded icon first (for offline resilience)
    let resizedIcon: Electron.NativeImage | undefined = this.preloadedIcons.get(state);
    
    if (resizedIcon && !resizedIcon.isEmpty()) {
      logger.info(`✅ Using preloaded icon for state '${state}' (size: ${JSON.stringify(resizedIcon.getSize())})`);
    } else {
      // Try preloaded fallbacks before creating new ones
      logger.warn(`⚠️  Preloaded icon for state '${state}' not available, trying fallbacks...`);
      
      // Try SVG fallback first
      resizedIcon = this.preloadedIcons.get(`${state}-svg-fallback`);
      if (resizedIcon && !resizedIcon.isEmpty()) {
        logger.info(`🔧 Using preloaded SVG fallback for state '${state}'`);
      } else {
        // Try bitmap fallback
        resizedIcon = this.preloadedIcons.get(`${state}-bitmap-fallback`);
        if (resizedIcon && !resizedIcon.isEmpty()) {
          logger.info(`🎨 Using preloaded bitmap fallback for state '${state}'`);
        } else {
          // Last resort: real-time loading and generation
          logger.warn(`🚨 No preloaded icons available for state '${state}', creating in real-time...`);
          
          const iconPath = this.getIconPath(state);
          logger.info(`Attempting to load tray icon from: ${iconPath}`);
          
          let icon: Electron.NativeImage | undefined;
          
          if (iconPath && iconPath !== '') {
            try {
              icon = nativeImage.createFromPath(iconPath);
              logger.info(`Icon loaded, isEmpty: ${icon.isEmpty()}, size: ${JSON.stringify(icon.getSize())}`);
            } catch (error) {
              logger.error(`Failed to load icon from ${iconPath}:`, error);
              icon = undefined;
            }
          }
          
          // If icon is empty or path not found, create a simple fallback icon
          if (!iconPath || iconPath === '' || !icon || icon.isEmpty()) {
            logger.warn('No valid icon found, creating emergency fallback icon');
            icon = this.createFallbackIcon(state);
          }
          
          // Resize icon for system tray (16x16 on Windows)
          // BUT: skip resize for .ico files on Windows - they already have proper sizes
          if (process.platform === 'win32' && iconPath && iconPath.endsWith('.ico')) {
            logger.info('🪟 Using native ICO without resize for Windows tray');
            resizedIcon = icon;
          } else {
            resizedIcon = icon.resize({ width: 16, height: 16 });
          }
        }
      }
    }
    
    if (!this.tray) {
      this.tray = new Tray(resizedIcon);
      this.tray.setToolTip('DisplayOps Host Agent - VTEX');
      
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
            title: 'DisplayOps Host Agent',
            content: `Status: ${this.isConnected ? 'Online' : 'Offline'} | ${this.totalDisplays} displays | ${this.activeWindows} windows`,
            iconType: 'info'
          });
        }
      });

      this.tray.on('double-click', () => {
        // Double-click behavior removed
      });
    } else {
      // Just update the existing tray icon
      this.tray.setImage(resizedIcon);
    }
  }

  private getIconPath(state: 'idle' | 'ready' | 'error' | 'synced' = 'idle'): string {
    const isWindows = process.platform === 'win32';
    
    // On Windows, prefer .ico files for better system tray rendering
    const iconPaths = isWindows ? [
      // Windows: Try .ico first (better for tray icons)
      path.join(__dirname, '../../assets/icon.ico'),
      path.join(__dirname, '../assets/icon.ico'),
      path.join(__dirname, '../../../assets/icon.ico'),
      path.join(process.cwd(), 'host-agent/assets/icon.ico'),
      path.join(process.cwd(), 'assets/icon.ico'),
      path.join(process.resourcesPath, 'assets/icon.ico'),
      
      // Then PNG fallbacks
      path.join(__dirname, `../../assets/vtex-tray-icon-${state}.png`),
      path.join(__dirname, `../assets/vtex-tray-icon-${state}.png`),
      path.join(__dirname, '../../../assets/vtex-tray-icon.png'),
      path.join(process.cwd(), 'host-agent/assets/vtex-tray-icon.png'),
      path.join(process.cwd(), 'assets/vtex-tray-icon.png'),
      path.join(process.resourcesPath, 'assets/vtex-tray-icon.png'),
      path.join(__dirname, '../../assets/icon.png')
    ] : [
      // macOS/Linux: PNG with state support
      path.join(__dirname, `../../assets/vtex-tray-icon-${state}.png`),
      path.join(__dirname, `../assets/vtex-tray-icon-${state}.png`),
      path.join(__dirname, `../../../assets/vtex-tray-icon-${state}.png`),
      path.join(process.cwd(), `host-agent/assets/vtex-tray-icon-${state}.png`),
      path.join(process.cwd(), `assets/vtex-tray-icon-${state}.png`),
      
      // Fallback to default icons
      path.join(__dirname, '../../assets/vtex-tray-icon.png'),
      path.join(__dirname, '../assets/vtex-tray-icon.png'),
      path.join(__dirname, '../../../assets/vtex-tray-icon.png'),
      path.join(process.cwd(), 'host-agent/assets/vtex-tray-icon.png'),
      path.join(process.cwd(), 'assets/vtex-tray-icon.png'),
      path.join(__dirname, '../../assets/icon.png')
    ];

    // Check if any icon exists and return the first found
    const fs = require('fs');
    logger.info(`🔍 Searching for tray icon (platform: ${process.platform}, state: ${state})`);
    logger.debug(`🔍 Trying ${iconPaths.length} possible icon paths...`);
    
    for (const iconPath of iconPaths) {
      if (fs.existsSync(iconPath)) {
        logger.info(`✅ Found tray icon at: ${iconPath}`);
        return iconPath;
      } else {
        logger.debug(`❌ Not found: ${iconPath}`);
      }
    }

    // Fallback to empty string (Electron default)
    logger.warn('🚨 No icon files found in expected locations');
    logger.info(`📂 Current working directory: ${process.cwd()}`);
    logger.info(`📂 __dirname: ${__dirname}`);
    logger.info(`📂 process.resourcesPath: ${process.resourcesPath || '(not set)'}`);
    return '';
  }

  private createFallbackIcon(state: 'idle' | 'ready' | 'error' | 'synced' = 'idle'): Electron.NativeImage {
    logger.debug(`Creating fallback icon for state: ${state}`);
    
    // Create state-specific fallback icon colors
    const stateColors = {
      idle: '#666666',     // Gray for idle
      ready: '#00C851',    // Green for ready
      error: '#FF4444',    // Red for error
      synced: '#007BFF'    // Blue for synced
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
        logger.debug('SVG fallback empty, using bitmap fallback instead');
        return this.createBitmapFallback(state);
      }
      
      return icon;
    } catch (error) {
      logger.error('Failed to create SVG fallback icon:', error);
      return this.createBitmapFallback(state);
    }
  }

  private createBitmapFallback(state: 'idle' | 'ready' | 'error' | 'synced' = 'idle'): Electron.NativeImage {
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
      error: [255, 68, 68],     // Red
      synced: [0, 123, 255]     // Blue
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

  public updateUpdateStatus(status: UpdateStatus): void {
    this.autoUpdaterStatus = status;
    
    // Update context menu to show update info
    this.updateContextMenu();
    
    // Update tooltip if update is in progress
    if (this.tray && (status.state === 'downloading' || status.state === 'downloaded')) {
      this.updateTooltip();
    }
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
    let newState: 'idle' | 'ready' | 'error' | 'synced' = 'idle';
    
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
    this.updateTooltip();
    
    if (this.tray) {
      // Update context menu to reflect new status
      this.updateContextMenu();
    }
  }

  private updateTooltip(): void {
    if (!this.tray) return;

    const statusText = this.isConnected ? 'Online' : 'Offline';
    let tooltip = `DisplayOps Host Agent - ${statusText}\n${this.totalDisplays} displays, ${this.activeWindows} active windows`;
    
    // Add update status to tooltip
    if (this.autoUpdaterStatus.state === 'downloading') {
      tooltip += `\n⬇️ Downloading update: ${this.autoUpdaterStatus.progress || 0}%`;
    } else if (this.autoUpdaterStatus.state === 'downloaded') {
      tooltip += `\n✅ Update ready: v${this.autoUpdaterStatus.version}`;
    } else if (this.autoUpdaterStatus.state === 'available') {
      tooltip += `\n🔄 Update available: v${this.autoUpdaterStatus.version}`;
    }
    
    this.tray.setToolTip(tooltip);
  }

  private updateContextMenu(): void {
    if (!this.tray) return;

    // Build update menu items based on status
    const updateMenuItems: Electron.MenuItemConstructorOptions[] = [];
    
    if (this.autoUpdaterStatus.state === 'downloading') {
      updateMenuItems.push({
        label: `⬇️ Downloading Update: ${this.autoUpdaterStatus.progress || 0}%`,
        enabled: false
      });
    } else if (this.autoUpdaterStatus.state === 'downloaded') {
      updateMenuItems.push({
        label: `✅ Update Ready: v${this.autoUpdaterStatus.version}`,
        enabled: false
      });
      updateMenuItems.push({
        label: 'Install Update Now',
        click: () => this.checkForUpdates() // Will trigger install dialog
      });
    } else if (this.autoUpdaterStatus.state === 'available') {
      updateMenuItems.push({
        label: `🔄 Update Available: v${this.autoUpdaterStatus.version}`,
        enabled: false
      });
    } else {
      updateMenuItems.push({
        label: 'Check for Updates',
        click: () => this.checkForUpdates()
      });
    }

    const contextMenu = Menu.buildFromTemplate([
      {
        label: `DisplayOps Host Agent`,
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
        label: 'Open Web Admin',
        click: () => this.openAdmin()
      },
      {
        type: 'separator'
      },
      {
        label: 'Show Debug Overlay',
        click: () => this.showDebugOverlay()
      },
      {
        label: 'Identify Displays',
        click: () => this.identifyDisplays()
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
      ...updateMenuItems,
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

  private checkForUpdates(): void {
    logger.info('Check for Updates requested from system tray');
    
    if (this.onCheckForUpdatesCallback) {
      this.onCheckForUpdatesCallback();
    }
  }

  private identifyDisplays(): void {
    logger.info('Identify Displays requested from system tray');
    
    if (this.onIdentifyDisplaysCallback) {
      this.onIdentifyDisplaysCallback();
      
      if (this.tray) {
        this.tray.displayBalloon({
          title: 'Display Identification',
          content: 'Showing display numbers for 5 seconds...',
          iconType: 'info'
        });
      }
    }
  }

  private openAdmin(): void {
    logger.info('Open Web Admin requested from system tray');
    
    if (this.onOpenAdminCallback) {
      this.onOpenAdminCallback();
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

  /**
   * Force reload all icon states - useful for testing or recovery
   */
  public forceReloadIcons(): void {
    logger.info('🔄 Forcing reload of all icon states...');
    this.preloadedIcons.clear();
    this.preloadAllIconStates();
    
    // Update current tray icon with fresh data
    if (this.tray) {
      this.createTrayWithIcon(this.currentState);
      logger.info('🔄 Current tray icon refreshed after reload');
    }
  }

  /**
   * Get diagnostic information about preloaded icons
   */
  public getIconDiagnostics(): { 
    totalCached: number;
    states: string[];
    missingStates: string[];
    cacheHealth: 'healthy' | 'degraded' | 'critical';
  } {
    const cachedStates = Array.from(this.preloadedIcons.keys());
    const expectedStates = [...this.iconStates, 'default'];
    const missingStates = expectedStates.filter(state => !this.preloadedIcons.has(state));
    
    let cacheHealth: 'healthy' | 'degraded' | 'critical' = 'healthy';
    if (missingStates.length > 0) {
      cacheHealth = missingStates.length >= expectedStates.length * 0.5 ? 'critical' : 'degraded';
    }
    
    return {
      totalCached: this.preloadedIcons.size,
      states: cachedStates,
      missingStates,
      cacheHealth
    };
  }

  public cleanup(): void {
    if (this.tray) {
      this.tray.destroy();
      this.tray = null;
      logger.debug('System tray cleaned up');
    }
    
    // Clear preloaded icons cache
    this.preloadedIcons.clear();
    logger.debug('Icon cache cleared');
  }
}