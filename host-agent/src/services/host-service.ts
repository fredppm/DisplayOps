import { ConfigManager } from '../managers/config-manager';
import { HealthCheckResponse, HostStatus, DisplayStatus, ApiResponse } from '../../../shared/types';
import { StateManager } from './state-manager';
import { logger } from '../utils/logger';
import os from 'os';

export class HostService {
  private configManager: ConfigManager;
  private hostStatus: HostStatus;
  private displayStatuses: Map<string, DisplayStatus>;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private lastCpuInfo: any = null;
  private lastCpuTime: number = Date.now();
  private stateManager: StateManager;

  constructor(configManager: ConfigManager, stateManager?: StateManager) {
    this.configManager = configManager;
    this.stateManager = stateManager || new StateManager();
    this.hostStatus = this.initializeHostStatus();
    this.displayStatuses = new Map();
    
    this.initializeDisplayStatuses();
    this.startHealthChecks();
  }

  private initializeHostStatus(): HostStatus {
    return {
      online: true,
      cpuUsage: 0,
      memoryUsage: 0,
      browserProcesses: 0,
      lastError: undefined
    };
  }

  private initializeDisplayStatuses(): void {
    const displays = this.configManager.getDisplays();
    
    displays.forEach(display => {
      // Get dashboard data and current state from StateManager
      const assignedDashboard = this.stateManager.getAssignedDashboard(display.id);
      const currentState = this.stateManager.getDisplayState(display.id);
      
      this.displayStatuses.set(display.id, {
        active: currentState?.isActive || false, // Use real state from StateManager
        currentUrl: undefined,
        lastRefresh: new Date(),
        isResponsive: true,
        errorCount: 0,
        lastError: undefined,
        windowId: currentState?.windowId, // Include windowId from state
        assignedDashboard: assignedDashboard ? {
          dashboardId: assignedDashboard.dashboardId,
          url: assignedDashboard.url,
          refreshInterval: assignedDashboard.refreshInterval,
          deployedAt: assignedDashboard.deployedAt.toISOString()
        } : undefined
      });
    });
    
    // 🔍 LOG: Display status initialization with dashboard data
    logger.debug(`Initialized ${displays.length} displays with dashboard states`);
  }

  private startHealthChecks(): void {
    const interval = this.configManager.getSettings().healthCheckInterval;
    
    this.healthCheckInterval = setInterval(() => {
      this.updateHostStatus();
    }, interval);

    console.log(`Health checks started (interval: ${interval}ms)`);
  }

  private updateHostStatus(): void {
    try {
      // Update CPU usage (simplified)
      const cpuUsage = this.getCPUUsage();
      
      // Update memory usage - REAL system memory, not process memory
      const totalMemory = os.totalmem();
      const freeMemory = os.freemem();
      const usedMemory = totalMemory - freeMemory;
      const memoryUsage = (usedMemory / totalMemory) * 100;

      // Count browser processes (simplified - in real implementation would check actual processes)
      const browserProcesses = this.countBrowserProcesses();

      this.hostStatus = {
        online: true,
        cpuUsage: Math.round(cpuUsage * 100) / 100,
        memoryUsage: Math.round(memoryUsage * 100) / 100,
        browserProcesses,
        lastError: this.hostStatus.lastError
      };

    } catch (error) {
      console.error('Error updating host status:', error);
      this.hostStatus.lastError = error instanceof Error ? error.message : 'Unknown error';
    }
  }

  private getCPUUsage(): number {
    return this.calculateRealCpuUsage();
  }

  private calculateRealCpuUsage(): number {
    try {
      const cpus = os.cpus();
      const now = Date.now();
      
      // Calculate total CPU times for all cores
      let totalIdle = 0;
      let totalTick = 0;
      
      cpus.forEach((cpu: any) => {
        for (const type in cpu.times) {
          totalTick += cpu.times[type];
        }
        totalIdle += cpu.times.idle;
      });
      
      // If we have previous measurement, calculate the difference
      if (this.lastCpuInfo && (now - this.lastCpuTime) > 1000) {
        const idleDiff = totalIdle - this.lastCpuInfo.idle;
        const totalDiff = totalTick - this.lastCpuInfo.total;
        
        const cpuUsagePercent = totalDiff > 0 ? 100 - (idleDiff / totalDiff * 100) : 0;
        
        // Store current values for next calculation
        this.lastCpuInfo = { idle: totalIdle, total: totalTick };
        this.lastCpuTime = now;
        
        return Math.max(0, Math.min(100, cpuUsagePercent));
      } else {
        // First measurement or too soon - use load average as fallback
        const loadAvg = os.loadavg();
        const cpuCount = cpus.length;
        const loadBasedUsage = Math.min((loadAvg[0] / cpuCount) * 100, 100);
        
        // Store current values
        this.lastCpuInfo = { idle: totalIdle, total: totalTick };
        this.lastCpuTime = now;
        
        return Math.max(0, loadBasedUsage);
      }
    } catch (error) {
      console.error('Error calculating CPU usage:', error);
      
      // Fallback to load average
      try {
        const loadAvg = os.loadavg();
        const cpuCount = os.cpus().length;
        return Math.min((loadAvg[0] / cpuCount) * 100, 100);
      } catch (fallbackError) {
        return 0; // Safe fallback
      }
    }
  }

  private countBrowserProcesses(): number {
    // Simplified browser process counting
    // In a real implementation, you'd check for actual Electron renderer processes
    return this.displayStatuses.size;
  }

  public getSystemStatus(): HealthCheckResponse {
    const systemInfo = this.configManager.getSystemInfo();
    
    return {
      hostStatus: this.hostStatus,
      displayStatuses: Array.from(this.displayStatuses.values()), // Return all display statuses
      systemInfo: {
        uptime: systemInfo.uptime,
        platform: systemInfo.platform,
        nodeVersion: systemInfo.nodeVersion,
        agentVersion: systemInfo.agentVersion
      }
    };
  }

  public updateDisplayStatus(displayId: string, updates: Partial<DisplayStatus>): void {
    const currentStatus = this.displayStatuses.get(displayId);
    if (currentStatus) {
      this.displayStatuses.set(displayId, {
        ...currentStatus,
        ...updates
      });
    }
  }

  public getDisplayStatus(displayId: string): DisplayStatus | undefined {
    return this.displayStatuses.get(displayId);
  }

  public getAllDisplayStatuses(): DisplayStatus[] {
    return Array.from(this.displayStatuses.values());
  }

  public refreshDisplayStatuses(): void {
    // Clear existing display statuses
    this.displayStatuses.clear();
    
    // Reinitialize with current configuration and dashboard data
    this.initializeDisplayStatuses();
    
    console.log(`🔄 Refreshed display statuses: ${this.displayStatuses.size} displays`);
  }

  public forceRefreshFromSystem(): void {
    console.log('🔄 Force refreshing displays from system...');
    
    // Clear existing display statuses
    this.displayStatuses.clear();
    
    // Get fresh display configuration from system
    const displays = this.configManager.getDisplays();
    
    // Create new display statuses with dashboard data
    displays.forEach(display => {
      // Get dashboard data and current state from StateManager
      const assignedDashboard = this.stateManager.getAssignedDashboard(display.id);
      const currentState = this.stateManager.getDisplayState(display.id);
      
      this.displayStatuses.set(display.id, {
        active: currentState?.isActive || false, // Use real state from StateManager
        currentUrl: undefined,
        lastRefresh: currentState?.lastRefresh || new Date(),
        isResponsive: currentState?.isResponsive || true,
        errorCount: 0,
        lastError: undefined,
        windowId: currentState?.windowId, // Include windowId from state
        assignedDashboard: assignedDashboard ? {
          dashboardId: assignedDashboard.dashboardId,
          url: assignedDashboard.url,
          refreshInterval: assignedDashboard.refreshInterval,
          deployedAt: assignedDashboard.deployedAt.toISOString()
        } : undefined
      });
    });
    
    console.log(`🔄 Force refreshed display statuses: ${this.displayStatuses.size} displays`);
  }

  public reportError(error: string, displayId?: string): void {
    console.error('Host service error:', error);
    
    if (displayId) {
      const displayStatus = this.displayStatuses.get(displayId);
      if (displayStatus) {
        this.updateDisplayStatus(displayId, {
          errorCount: displayStatus.errorCount + 1,
          lastError: error,
          isResponsive: false
        });
      }
    } else {
      this.hostStatus.lastError = error;
    }
  }

  public clearError(displayId?: string): void {
    if (displayId) {
      const displayStatus = this.displayStatuses.get(displayId);
      if (displayStatus) {
        this.updateDisplayStatus(displayId, {
          lastError: undefined,
          errorCount: 0,
          isResponsive: true
        });
      }
    } else {
      this.hostStatus.lastError = undefined;
    }
  }

  public createApiResponse<T>(success: boolean, data?: T, error?: string): ApiResponse<T> {
    return {
      success,
      data,
      error,
      timestamp: new Date()
    };
  }

  public destroy(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  // gRPC compatibility methods
  public async setCookie(cookieData: any): Promise<boolean> {
    try {
      logger.debug(`Setting cookie: ${cookieData.name} for domain ${cookieData.domain}`);

      // Use Electron's session API to set cookies
      const { session } = require('electron');
      const defaultSession = session.defaultSession;
      
      if (!defaultSession) {
        throw new Error('No default Electron session available');
      }

      // Prepare cookie for Electron - try different URL formats
      let cookieUrl = `https://${cookieData.domain}${cookieData.path || '/'}`;
      
      // If domain starts with a dot, remove it for the URL but keep it for domain
      const cleanDomain = cookieData.domain?.startsWith('.') ? cookieData.domain.substring(1) : cookieData.domain;
      if (cleanDomain !== cookieData.domain) {
        cookieUrl = `https://${cleanDomain}${cookieData.path || '/'}`;
      }
      
      logger.debug(`Using URL for cookie: ${cookieUrl}`);
      
      const electronCookie = {
        url: cookieUrl,
        name: cookieData.name,
        value: cookieData.value,
        domain: cookieData.domain, // Keep original domain (may start with .)
        path: cookieData.path || '/',
        secure: cookieData.secure !== false,
        httpOnly: cookieData.httpOnly || false,
        expirationDate: cookieData.expires ? Math.floor(cookieData.expires.getTime() / 1000) : undefined,
        sameSite: cookieData.sameSite || 'lax'
      };

      // Remove undefined properties
      Object.keys(electronCookie).forEach(key => {
        if ((electronCookie as any)[key] === undefined) {
          delete (electronCookie as any)[key];
        }
      });

      logger.debug(`Setting cookie in Electron session: ${cookieData.name}`);
      
      let cookieSetSuccessfully = false;
      let attemptNumber = 1;
      
      // Attempt 1: Try with full cookie configuration
      try {
        logger.debug(`Attempt ${attemptNumber}: Setting cookie with full config`);
        await defaultSession.cookies.set(electronCookie);
        cookieSetSuccessfully = true;
        logger.debug(`Cookie set attempt ${attemptNumber} succeeded`);
      } catch (error) {
        attemptNumber++;
        logger.debug(`Cookie set attempt ${attemptNumber - 1} failed:`, error.message);
        
        // Attempt 2: Try without explicit domain - let Electron infer from URL
        try {
          const simplifiedCookie = {
            url: cookieUrl,
            name: cookieData.name,
            value: cookieData.value,
            path: cookieData.path || '/',
            secure: cookieData.secure !== false,
            httpOnly: cookieData.httpOnly || false,
            expirationDate: cookieData.expires ? Math.floor(cookieData.expires.getTime() / 1000) : undefined,
            sameSite: cookieData.sameSite || 'lax'
          };
          
          // Remove undefined properties
          Object.keys(simplifiedCookie).forEach(key => {
            if ((simplifiedCookie as any)[key] === undefined) {
              delete (simplifiedCookie as any)[key];
            }
          });
          
          logger.debug(`Attempt ${attemptNumber}: Trying simplified cookie`);
          await defaultSession.cookies.set(simplifiedCookie);
          cookieSetSuccessfully = true;
          logger.debug(`Cookie set attempt ${attemptNumber} succeeded`);
        } catch (error2) {
          attemptNumber++;
          logger.debug(`Cookie set attempt ${attemptNumber - 1} failed:`, error2.message);
          
          // Attempt 3: Try with HTTP URL (non-secure)
          try {
            const httpUrl = cookieUrl.replace('https://', 'http://');
            const httpCookie = {
              url: httpUrl,
              name: cookieData.name,
              value: cookieData.value,
              path: cookieData.path || '/',
              secure: false, // Force non-secure for HTTP
              httpOnly: cookieData.httpOnly || false,
              sameSite: 'lax'
            };
            
            logger.debug(`Attempt ${attemptNumber}: Trying HTTP cookie`);
            await defaultSession.cookies.set(httpCookie);
            cookieSetSuccessfully = true;
            logger.debug(`Cookie set attempt ${attemptNumber} succeeded with HTTP`);
          } catch (error3) {
            logger.error(`All ${attemptNumber} cookie set attempts failed. Last error:`, error3.message);
            throw error3; // Re-throw the last error
          }
        }
      }
      
      // Verify the cookie was set - try multiple search methods
      logger.debug(`Verifying cookie "${cookieData.name}" was set`);
      
      // Method 1: Search by name
      let verification = await defaultSession.cookies.get({ name: cookieData.name });
      let matchingCookie = verification.find((c: any) => c.name === cookieData.name);
      
      if (!matchingCookie) {
        // Method 2: Search by domain
        verification = await defaultSession.cookies.get({ domain: cookieData.domain });
        matchingCookie = verification.find((c: any) => c.name === cookieData.name);
      }
      
      if (!matchingCookie) {
        // Method 3: Get all cookies and search manually
        verification = await defaultSession.cookies.get({});
        matchingCookie = verification.find((c: any) => 
          c.name === cookieData.name && 
          (c.domain === cookieData.domain || c.domain === `.${cookieData.domain}`)
        );
        
        if (!matchingCookie) {
          // Method 4: Look for the cookie by name only (ignore domain)
          matchingCookie = verification.find((c: any) => c.name === cookieData.name);
          if (matchingCookie) {
            logger.debug(`Found cookie "${cookieData.name}" with domain mismatch: expected ${cookieData.domain}, got ${matchingCookie.domain}`);
          }
        }
      }
      
      if (matchingCookie) {
        logger.debug(`Cookie "${cookieData.name}" set and verified successfully`);
        return true;
      } else {
        logger.warn(`Cookie "${cookieData.name}" was set but not found in verification for domain ${cookieData.domain}`);
        
        // Log all cookies for debugging
        const allCookies = await defaultSession.cookies.get({});
        logger.debug(`Session contains ${allCookies.length} total cookies`);
        
        // Try to understand if the cookie expired immediately
        if (cookieData.expires && logger.shouldLog && logger.shouldLog(3)) {
          const expiresTimestamp = Math.floor(cookieData.expires.getTime() / 1000);
          const isExpired = expiresTimestamp <= (Date.now() / 1000);
          logger.debug(`Cookie expiration check: ${isExpired ? 'expired' : 'valid'}`);
        }
        
        return false;
      }
    } catch (error) {
      logger.error(`Failed to set cookie "${cookieData.name}":`, error.message);
      return false;
    }
  }

  public async clearDomainCookies(domain: string): Promise<boolean> {
    try {
      logger.debug(`Clearing existing cookies for domain: ${domain}`);
      
      const { session } = require('electron');
      const defaultSession = session.defaultSession;
      
      if (!defaultSession) {
        throw new Error('No default Electron session available');
      }

      // Get all cookies for this domain and variations
      const allCookies = await defaultSession.cookies.get({});
      const domainCookies = allCookies.filter((cookie: any) => 
        cookie.domain === domain || 
        cookie.domain === `.${domain}` ||
        domain.includes(cookie.domain?.replace('.', '') || '') ||
        cookie.domain?.includes(domain)
      );

      logger.debug(`Found ${domainCookies.length} existing cookies for domain ${domain}`);

      // Remove each cookie
      for (const cookie of domainCookies) {
        try {
          const cookieUrl = `${cookie.secure ? 'https' : 'http'}://${cookie.domain}${cookie.path}`;
          await defaultSession.cookies.remove(cookieUrl, cookie.name);
          console.log(`🗑️ [HOST-SERVICE] Removed cookie: ${cookie.name} from ${cookie.domain}`);
        } catch (error) {
          logger.warn(`Failed to remove cookie ${cookie.name}:`, error.message);
        }
      }

      logger.info(`Cleared ${domainCookies.length} cookies for domain ${domain}`);
      return true;
    } catch (error) {
      logger.error(`Failed to clear cookies for domain ${domain}:`, error.message);
      return false;
    }
  }

  public async validateUrl(url: string, timeoutMs: number = 5000): Promise<boolean> {
    try {
      // Simple URL validation and reachability check
      const urlObj = new URL(url);
      
      // For this implementation, we'll just validate the URL format
      // In a real implementation, you'd make an HTTP request to check reachability
      return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
    } catch (error) {
      return false;
    }
  }

  public getHostStatus(): HostStatus {
    return this.hostStatus;
  }

  public getDisplayStatuses(): (DisplayStatus & { id: string })[] {
    return Array.from(this.displayStatuses.entries()).map(([displayId, status]) => ({
      ...status,
      id: displayId
    }));
  }
}
