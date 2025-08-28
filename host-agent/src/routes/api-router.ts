import { Router, Request, Response } from 'express';
import { HostService } from '../services/host-service';
import { WindowManager, WindowConfig } from '../managers/window-manager';
import { 
  ApiCommand, 
  CommandType, 
  OpenDashboardCommand, 
  SyncCookiesCommand,
  ApiResponse 
} from '../../../shared/types';

export class ApiRouter {
  private router: Router;
  private hostService: HostService;
  private windowManager: WindowManager;

  constructor(hostService: HostService, windowManager: WindowManager) {
    this.hostService = hostService;
    this.windowManager = windowManager;
    this.router = Router();
    this.setupRoutes();
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

    // TV/Display status
    this.router.get('/displays', this.getDisplays.bind(this));
    this.router.get('/displays/:displayId/status', this.getDisplayStatus.bind(this));
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

      let result: any;

      switch (command.type) {
        case CommandType.OPEN_DASHBOARD:
          result = await this.handleOpenDashboard(command.payload as OpenDashboardCommand);
          break;

        case CommandType.REFRESH_PAGE:
          result = await this.handleRefreshPage(command.targetTv);
          break;

        case CommandType.SYNC_COOKIES:
          result = await this.handleSyncCookies(command.payload as SyncCookiesCommand);
          break;

        case CommandType.HEALTH_CHECK:
          result = this.hostService.getSystemStatus();
          break;

        case CommandType.RESTART_BROWSER:
          result = await this.handleRestartBrowser(command.targetTv);
          break;

        case CommandType.TAKE_SCREENSHOT:
          result = await this.handleTakeScreenshot(command.targetTv);
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
      fullscreen: payload.fullscreen
    };

    const windowId = await this.windowManager.createWindow(windowConfig);
    
    // Update TV status
    this.hostService.updateTVStatus(`display-${payload.monitorIndex + 1}`, {
      active: true,
      currentUrl: payload.url,
      lastRefresh: new Date(),
      isResponsive: true
    });

    return windowId;
  }

  private async handleRefreshPage(targetTv: string): Promise<boolean> {
    const windows = this.windowManager.getAllWindows();
    const targetWindow = windows.find(w => w.id.includes(targetTv));
    
    if (!targetWindow) {
      throw new Error(`No window found for TV: ${targetTv}`);
    }

    return this.windowManager.refreshWindow(targetWindow.id);
  }

  private async handleSyncCookies(payload: SyncCookiesCommand): Promise<boolean> {
    // TODO: Implement cookie synchronization
    console.log('Cookie sync not yet implemented:', payload);
    return true;
  }

  private async handleRestartBrowser(targetTv: string): Promise<boolean> {
    const windows = this.windowManager.getAllWindows();
    const targetWindow = windows.find(w => w.id.includes(targetTv));
    
    if (!targetWindow) {
      throw new Error(`No window found for TV: ${targetTv}`);
    }

    // Close and recreate the window
    await this.windowManager.closeWindow(targetWindow.id);
    await this.windowManager.createWindow(targetWindow.config);
    
    return true;
  }

  private async handleTakeScreenshot(targetTv: string): Promise<string> {
    const windows = this.windowManager.getAllWindows();
    const targetWindow = windows.find(w => w.id.includes(targetTv));
    
    if (!targetWindow) {
      throw new Error(`No window found for TV: ${targetTv}`);
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
      const displays = this.hostService.getAllTVStatuses();
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
      const status = this.hostService.getTVStatus(displayId);
      
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

  public getRouter(): Router {
    return this.router;
  }
}
