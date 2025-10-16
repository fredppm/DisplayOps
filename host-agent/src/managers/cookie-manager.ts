import { BrowserWindow, session, Cookie, screen } from 'electron';
import { join } from 'path';
import { logger } from '../utils/logger';

export interface CookieInfo extends Cookie {
  displayDomain?: string;
}

export class CookieManager {
  private cookieWindow: BrowserWindow | null = null;

  public async openCookieEditor(): Promise<void> {
    try {
      if (this.cookieWindow && !this.cookieWindow.isDestroyed()) {
        this.cookieWindow.focus();
        return;
      }

      logger.debug('Creating cookie editor...');

      // Get screen dimensions to center the window
      const primaryDisplay = screen.getPrimaryDisplay();
      const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;
      
      // Define window dimensions - normal size, not maximized
      const windowWidth = 800;
      const windowHeight = 600;
      
      // Center the window on screen
      const x = Math.round((screenWidth - windowWidth) / 2);
      const y = Math.round((screenHeight - windowHeight) / 2);

      logger.debug(`Positioning cookie editor: x=${x}, y=${y}, width=${windowWidth}, height=${windowHeight}`);

      this.cookieWindow = new BrowserWindow({
        width: windowWidth,
        height: windowHeight,
        x,
        y,
        frame: false,
        transparent: true,
        skipTaskbar: false,
        resizable: true,
        minimizable: true,
        maximizable: true,
        closable: true,
        alwaysOnTop: false,
        focusable: true,
        movable: true,
        show: false,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          preload: join(__dirname, '../preload/cookie-preload.js'),
          webSecurity: false
        }
      });

      logger.debug('BrowserWindow created successfully');

      // Load the cookie editor HTML
      let cookieEditorPath: string;
      let htmlFileFound = false;
      
      // First try the compiled path
      cookieEditorPath = join(__dirname, '../renderer/cookie-editor.html');
      
      if (require('fs').existsSync(cookieEditorPath)) {
        htmlFileFound = true;
      } else {
        // If that doesn't exist, try the source path (for development)
        cookieEditorPath = join(__dirname, '../../src/renderer/cookie-editor.html');
        
        if (require('fs').existsSync(cookieEditorPath)) {
          htmlFileFound = true;
        } else {
          // If still doesn't exist, try the current working directory
          cookieEditorPath = join(process.cwd(), 'src/renderer/cookie-editor.html');
          
          if (require('fs').existsSync(cookieEditorPath)) {
            htmlFileFound = true;
          }
        }
      }
      
      if (!htmlFileFound) {
        throw new Error(`Cookie editor HTML file not found. Tried all paths. Current __dirname: ${__dirname}`);
      }
      
      logger.debug(`Loading HTML file: ${cookieEditorPath}`);
      
      if (this.cookieWindow && !this.cookieWindow.isDestroyed()) {
        await this.cookieWindow.loadFile(cookieEditorPath);
        logger.debug('HTML file loaded successfully');
        
        // Show the window after content is loaded
        this.cookieWindow.show();
        this.cookieWindow.focus();
      } else {
        throw new Error('BrowserWindow was destroyed before loading HTML');
      }

      // Handle window events
      this.cookieWindow.on('closed', () => {
        logger.debug('Cookie editor closed');
        this.cookieWindow = null;
      });

      // Remove auto-close behavior - window should only close when explicitly closed

      logger.success('Cookie editor created successfully!');
      
    } catch (error) {
      logger.critical('Failed to create cookie editor:', error);
      
      // Clean up if there was an error
      if (this.cookieWindow && !this.cookieWindow.isDestroyed()) {
        this.cookieWindow.close();
        this.cookieWindow = null;
      }
      
      // Re-throw the error so the caller knows something went wrong
      throw error;
    }
  }

  public async getAllCookies(): Promise<{ [domain: string]: CookieInfo[] }> {
    try {
      console.log('🍪 [COOKIE-MANAGER] Fetching all cookies from Electron session...');
      const cookies = await session.defaultSession.cookies.get({});
      console.log(`🍪 [COOKIE-MANAGER] Retrieved ${cookies.length} total cookies from session`);
      
      const cookiesByDomain: { [domain: string]: CookieInfo[] } = {};

      for (const cookie of cookies) {
        const displayDomain = cookie.domain || 'localhost';
        
        if (!cookiesByDomain[displayDomain]) {
          cookiesByDomain[displayDomain] = [];
        }

        // Log detailed cookie info for debugging
        console.log(`🍪 [COOKIE-MANAGER] Cookie: ${cookie.name} | Domain: ${displayDomain} | Value: ${cookie.value?.substring(0, 30)}... | Secure: ${cookie.secure} | HttpOnly: ${cookie.httpOnly} | Path: ${cookie.path}`);

        cookiesByDomain[displayDomain].push({
          ...cookie,
          displayDomain
        });
      }

      // Sort domains alphabetically
      const sortedDomains = Object.keys(cookiesByDomain).sort((a, b) => {
        return a.localeCompare(b);
      });

      const sortedCookies: { [domain: string]: CookieInfo[] } = {};
      for (const domain of sortedDomains) {
        sortedCookies[domain] = cookiesByDomain[domain];
        console.log(`🍪 [COOKIE-MANAGER] Domain "${domain}" has ${cookiesByDomain[domain].length} cookies`);
      }

      console.log(`🍪 [COOKIE-MANAGER] Organized cookies into ${Object.keys(sortedCookies).length} domains`);
      return sortedCookies;
    } catch (error) {
      logger.error('Error getting cookies:', error);
      console.error('🍪 [COOKIE-MANAGER] Failed to fetch cookies:', error);
      throw error;
    }
  }

  public async setCookie(url: string, cookie: {
    name: string;
    value: string;
    domain?: string;
    path?: string;
    secure?: boolean;
    httpOnly?: boolean;
    expirationDate?: number;
  }): Promise<void> {
    try {
      console.log(`🍪 [COOKIE-MANAGER] Setting cookie manually: ${cookie.name}`);
      console.log(`🍪 [COOKIE-MANAGER] Cookie details:`, {
        url,
        name: cookie.name,
        value: cookie.value.substring(0, 50) + (cookie.value.length > 50 ? '...' : ''),
        domain: cookie.domain,
        path: cookie.path || '/',
        secure: cookie.secure,
        httpOnly: cookie.httpOnly,
        expirationDate: cookie.expirationDate
      });

      const cookieOptions = {
        url,
        name: cookie.name,
        value: cookie.value,
        domain: cookie.domain,
        path: cookie.path || '/',
        secure: cookie.secure,
        httpOnly: cookie.httpOnly,
        expirationDate: cookie.expirationDate
      };

      await session.defaultSession.cookies.set(cookieOptions);

      // Verify the cookie was set
      const verification = await session.defaultSession.cookies.get({ name: cookie.name });
      const matchingCookie = verification.find(c => c.name === cookie.name);
      
      if (matchingCookie) {
        console.log(`✅ [COOKIE-MANAGER] Cookie "${cookie.name}" set and verified successfully`);
        console.log(`✅ [COOKIE-MANAGER] Verified cookie:`, {
          name: matchingCookie.name,
          domain: matchingCookie.domain,
          path: matchingCookie.path,
          secure: matchingCookie.secure,
          httpOnly: matchingCookie.httpOnly
        });
      } else {
        console.warn(`⚠️ [COOKIE-MANAGER] Cookie "${cookie.name}" was set but not found in verification`);
      }

      logger.info(`Cookie set: ${cookie.name} for ${cookie.domain || url}`);
    } catch (error) {
      logger.error('Error setting cookie:', error);
      console.error(`❌ [COOKIE-MANAGER] Failed to set cookie "${cookie.name}":`, error);
      throw error;
    }
  }

  public async removeCookie(url: string, name: string): Promise<void> {
    try {
      await session.defaultSession.cookies.remove(url, name);
      logger.info(`Cookie removed: ${name} from ${url}`);
    } catch (error) {
      logger.error('Error removing cookie:', error);
      throw error;
    }
  }

  public async clearAllCookies(): Promise<void> {
    try {
      await session.defaultSession.clearStorageData({
        storages: ['cookies']
      });
      logger.info('All cookies cleared');
    } catch (error) {
      logger.error('Error clearing cookies:', error);
      throw error;
    }
  }

  public close(): void {
    if (this.cookieWindow && !this.cookieWindow.isDestroyed()) {
      this.cookieWindow.close();
    }
  }
}