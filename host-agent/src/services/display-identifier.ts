import { BrowserWindow, screen } from 'electron';
import { join } from 'path';
import { WindowManager } from '../managers/window-manager';

export interface DisplayIdentifierOptions {
  duration?: number;
  fontSize?: number;
  backgroundColor?: string;
}

export class DisplayIdentifier {
  private identifierWindows: BrowserWindow[] = [];
  private isActive: boolean = false;
  private windowManager?: WindowManager;

  public setWindowManager(windowManager: WindowManager): void {
    this.windowManager = windowManager;
  }

  public async identifyDisplays(options: DisplayIdentifierOptions = {}): Promise<string> {
    if (this.isActive) {
      return 'Display identification already active';
    }

    const {
      duration = 5,
      fontSize = 200,
      backgroundColor = 'rgba(0, 0, 0, 0.8)'
    } = options;

    try {
      this.isActive = true;
      const displays = screen.getAllDisplays();
      
      if (displays.length === 0) {
        throw new Error('No displays found');
      }

      console.log(`🖥️ Identifying ${displays.length} displays for ${duration} seconds...`);

      // First, try to inject into existing dashboard windows
      let injectedCount = 0;
      if (this.windowManager) {
        injectedCount = await this.injectIntoExistingWindows(duration, fontSize, backgroundColor);
      }

      // For displays without dashboards, create overlay windows
      const displaysWithoutDashboards = displays.length - injectedCount;
      if (displaysWithoutDashboards > 0) {
        const windowPromises = displays.slice(injectedCount).map((display, index) => 
          this.createIdentifierWindow(display, injectedCount + index + 1, fontSize, backgroundColor)
        );

        this.identifierWindows = await Promise.all(windowPromises);

        // Force all windows to top after creation with aggressive settings
        setTimeout(() => {
          this.identifierWindows.forEach(window => {
            if (!window.isDestroyed()) {
              window.setAlwaysOnTop(true, 'screen-saver', 1);
              window.moveTop();
              window.show();
              window.focus();
              window.setKiosk(true);
            }
          });
        }, 100);
        
        // Additional force after 500ms
        setTimeout(() => {
          this.identifierWindows.forEach(window => {
            if (!window.isDestroyed()) {
              window.setAlwaysOnTop(true, 'screen-saver', 1);
              window.moveTop();
            }
          });
        }, 500);

        // Auto-close after duration
        setTimeout(() => {
          this.closeIdentifierWindows();
        }, duration * 1000);

        // Emergency force-close after duration + 2 seconds
        setTimeout(() => {
          this.forceCloseAllWindows();
        }, (duration + 2) * 1000);
      }

      // Mark as inactive after the duration
      setTimeout(() => {
        this.isActive = false;
      }, (duration + 1) * 1000);

      return `Identifying ${displays.length} displays for ${duration} seconds`;

    } catch (error) {
      console.error('Error identifying displays:', error);
      this.isActive = false;
      throw error;
    }
  }

  private async injectIntoExistingWindows(duration: number, fontSize: number, backgroundColor: string): Promise<number> {
    if (!this.windowManager) return 0;

    const managedWindows = this.windowManager.getAllWindows();
    let injectedCount = 0;

    for (const managedWindow of managedWindows) {
      if (!managedWindow.window.isDestroyed()) {
        try {
          const displayNumber = injectedCount + 1;
          
          const injectionScript = `
            (function() {
              // Remove existing identifier if present
              const existing = document.getElementById('display-identifier-overlay');
              if (existing) existing.remove();
              
              // Create overlay
              const overlay = document.createElement('div');
              overlay.id = 'display-identifier-overlay';
              overlay.style.cssText = \`
                position: fixed;
                top: 0;
                left: 0;
                width: 100vw;
                height: 100vh;
                background: ${backgroundColor};
                display: flex;
                align-items: center;
                justify-content: center;
                font-family: 'Segoe UI', Arial, sans-serif;
                z-index: 999999;
                cursor: pointer;
              \`;
              
              overlay.innerHTML = \`
                <div style="text-align: center; color: white; animation: pulse 1.5s ease-in-out infinite alternate;">
                  <div style="font-size: ${fontSize}px; font-weight: 900; line-height: 1; text-shadow: 0 0 20px rgba(255, 255, 255, 0.5); margin-bottom: 20px;">
                    ${displayNumber}
                  </div>
                  <div style="font-size: 24px; font-weight: 600; opacity: 0.8; margin-bottom: 10px;">
                    Display ${displayNumber}
                  </div>
                  <div style="font-size: 14px; opacity: 0.4; position: absolute; bottom: 30px; left: 50%; transform: translateX(-50%);">
                    Click anywhere or press any key to close
                  </div>
                </div>
              \`;
              
              // Add CSS animation
              if (!document.getElementById('identifier-styles')) {
                const styles = document.createElement('style');
                styles.id = 'identifier-styles';
                styles.textContent = \`
                  @keyframes pulse {
                    0% { opacity: 0.7; transform: scale(1); }
                    100% { opacity: 1; transform: scale(1.05); }
                  }
                \`;
                document.head.appendChild(styles);
              }
              
              // Close handlers
              const closeOverlay = () => {
                overlay.remove();
                document.removeEventListener('keydown', closeOverlay);
              };
              
              overlay.addEventListener('click', closeOverlay);
              document.addEventListener('keydown', closeOverlay);
              
              // Auto-close after duration
              setTimeout(closeOverlay, ${duration * 1000});
              
              document.body.appendChild(overlay);
            })();
          `;

          await managedWindow.window.webContents.executeJavaScript(injectionScript);
          injectedCount++;
          console.log(`📺 Injected identifier into display ${displayNumber}`);
          
        } catch (error) {
          console.error(`Failed to inject into window ${managedWindow.id}:`, error);
        }
      }
    }

    return injectedCount;
  }

  public closeIdentifierWindows(): void {
    console.log('🔴 Closing display identifier windows...');
    
    this.identifierWindows.forEach((window, index) => {
      if (!window.isDestroyed()) {
        try {
          window.setKiosk(false); // Exit kiosk mode first
          window.setAlwaysOnTop(false); // Remove always on top
          window.close();
        } catch (error) {
          console.error(`Error closing identifier window ${index + 1}:`, error);
        }
      }
    });

    this.identifierWindows = [];
    this.isActive = false;
  }

  private async createIdentifierWindow(
    display: Electron.Display, 
    number: number,
    fontSize: number,
    backgroundColor: string
  ): Promise<BrowserWindow> {
    const { bounds } = display;

    const window = new BrowserWindow({
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      frame: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: false,
      movable: false,
      minimizable: false,
      maximizable: false,
      closable: true,
      focusable: true, // Allow focus so it can receive keyboard events
      transparent: true,
      kiosk: true, // Force kiosk mode to override other windows
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        webSecurity: false
      }
    });

    // Generate HTML content for the identifier
    const html = this.generateIdentifierHTML(number, display, fontSize, backgroundColor);
    
    // Load the HTML directly
    await window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

    // Force window to top with maximum priority
    window.show();
    window.focus();
    window.setAlwaysOnTop(true, 'screen-saver', 1); // Highest priority level
    window.moveTop();
    window.setKiosk(true); // Force kiosk mode after showing

    // Debug info
    console.log(`📺 Display ${number}: ${bounds.width}x${bounds.height} at (${bounds.x}, ${bounds.y})`);

    return window;
  }

  private generateIdentifierHTML(
    number: number, 
    display: Electron.Display, 
    fontSize: number, 
    backgroundColor: string
  ): string {
    const { bounds } = display;
    
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Display ${number}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      width: 100vw;
      height: 100vh;
      background: ${backgroundColor};
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: 'Segoe UI', Arial, sans-serif;
      overflow: hidden;
      cursor: pointer;
      user-select: none;
      position: relative;
    }
    
    .identifier {
      text-align: center;
      color: white;
      animation: pulse 1.5s ease-in-out infinite alternate;
    }
    
    .number {
      font-size: ${fontSize}px;
      font-weight: 900;
      line-height: 1;
      text-shadow: 0 0 20px rgba(255, 255, 255, 0.5);
      margin-bottom: 20px;
    }
    
    .info {
      font-size: 24px;
      font-weight: 600;
      opacity: 0.8;
      margin-bottom: 10px;
    }
    
    .resolution {
      font-size: 18px;
      opacity: 0.6;
      font-weight: normal;
    }
    
    .close-hint {
      position: absolute;
      bottom: 30px;
      left: 50%;
      transform: translateX(-50%);
      font-size: 14px;
      opacity: 0.4;
      color: white;
    }
    
    @keyframes pulse {
      0% { 
        opacity: 0.7; 
        transform: scale(1);
      }
      100% { 
        opacity: 1; 
        transform: scale(1.05);
      }
    }
    
    /* Make it more visible on light backgrounds */
    @media (prefers-color-scheme: light) {
      .number {
        text-shadow: 
          0 0 10px rgba(0, 0, 0, 0.8),
          2px 2px 4px rgba(0, 0, 0, 0.5);
      }
    }
  </style>
</head>
<body>
  <div class="identifier">
    <div class="number">${number}</div>
    <div class="info">Display ${number}</div>
    <div class="resolution">${bounds.width} × ${bounds.height}</div>
  </div>
  
  <div class="close-hint">
    Will close automatically in 5 seconds
  </div>

  <script>
    // Prevent any interaction
    document.addEventListener('contextmenu', e => e.preventDefault());
    document.addEventListener('selectstart', e => e.preventDefault());
    document.addEventListener('dragstart', e => e.preventDefault());
    
    // Close on any key press or click
    document.addEventListener('keydown', () => {
      window.close();
    });
    
    document.addEventListener('click', () => {
      window.close();
    });
    
    // Emergency close with ESC
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        window.close();
      }
    });

    // Add some dynamic effects
    let startTime = Date.now();
    
    function updateTimer() {
      const elapsed = (Date.now() - startTime) / 1000;
      const remaining = Math.max(0, 5 - elapsed);
      
      const hintElement = document.querySelector('.close-hint');
      if (hintElement && remaining > 0) {
        hintElement.textContent = \`Will close automatically in \${Math.ceil(remaining)} seconds\`;
      }
      
      if (remaining > 0) {
        requestAnimationFrame(updateTimer);
      }
    }
    
    updateTimer();
  </script>
</body>
</html>`;
  }

  public isIdentifying(): boolean {
    return this.isActive;
  }

  public getActiveWindowsCount(): number {
    return this.identifierWindows.filter(w => !w.isDestroyed()).length;
  }

  public getDisplayInfo(): Array<{displayId: number, bounds: Electron.Rectangle}> {
    return screen.getAllDisplays().map((display, index) => ({
      displayId: index + 1,
      bounds: display.bounds
    }));
  }

  public forceCloseAllWindows(): void {
    console.log('🚨 Force closing all identifier windows...');
    
    this.identifierWindows.forEach((window, index) => {
      if (!window.isDestroyed()) {
        try {
          window.setKiosk(false); // Exit kiosk mode first
          window.setAlwaysOnTop(false); // Remove always on top
          window.destroy(); // Force destroy instead of close
        } catch (error) {
          console.error(`Error force destroying identifier window ${index + 1}:`, error);
        }
      }
    });

    this.identifierWindows = [];
    this.isActive = false;
  }

  public cleanup(): void {
    this.forceCloseAllWindows();
  }
}
