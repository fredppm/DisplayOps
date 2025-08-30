import { BrowserWindow, session, Cookie } from 'electron';
import { logger } from '../utils/logger';

export interface CookieInfo extends Cookie {
  displayDomain?: string;
}

export class CookieManager {
  private cookieWindow: BrowserWindow | null = null;

  public async openCookieEditor(): Promise<void> {
    if (this.cookieWindow && !this.cookieWindow.isDestroyed()) {
      this.cookieWindow.focus();
      return;
    }

    this.cookieWindow = new BrowserWindow({
      width: 800,
      height: 600,
      title: 'Cookie Editor - Debug Tool',
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        webSecurity: false
      },
      autoHideMenuBar: true,
      minimizable: true,
      maximizable: true,
      resizable: true
    });

    // Load the cookie editor HTML
    const htmlPath = `file://${__dirname}/../renderer/cookie-editor.html`;
    await this.cookieWindow.loadFile(htmlPath.replace('file://', ''));

    this.cookieWindow.on('closed', () => {
      this.cookieWindow = null;
    });

    logger.info('Cookie editor window opened');
  }

  public async getAllCookies(): Promise<{ [domain: string]: CookieInfo[] }> {
    try {
      const cookies = await session.defaultSession.cookies.get({});
      const cookiesByDomain: { [domain: string]: CookieInfo[] } = {};

      for (const cookie of cookies) {
        const displayDomain = cookie.domain || 'localhost';
        
        if (!cookiesByDomain[displayDomain]) {
          cookiesByDomain[displayDomain] = [];
        }

        cookiesByDomain[displayDomain].push({
          ...cookie,
          displayDomain
        });
      }

      // Sort domains, putting grafana.vtex.com first if it exists
      const sortedDomains = Object.keys(cookiesByDomain).sort((a, b) => {
        if (a.includes('grafana.vtex.com')) return -1;
        if (b.includes('grafana.vtex.com')) return 1;
        if (a.includes('vtex.com') && !b.includes('vtex.com')) return -1;
        if (b.includes('vtex.com') && !a.includes('vtex.com')) return 1;
        return a.localeCompare(b);
      });

      const sortedCookies: { [domain: string]: CookieInfo[] } = {};
      for (const domain of sortedDomains) {
        sortedCookies[domain] = cookiesByDomain[domain];
      }

      return sortedCookies;
    } catch (error) {
      logger.error('Error getting cookies:', error);
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
      await session.defaultSession.cookies.set({
        url,
        name: cookie.name,
        value: cookie.value,
        domain: cookie.domain,
        path: cookie.path || '/',
        secure: cookie.secure,
        httpOnly: cookie.httpOnly,
        expirationDate: cookie.expirationDate
      });

      logger.info(`Cookie set: ${cookie.name} for ${cookie.domain || url}`);
    } catch (error) {
      logger.error('Error setting cookie:', error);
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