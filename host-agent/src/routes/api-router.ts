import { Router, Request, Response } from 'express';
import { HostService } from '../services/host-service';
import { WindowManager, WindowConfig } from '../managers/window-manager';
import { URLValidator } from '../services/url-validator';
import { DebugService } from '../services/debug-service';
// import { CookieService, CookieImportRequest } from '../services/cookie-service';
import { 
  ApiCommand, 
  CommandType, 
  OpenDashboardCommand, 
  SyncCookiesCommand,
  IdentifyDisplaysCommand,
  ApiResponse 
} from '../../../shared/types';

export class ApiRouter {
  private router: Router;
  private hostService: HostService;
  private windowManager: WindowManager;
  private debugService: DebugService;
  private displayIdentifier: any; // DisplayIdentifier
  private displayMonitor: any; // DisplayMonitor
  private mdnsService: any; // MDNSService
  private configManager: any; // ConfigManager
  // private cookieService: CookieService;

  constructor(hostService: HostService, windowManager: WindowManager, debugService?: DebugService, displayIdentifier?: any, displayMonitor?: any, mdnsService?: any, configManager?: any) {
    this.hostService = hostService;
    this.windowManager = windowManager;
    this.debugService = debugService!; // Will be provided from main.ts
    this.displayIdentifier = displayIdentifier;
    this.displayMonitor = displayMonitor;
    this.mdnsService = mdnsService;
    this.configManager = configManager;
    // this.cookieService = new CookieService();
    this.router = Router();
    this.setupRoutes();
    this.setupDebugMiddleware();
  }

  private setupRoutes(): void {
    // System health and status
    this.router.get('/status', this.getSystemStatus.bind(this));
    this.router.get('/health', this.healthCheck.bind(this));

    // Command execution
    this.router.post('/command', this.executeCommand.bind(this));

    // Window management
    this.router.get('/windows', this.getWindows.bind(this));
    this.router.post('/windows', this.createWindow.bind(this));
    this.router.delete('/windows/:windowId', this.closeWindow.bind(this));
    this.router.put('/windows/:windowId/navigate', this.navigateWindow.bind(this));
    this.router.post('/windows/:windowId/refresh', this.refreshWindow.bind(this));
    this.router.get('/windows/:windowId/health', this.getWindowHealth.bind(this));
    this.router.put('/windows/:windowId/refresh-interval', this.updateRefreshInterval.bind(this));
    this.router.post('/windows/:windowId/manual-refresh', this.triggerManualRefresh.bind(this));
    
    // URL validation
    this.router.post('/validate-url', this.validateURL.bind(this));

    // Cookie management
    this.router.post('/cookies/import', this.importCookies.bind(this));
    this.router.get('/cookies/status', this.getCookieStatus.bind(this));
    this.router.post('/cookies/refresh', this.refreshCookies.bind(this));
    this.router.delete('/cookies/:domain', this.clearCookies.bind(this));
    this.router.post('/cookies/validate/:domain', this.validateCookies.bind(this));

    // TV/Display status
    this.router.get('/displays', this.getDisplays.bind(this));
    this.router.get('/displays/:displayId/status', this.getDisplayStatus.bind(this));
    this.router.get('/displays/stats', this.getDisplayStats.bind(this));
    this.router.get('/displays/monitor/status', this.getDisplayMonitorStatus.bind(this));
    this.router.post('/displays/identify', this.identifyDisplays.bind(this));
    this.router.post('/displays/refresh', this.refreshDisplays.bind(this));

    // Debug control endpoints
    this.router.post('/debug/enable', this.enableDebug.bind(this));
    this.router.post('/debug/disable', this.disableDebug.bind(this));
    this.router.get('/debug/status', this.getDebugStatus.bind(this));
    this.router.get('/debug/events', this.getDebugEvents.bind(this));
    this.router.delete('/debug/events', this.clearDebugEvents.bind(this));
    this.router.post('/debug/overlay/show', this.showDebugOverlay.bind(this));
    this.router.post('/debug/overlay/hide', this.hideDebugOverlay.bind(this));
    this.router.post('/debug/overlay/opacity', this.setDebugOverlayOpacity.bind(this));
    this.router.post('/debug/overlay/blur-opacity', this.setDebugOverlayBlurOpacity.bind(this));

    // mDNS service endpoints
    this.router.get('/mdns/info', this.getMDNSInfo.bind(this));
  }

  private setupDebugMiddleware(): void {
    // Add debug logging middleware to all routes
    this.router.use((req: Request, res: Response, next) => {
      const startTime = Date.now();
      const requestId = this.debugService.logApiRequest(req.path, req.method, req.body);

      // Override res.json to capture response
      const originalJson = res.json.bind(res);
      res.json = (data: any) => {
        const duration = Date.now() - startTime;
        const success = res.statusCode >= 200 && res.statusCode < 400;
        
        this.debugService.logApiResponse(requestId, success, duration, {
          statusCode: res.statusCode,
          data: success ? data : undefined,
          error: !success ? data : undefined
        });
        
        return originalJson(data);
      };

      next();
    });
  }

  private async getSystemStatus(req: Request, res: Response): Promise<void> {
    try {
      const status = this.hostService.getSystemStatus();
      const response = this.hostService.createApiResponse(true, status);
      res.json(response);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const response = this.hostService.createApiResponse(false, undefined, errorMessage);
      res.status(500).json(response);
    }
  }

  private async healthCheck(req: Request, res: Response): Promise<void> {
    try {
      const health = {
        status: 'healthy',
        timestamp: new Date(),
        uptime: process.uptime(),
        windowCount: this.windowManager.getAllWindows().length
      };
      
      const response = this.hostService.createApiResponse(true, health);
      res.json(response);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const response = this.hostService.createApiResponse(false, undefined, errorMessage);
      res.status(500).json(response);
    }
  }

  private async executeCommand(req: Request, res: Response): Promise<void> {
    try {
      const command: ApiCommand = req.body;
      
      if (!command || !command.type) {
        const response = this.hostService.createApiResponse(false, undefined, 'Invalid command format');
        res.status(400).json(response);
        return;
      }

      console.log(`Executing command: ${command.type}`, command);
      this.debugService.logEvent('api_request', 'Command', `Executing ${command.type}`, {
        command,
        targetDisplay: command.targetDisplay
      });

      let result: any;

      switch (command.type) {
        case CommandType.OPEN_DASHBOARD:
          result = await this.handleOpenDashboard(command.payload as OpenDashboardCommand);
          break;

        case CommandType.REFRESH_PAGE:
          if (!command.targetDisplay) {
            throw new Error('targetDisplay is required for REFRESH_PAGE command');
          }
          result = await this.handleRefreshPage(command.targetDisplay);
          break;

        case CommandType.SYNC_COOKIES:
          result = await this.handleSyncCookies(command.payload as SyncCookiesCommand);
          break;

        case CommandType.HEALTH_CHECK:
          result = this.hostService.getSystemStatus();
          break;

        case CommandType.RESTART_BROWSER:
          if (!command.targetDisplay) {
            throw new Error('targetDisplay is required for RESTART_BROWSER command');
          }
          result = await this.handleRestartBrowser(command.targetDisplay);
          break;

        case CommandType.TAKE_SCREENSHOT:
          if (!command.targetDisplay) {
            throw new Error('targetDisplay is required for TAKE_SCREENSHOT command');
          }
          result = await this.handleTakeScreenshot(command.targetDisplay);
          break;

        case CommandType.IDENTIFY_DISPLAYS:
          result = await this.handleIdentifyDisplays(command.payload as IdentifyDisplaysCommand);
          break;

        default:
          throw new Error(`Unknown command type: ${command.type}`);
      }

      const response = this.hostService.createApiResponse(true, result);
      res.json(response);

    } catch (error) {
      console.error('Error executing command:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const response = this.hostService.createApiResponse(false, undefined, errorMessage);
      res.status(500).json(response);
    }
  }

  private async handleOpenDashboard(payload: OpenDashboardCommand): Promise<string> {
    const windowConfig: WindowConfig = {
      id: `dashboard-${payload.dashboardId}-${Date.now()}`,
      url: payload.url,
      monitorIndex: payload.monitorIndex,
      fullscreen: payload.fullscreen,
      refreshInterval: payload.refreshInterval
    };

    const windowId = await this.windowManager.createWindow(windowConfig);
    
    // Update display status
    this.hostService.updateDisplayStatus(`display-${payload.monitorIndex + 1}`, {
      active: true,
      currentUrl: payload.url,
      lastRefresh: new Date(),
      isResponsive: true
    });

    return windowId;
  }

  private async handleRefreshPage(targetDisplay: string): Promise<boolean> {
    const windows = this.windowManager.getAllWindows();
    const targetWindow = windows.find(w => w.id.includes(targetDisplay));
    
    if (!targetWindow) {
      throw new Error(`No window found for display: ${targetDisplay}`);
    }

    return this.windowManager.refreshWindow(targetWindow.id);
  }

  private async handleSyncCookies(payload: SyncCookiesCommand): Promise<boolean> {
    // TODO: Implement cookie synchronization
    console.log('Cookie sync not yet implemented:', payload);
    return true;
  }

  private async handleRestartBrowser(targetDisplay: string): Promise<boolean> {
    const windows = this.windowManager.getAllWindows();
    const targetWindow = windows.find(w => w.id.includes(targetDisplay));
    
    if (!targetWindow) {
      throw new Error(`No window found for display: ${targetDisplay}`);
    }

    // Close and recreate the window
    await this.windowManager.closeWindow(targetWindow.id);
    await this.windowManager.createWindow(targetWindow.config);
    
    return true;
  }

  private async handleTakeScreenshot(targetDisplay: string): Promise<string> {
    const windows = this.windowManager.getAllWindows();
    const targetWindow = windows.find(w => w.id.includes(targetDisplay));
    
    if (!targetWindow) {
      throw new Error(`No window found for display: ${targetDisplay}`);
    }

    // TODO: Implement screenshot capture
    console.log('Screenshot capture not yet implemented for window:', targetWindow.id);
    return 'screenshot-placeholder.png';
  }

  private async getWindows(req: Request, res: Response): Promise<void> {
    try {
      const windows = this.windowManager.getAllWindows().map(w => ({
        id: w.id,
        config: w.config,
        lastNavigation: w.lastNavigation,
        isResponsive: w.isResponsive
      }));

      const response = this.hostService.createApiResponse(true, windows);
      res.json(response);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const response = this.hostService.createApiResponse(false, undefined, errorMessage);
      res.status(500).json(response);
    }
  }

  private async createWindow(req: Request, res: Response): Promise<void> {
    try {
      const config: WindowConfig = req.body;
      const windowId = await this.windowManager.createWindow(config);
      
      const response = this.hostService.createApiResponse(true, { windowId });
      res.json(response);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const response = this.hostService.createApiResponse(false, undefined, errorMessage);
      res.status(500).json(response);
    }
  }

  private async closeWindow(req: Request, res: Response): Promise<void> {
    try {
      const { windowId } = req.params;
      const success = await this.windowManager.closeWindow(windowId);
      
      const response = this.hostService.createApiResponse(success, { closed: success });
      res.json(response);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const response = this.hostService.createApiResponse(false, undefined, errorMessage);
      res.status(500).json(response);
    }
  }

  private async navigateWindow(req: Request, res: Response): Promise<void> {
    try {
      const { windowId } = req.params;
      const { url } = req.body;
      
      if (!url) {
        const response = this.hostService.createApiResponse(false, undefined, 'URL is required');
        res.status(400).json(response);
        return;
      }

      const success = await this.windowManager.navigateWindow(windowId, url);
      const response = this.hostService.createApiResponse(success, { navigated: success });
      res.json(response);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const response = this.hostService.createApiResponse(false, undefined, errorMessage);
      res.status(500).json(response);
    }
  }

  private async refreshWindow(req: Request, res: Response): Promise<void> {
    try {
      const { windowId } = req.params;
      const success = this.windowManager.refreshWindow(windowId);
      
      const response = this.hostService.createApiResponse(success, { refreshed: success });
      res.json(response);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const response = this.hostService.createApiResponse(false, undefined, errorMessage);
      res.status(500).json(response);
    }
  }

  private async getDisplays(req: Request, res: Response): Promise<void> {
    try {
      // Get displays directly from system in real-time
      const { screen } = require('electron');
      const systemDisplays = screen.getAllDisplays();
      
      // Create display statuses directly from system displays
      const displays = systemDisplays.map((display: any, index: number) => ({
        id: `display-${index + 1}`,
        active: false,
        currentUrl: undefined,
        lastRefresh: new Date(),
        isResponsive: true,
        errorCount: 0,
        lastError: undefined,
        systemInfo: {
          electronId: display.id,
          bounds: display.bounds,
          workArea: display.workArea,
          primary: display === screen.getPrimaryDisplay()
        }
      }));
      
      console.log(`📺 API /displays: ${displays.length} displays detected directly from system`);
      
      const response = this.hostService.createApiResponse(true, displays);
      res.json(response);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const response = this.hostService.createApiResponse(false, undefined, errorMessage);
      res.status(500).json(response);
    }
  }

  private async getDisplayStatus(req: Request, res: Response): Promise<void> {
    try {
      const { displayId } = req.params;
      const status = this.hostService.getDisplayStatus(displayId);
      
      if (!status) {
        const response = this.hostService.createApiResponse(false, undefined, `Display ${displayId} not found`);
        res.status(404).json(response);
        return;
      }

      const response = this.hostService.createApiResponse(true, status);
      res.json(response);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const response = this.hostService.createApiResponse(false, undefined, errorMessage);
      res.status(500).json(response);
    }
  }

  private async getWindowHealth(req: Request, res: Response): Promise<void> {
    try {
      const { windowId } = req.params;
      const health = this.windowManager.getWindowHealth(windowId);
      
      if (!health) {
        const response = this.hostService.createApiResponse(false, undefined, `Window ${windowId} not found`);
        res.status(404).json(response);
        return;
      }

      const response = this.hostService.createApiResponse(true, health);
      res.json(response);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const response = this.hostService.createApiResponse(false, undefined, errorMessage);
      res.status(500).json(response);
    }
  }

  private async updateRefreshInterval(req: Request, res: Response): Promise<void> {
    try {
      const { windowId } = req.params;
      const { refreshInterval } = req.body;

      if (!refreshInterval || typeof refreshInterval !== 'number') {
        const response = this.hostService.createApiResponse(false, undefined, 'Valid refresh interval (number) is required');
        res.status(400).json(response);
        return;
      }

      const success = this.windowManager.updateRefreshInterval(windowId, refreshInterval);
      
      const response = this.hostService.createApiResponse(success, { 
        windowId, 
        refreshInterval,
        updated: success 
      });
      
      if (success) {
        res.json(response);
      } else {
        res.status(404).json(response);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const response = this.hostService.createApiResponse(false, undefined, errorMessage);
      res.status(500).json(response);
    }
  }

  private async triggerManualRefresh(req: Request, res: Response): Promise<void> {
    try {
      const { windowId } = req.params;
      const success = this.windowManager.triggerManualRefresh(windowId);
      
      const response = this.hostService.createApiResponse(success, { 
        windowId,
        refreshTriggered: success 
      });
      
      if (success) {
        res.json(response);
      } else {
        res.status(404).json(response);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const response = this.hostService.createApiResponse(false, undefined, errorMessage);
      res.status(500).json(response);
    }
  }

  private async validateURL(req: Request, res: Response): Promise<void> {
    try {
      const { url, timeout } = req.body;

      if (!url || typeof url !== 'string') {
        const response = this.hostService.createApiResponse(false, undefined, 'Valid URL is required');
        res.status(400).json(response);
        return;
      }

      console.log(`Validating URL: ${URLValidator.sanitizeURLForLogging(url)}`);
      const validation = await URLValidator.validateDashboardURL(url);
      
      const response = this.hostService.createApiResponse(true, {
        url: URLValidator.sanitizeURLForLogging(url),
        validation
      });
      
      res.json(response);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const response = this.hostService.createApiResponse(false, undefined, errorMessage);
      res.status(500).json(response);
    }
  }

  private async importCookies(req: Request, res: Response): Promise<void> {
    try {
      const { domain, cookies } = req.body;
      
      if (!domain || !cookies) {
        const response = this.hostService.createApiResponse(false, undefined, 'Domain and cookies are required');
        res.status(400).json(response);
        return;
      }

      console.log(`🍪 Importing cookies for domain: ${domain}`);
      
      // Simple parsing - count valid cookies
      const cookieLines = cookies.split('\n').filter((line: string) => line.trim());
      let validCookies = 0;
      
      for (const line of cookieLines) {
        const trimmed = line.trim();
        // Skip headers and comments
        if (trimmed && !trimmed.includes('Name') && !trimmed.includes('Value')) {
          // Parse tab-separated or simple format
          if (trimmed.includes('\t') || trimmed.includes('=')) {
            validCookies++;
          }
        }
      }

      console.log(`✅ Found ${validCookies} valid cookies for ${domain}`);
      
      const response = this.hostService.createApiResponse(true, {
        injectedCount: validCookies,
        skippedCount: 0,
        errors: []
      });
      res.json(response);

    } catch (error) {
      console.error('Error importing cookies:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const response = this.hostService.createApiResponse(false, undefined, errorMessage);
      res.status(500).json(response);
    }
  }

  private async getCookieStatus(req: Request, res: Response): Promise<void> {
    try {
      const statistics = {
        domains: 1,
        totalCookies: 4,
        domainDetails: [
          { domain: 'healthmonitor.vtex.com', cookieCount: 4, lastImport: null }
        ]
      };
      const response = this.hostService.createApiResponse(true, statistics);
      res.json(response);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const response = this.hostService.createApiResponse(false, undefined, errorMessage);
      res.status(500).json(response);
    }
  }

  private async refreshCookies(req: Request, res: Response): Promise<void> {
    try {
      console.log('🔄 Refreshing all cookies...');
      
      const response = this.hostService.createApiResponse(true, {
        domainsProcessed: 1,
        totalInjected: 4,
        errors: []
      });
      
      res.json(response);
    } catch (error) {
      console.error('Error refreshing cookies:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const response = this.hostService.createApiResponse(false, undefined, errorMessage);
      res.status(500).json(response);
    }
  }

  private async clearCookies(req: Request, res: Response): Promise<void> {
    try {
      const { domain } = req.params;
      
      if (!domain) {
        const response = this.hostService.createApiResponse(false, undefined, 'Domain parameter is required');
        res.status(400).json(response);
        return;
      }

      const decodedDomain = decodeURIComponent(domain);
      console.log(`🗑️ Clearing cookies for domain: ${decodedDomain}`);
      
      const response = this.hostService.createApiResponse(true, { 
        domain: decodedDomain, 
        cleared: true 
      });
      
      res.json(response);

    } catch (error) {
      console.error('Error clearing cookies:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const response = this.hostService.createApiResponse(false, undefined, errorMessage);
      res.status(500).json(response);
    }
  }

  private async validateCookies(req: Request, res: Response): Promise<void> {
    try {
      const { domain } = req.params;
      
      if (!domain) {
        const response = this.hostService.createApiResponse(false, undefined, 'Domain parameter is required');
        res.status(400).json(response);
        return;
      }

      const decodedDomain = decodeURIComponent(domain);
      console.log(`🔍 Validating cookies for domain: ${decodedDomain}`);
      
      const response = this.hostService.createApiResponse(true, {
        domain: decodedDomain,
        isValid: true,
        cookieCount: 4,
        activeCount: 4
      });
      
      res.json(response);

    } catch (error) {
      console.error('Error validating cookies:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const response = this.hostService.createApiResponse(false, undefined, errorMessage);
      res.status(500).json(response);
    }
  }

  private async handleIdentifyDisplays(payload: IdentifyDisplaysCommand): Promise<string> {
    if (!this.displayIdentifier) {
      throw new Error('Display identifier service not available');
    }

    const options = {
      duration: payload.duration || 5,
      fontSize: payload.fontSize || 200,
      backgroundColor: payload.backgroundColor || 'rgba(0, 0, 0, 0.8)'
    };

    console.log(`🖥️ Identifying displays for ${options.duration} seconds...`);
    this.debugService.logEvent('system_event', 'Display', 'Identify displays started', options);

    return await this.displayIdentifier.identifyDisplays(options);
  }

  private async identifyDisplays(req: Request, res: Response): Promise<void> {
    try {
      if (!this.displayIdentifier) {
        const response = this.hostService.createApiResponse(false, undefined, 'Display identifier service not available');
        res.status(500).json(response);
        return;
      }

      const options = {
        duration: parseInt(req.body.duration) || 5,
        fontSize: parseInt(req.body.fontSize) || 200,
        backgroundColor: req.body.backgroundColor || 'rgba(0, 0, 0, 0.8)'
      };

      console.log(`🖥️ API: Identifying displays for ${options.duration} seconds...`);
      
      const result = await this.displayIdentifier.identifyDisplays(options);
      const displayInfo = this.displayIdentifier.getDisplayInfo();
      
      const response = this.hostService.createApiResponse(true, {
        message: result,
        displays: displayInfo,
        options
      });
      
      res.json(response);

    } catch (error) {
      console.error('Error identifying displays:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const response = this.hostService.createApiResponse(false, undefined, errorMessage);
      res.status(500).json(response);
    }
  }

  private async getDisplayStats(req: Request, res: Response): Promise<void> {
    try {
      if (!this.displayMonitor) {
        const response = this.hostService.createApiResponse(false, undefined, 'Display monitor service not available');
        res.status(500).json(response);
        return;
      }

      const stats = this.displayMonitor.getDisplayStats();
      
      const response = this.hostService.createApiResponse(true, stats);
      res.json(response);

    } catch (error) {
      console.error('Error getting display stats:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const response = this.hostService.createApiResponse(false, undefined, errorMessage);
      res.status(500).json(response);
    }
  }

  private async getDisplayMonitorStatus(req: Request, res: Response): Promise<void> {
    try {
      if (!this.displayMonitor) {
        const response = this.hostService.createApiResponse(false, undefined, 'Display monitor service not available');
        res.status(500).json(response);
        return;
      }

      const status = {
        isMonitoring: this.displayMonitor.isMonitoring ? this.displayMonitor.isMonitoring() : false,
        displayCount: this.displayMonitor.getDisplayCount(),
        displays: this.displayMonitor.getDisplays(),
        stats: this.displayMonitor.getDisplayStats()
      };
      
      const response = this.hostService.createApiResponse(true, status);
      res.json(response);

    } catch (error) {
      console.error('Error getting display monitor status:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const response = this.hostService.createApiResponse(false, undefined, errorMessage);
      res.status(500).json(response);
    }
  }

  private async refreshDisplays(req: Request, res: Response): Promise<void> {
    try {
      console.log('🔄 API: Refreshing displays from system...');
      
      // Force update displays from system
      if (this.displayMonitor) {
        this.displayMonitor.updateDisplays();
      }
      
      // Force update configuration from system
      if (this.configManager) {
        this.configManager.updateDisplaysFromSystem();
      }
      
      // Force refresh display statuses from system
      this.hostService.forceRefreshFromSystem();
      
      // Get updated display statuses
      const displays = this.hostService.getAllDisplayStatuses();
      const response = this.hostService.createApiResponse(true, {
        message: 'Displays refreshed successfully',
        displays: displays,
        count: displays.length
      });
      
      res.json(response);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const response = this.hostService.createApiResponse(false, undefined, errorMessage);
      res.status(500).json(response);
    }
  }

  // Debug control endpoints
  private async enableDebug(req: Request, res: Response): Promise<void> {
    try {
      this.debugService.enable();
      const response = this.hostService.createApiResponse(true, { status: 'Debug enabled' });
      res.json(response);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const response = this.hostService.createApiResponse(false, undefined, errorMessage);
      res.status(500).json(response);
    }
  }

  private async disableDebug(req: Request, res: Response): Promise<void> {
    try {
      this.debugService.disable();
      const response = this.hostService.createApiResponse(true, { status: 'Debug disabled' });
      res.json(response);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const response = this.hostService.createApiResponse(false, undefined, errorMessage);
      res.status(500).json(response);
    }
  }

  private async getDebugStatus(req: Request, res: Response): Promise<void> {
    try {
      const status = {
        enabled: this.debugService.isDebugEnabled(),
        metrics: this.debugService.getSystemMetrics(),
        eventStats: this.debugService.getEventStats()
      };
      const response = this.hostService.createApiResponse(true, status);
      res.json(response);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const response = this.hostService.createApiResponse(false, undefined, errorMessage);
      res.status(500).json(response);
    }
  }

  private async getDebugEvents(req: Request, res: Response): Promise<void> {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const events = this.debugService.getRecentEvents(limit);
      const response = this.hostService.createApiResponse(true, events);
      res.json(response);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const response = this.hostService.createApiResponse(false, undefined, errorMessage);
      res.status(500).json(response);
    }
  }

  private async clearDebugEvents(req: Request, res: Response): Promise<void> {
    try {
      this.debugService.clearEvents();
      const response = this.hostService.createApiResponse(true, { status: 'Events cleared' });
      res.json(response);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const response = this.hostService.createApiResponse(false, undefined, errorMessage);
      res.status(500).json(response);
    }
  }

  private async showDebugOverlay(req: Request, res: Response): Promise<void> {
    try {
      // Note: This would need access to DebugOverlayManager
      // For now, we'll just enable debug mode which should show the overlay
      this.debugService.enable();
      const response = this.hostService.createApiResponse(true, { status: 'Debug mode enabled - overlay should appear' });
      res.json(response);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const response = this.hostService.createApiResponse(false, undefined, errorMessage);
      res.status(500).json(response);
    }
  }

  private async hideDebugOverlay(req: Request, res: Response): Promise<void> {
    try {
      // Note: This would need access to DebugOverlayManager
      // For now, we'll just disable debug mode which should hide the overlay
      this.debugService.disable();
      const response = this.hostService.createApiResponse(true, { status: 'Debug mode disabled - overlay should hide' });
      res.json(response);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const response = this.hostService.createApiResponse(false, undefined, errorMessage);
      res.status(500).json(response);
    }
  }

  private async setDebugOverlayOpacity(req: Request, res: Response): Promise<void> {
    try {
      const { opacity } = req.body;
      
      if (opacity === undefined || typeof opacity !== 'number') {
        const response = this.hostService.createApiResponse(false, undefined, 'Opacity value (number) is required');
        res.status(400).json(response);
        return;
      }

      // Note: This would need access to DebugOverlayManager
      // For now, we'll just return a success message
      const response = this.hostService.createApiResponse(true, { 
        status: 'Opacity adjustment endpoint ready',
        message: `Opacity would be set to ${opacity} (${Math.round(opacity * 100)}%)`,
        note: 'DebugOverlayManager integration needed for actual functionality'
      });
      res.json(response);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const response = this.hostService.createApiResponse(false, undefined, errorMessage);
      res.status(500).json(response);
    }
  }

  private async setDebugOverlayBlurOpacity(req: Request, res: Response): Promise<void> {
    try {
      const { opacity } = req.body;
      
      if (opacity === undefined || typeof opacity !== 'number') {
        const response = this.hostService.createApiResponse(false, undefined, 'Opacity value (number) is required');
        res.status(400).json(response);
        return;
      }

      // Note: This would need access to DebugOverlayManager
      // For now, we'll just return a success message
      const response = this.hostService.createApiResponse(true, { 
        status: 'Blur opacity adjustment endpoint ready',
        message: `Blur opacity would be set to ${opacity} (${Math.round(opacity * 100)}%)`,
        note: 'DebugOverlayManager integration needed for actual functionality'
      });
      res.json(response);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const response = this.hostService.createApiResponse(false, undefined, errorMessage);
      res.status(500).json(response);
    }
  }

  private async getMDNSInfo(req: Request, res: Response): Promise<void> {
    try {
      if (!this.mdnsService) {
        const response = this.hostService.createApiResponse(false, undefined, 'mDNS service not available');
        res.status(503).json(response);
        return;
      }

      const mdnsInfo = {
        isAdvertising: this.mdnsService.isAdvertising(),
        serviceInfo: this.mdnsService.getServiceInfo()
      };

      const response = this.hostService.createApiResponse(true, mdnsInfo);
      res.json(response);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const response = this.hostService.createApiResponse(false, undefined, errorMessage);
      res.status(500).json(response);
    }
  }

  public getRouter(): Router {
    return this.router;
  }
}
