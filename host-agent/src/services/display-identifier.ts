import { BrowserWindow, screen } from 'electron';
import { join } from 'path';

export interface DisplayIdentifierOptions {
  duration?: number;
  fontSize?: number;
  backgroundColor?: string;
}

export class DisplayIdentifier {
  private identifierWindows: BrowserWindow[] = [];
  private isActive: boolean = false;

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

      // Create identifier window for each display
      const windowPromises = displays.map((display, index) => 
        this.createIdentifierWindow(display, index + 1, fontSize, backgroundColor)
      );

      this.identifierWindows = await Promise.all(windowPromises);

      // Auto-close after duration
      setTimeout(() => {
        this.closeIdentifierWindows();
      }, duration * 1000);

      return `Identifying ${displays.length} displays for ${duration} seconds`;

    } catch (error) {
      console.error('Error identifying displays:', error);
      this.isActive = false;
      throw error;
    }
  }

  public closeIdentifierWindows(): void {
    console.log('🔴 Closing display identifier windows...');
    
    this.identifierWindows.forEach((window, index) => {
      if (!window.isDestroyed()) {
        try {
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
      closable: false,
      focusable: false,
      transparent: true,
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
      cursor: none;
      user-select: none;
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
    
    // Optional: Close on any key press
    document.addEventListener('keydown', () => {
      window.close();
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

  public cleanup(): void {
    this.closeIdentifierWindows();
  }
}
