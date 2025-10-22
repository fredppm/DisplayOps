import { EventEmitter } from 'events';
import axios, { AxiosInstance } from 'axios';
import { ConfigManager } from '../managers/config-manager';
import { StateManager } from './state-manager';
import { HostService } from './host-service';
import { WindowManager } from '../managers/window-manager';
import { DebugService } from './debug-service';
import { DisplayIdentifier } from './display-identifier';
import { logger } from '../utils/logger';
import os from 'os';

/**
 * HTTP Client Service
 * 
 * Replaces Socket.IO with HTTP polling
 * Compatible with Vercel serverless functions
 * 
 * Handles:
 * - Heartbeat via HTTP POST
 * - Command polling via HTTP GET
 * - Metrics reporting via HTTP POST
 * - Logs streaming via HTTP POST
 */
export class HttpClientService extends EventEmitter {
  private httpClient: AxiosInstance;
  private configManager: ConfigManager;
  private stateManager: StateManager;
  private hostService: HostService;
  private windowManager: WindowManager;
  private debugService: DebugService;
  private displayIdentifier: DisplayIdentifier;
  private webAdminUrl: string;
  private agentId: string;
  
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private heartbeatIntervalMs: number = 30000; // 30 seconds
  
  private commandPollInterval: NodeJS.Timeout | null = null;
  private commandPollIntervalMs: number = 2000; // 2 seconds - faster polling for better responsiveness
  
  private metricsInterval: NodeJS.Timeout | null = null;
  private metricsIntervalMs: number = 10000; // 10 seconds
  
  private logStreamInterval: NodeJS.Timeout | null = null;
  private logStreamIntervalMs: number = 3000; // 3 seconds
  private lastLogId: string = '';
  
  private isRunning: boolean = false;
  private serverOfflineLogged: boolean = false; // Evitar spam de logs

  constructor(
    configManager: ConfigManager,
    stateManager: StateManager,
    hostService: HostService,
    windowManager: WindowManager,
    debugService: DebugService,
    displayIdentifier: DisplayIdentifier
  ) {
    super();
    this.configManager = configManager;
    this.stateManager = stateManager;
    this.hostService = hostService;
    this.windowManager = windowManager;
    this.debugService = debugService;
    this.displayIdentifier = displayIdentifier;
    
    this.webAdminUrl = 
      process.env.WEB_ADMIN_URL || 
      process.env.DISPLAYOPS_WEB_ADMIN_URL || 
      'https://displayops.vtex.com';
    
    this.agentId = this.configManager.getAgentId();
    
    // Create HTTP client with timeout
    this.httpClient = axios.create({
      baseURL: this.webAdminUrl,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    logger.info('🌐 HttpClientService initialized', {
      webAdminUrl: this.webAdminUrl,
      agentId: this.agentId
    });
  }

  public async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('HTTP client already running');
      return;
    }

    logger.info('🚀 Starting HTTP client service');
    this.isRunning = true;

    // Start heartbeat
    this.startHeartbeat();
    
    // Start command polling
    this.startCommandPolling();
    
    // Start metrics reporting
    this.startMetricsReporting();
    
    // Start log streaming
    this.startLogStreaming();
    
    // Initial heartbeat
    await this.sendHeartbeat();
  }

  public async stop(): Promise<void> {
    logger.info('🛑 Stopping HTTP client service');
    this.isRunning = false;

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    if (this.commandPollInterval) {
      clearInterval(this.commandPollInterval);
      this.commandPollInterval = null;
    }

    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
    }

    if (this.logStreamInterval) {
      clearInterval(this.logStreamInterval);
      this.logStreamInterval = null;
    }
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(async () => {
      try {
        await this.sendHeartbeat();
      } catch (error) {
        // Erro já logado no sendHeartbeat, não duplicar
      }
    }, this.heartbeatIntervalMs);
  }

  private async sendHeartbeat(): Promise<void> {
    try {
      // Get base display info from system
      const baseDisplays = await this.displayIdentifier.getDisplayInfo();
      const activeWindows = this.windowManager.getAllWindows();
      
      // Enrich displays with active dashboard information
      const displays = baseDisplays.map(display => {
        // Find window for this display
        const activeWindow = activeWindows.find(w => w.config.displayId === display.id);
        
        return {
          ...display,
          assignedDashboard: activeWindow ? {
            dashboardId: activeWindow.config.id,
            url: activeWindow.config.url,
            refreshInterval: activeWindow.config.refreshInterval,
            lastNavigation: activeWindow.lastNavigation.toISOString(),
            isResponsive: activeWindow.isResponsive
          } : null,
          isActive: !!activeWindow
        };
      });
      
      const totalMemory = os.totalmem();
      const freeMemory = os.freemem();
      const usedMemory = totalMemory - freeMemory;
      
      const cpus = os.cpus();
      const systemInfo = {
        hostname: os.hostname(),
        platform: os.platform(),
        arch: os.arch(),
        nodeVersion: process.version,
        electronVersion: process.versions.electron || 'unknown',
        totalMemoryGB: Math.round(os.totalmem() / 1024 / 1024 / 1024),
        cpuCores: cpus.length,
        cpuModel: cpus[0]?.model || 'Unknown',
        uptime: Math.floor(os.uptime()), // Campo requerido pela interface Host
        systemUptimeSeconds: Math.floor(os.uptime()),
        processUptimeSeconds: Math.floor(process.uptime()),
        systemUptimeFormatted: this.formatUptime(os.uptime()),
        processUptimeFormatted: this.formatUptime(process.uptime())
      };

      // Incluir métricas no heartbeat
      const metrics = {
        cpu: {
          usage: this.getCpuUsage(cpus),
          count: cpus.length
        },
        memory: {
          total: totalMemory,
          used: usedMemory,
          free: freeMemory,
          usagePercent: (usedMemory / totalMemory) * 100
        },
        uptime: os.uptime(),
        timestamp: new Date().toISOString()
      };

      const response = await this.httpClient.post('/api/hosts/heartbeat', {
        agentId: this.agentId,
        hostname: os.hostname(),
        displays,
        systemInfo,
        metrics,
        version: '1.0.0' // TODO: Get from package.json
      });

      logger.debug('💓 Heartbeat sent', { 
        status: response.status,
        displayCount: displays.length 
      });
      
      // Reset flag quando conectar com sucesso
      if (this.serverOfflineLogged) {
        logger.info('✅ Web-Admin está disponível novamente');
        this.serverOfflineLogged = false;
      }
    } catch (error) {
      // Silenciar erros de conexão (servidor offline)
      if (axios.isAxiosError(error) && (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND')) {
        if (!this.serverOfflineLogged) {
          logger.warn('⚠️ Web-Admin não está disponível. Tentando reconectar...');
          this.serverOfflineLogged = true;
        }
        return;
      }
      logger.error('Failed to send heartbeat', { error: error instanceof Error ? error.message : error });
      throw error;
    }
  }

  private startCommandPolling(): void {
    this.commandPollInterval = setInterval(async () => {
      try {
        await this.pollCommands();
      } catch (error) {
        // Erro já logado no pollCommands, não duplicar
      }
    }, this.commandPollIntervalMs);
  }

  private async pollCommands(): Promise<void> {
    try {
      logger.debug('🔄 Polling for commands...', { agentId: this.agentId });
      
      const response = await this.httpClient.get('/api/hosts/commands/pending', {
        params: { agentId: this.agentId }
      });

      const { commands } = response.data;

      if (commands && commands.length > 0) {
        logger.info('📬 Received commands', { count: commands.length, commandIds: commands.map((c: any) => c.commandId) });
        
        for (const command of commands) {
          await this.handleCommand(command);
        }
      }
    } catch (error) {
      // Silenciar erros de conexão e 4xx
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
          return; // Servidor offline, silenciar
        }
        if (error.response && error.response.status >= 400 && error.response.status < 500) {
          return; // 4xx errors
        }
      }
      logger.warn('Polling commands failed', { error: error instanceof Error ? error.message : error });
    }
  }

  private async handleCommand(command: any): Promise<void> {
    const { commandId, type, payload, targetDisplay } = command;

    logger.info('⚡ Executing command', { commandId, type, targetDisplay, payload });

    try {
      let result: any = { success: true };

      switch (type) {
        case 'OPEN_DASHBOARD':
          result = await this.windowManager.deployDashboard({
            url: payload.url,
            displayId: targetDisplay,
            fullscreen: payload.fullscreen !== false,
            refreshInterval: payload.refreshInterval || 300000,
            dashboardId: payload.dashboardId || 'dashboard'
          });
          this.hostService.forceRefreshFromSystem();
          
          // 🍪 AUTO-SYNC COOKIES: Apply cookies automatically when dashboard is deployed
          await this.autoSyncCookiesForDashboard(payload.url);
          break;

        case 'REFRESH_DASHBOARD':
          result = await this.windowManager.refreshDisplay(targetDisplay);
          break;

        case 'SET_COOKIES':
        case 'SYNC_COOKIES':
          result = await this.hostService.setCookie(payload);
          break;

        case 'IDENTIFY_DISPLAYS':
          await this.displayIdentifier.identifyDisplays({
            duration: payload?.duration || 5,
            fontSize: payload?.fontSize || 200,
            backgroundColor: payload?.backgroundColor || 'rgba(0, 180, 255, 0.95)'
          });
          result = { success: true };
          break;

        case 'HEALTH_CHECK':
          result = this.hostService.getSystemStatus();
          break;

        case 'TAKE_SCREENSHOT':
          result = await this.windowManager.takeScreenshot(
            targetDisplay,
            payload.format || 'png'
          );
          break;

        case 'RESTART_DASHBOARD':
          result = await this.windowManager.refreshDisplay(targetDisplay);
          break;

        case 'REMOVE_DASHBOARD':
          // Find and close the window for this display
          const windows = this.windowManager.getAllWindows();
          const targetWindow = windows.find(w => w.config.displayId === targetDisplay);
          
          if (targetWindow) {
            logger.info(`🔴 Closing dashboard window for display ${targetDisplay}`, {
              windowId: targetWindow.id,
              url: targetWindow.config.url
            });
            
            // Close the window
            const closed = await this.windowManager.closeWindow(targetWindow.id);
            if (closed) {
              logger.info(`✅ Successfully closed window ${targetWindow.id} for display ${targetDisplay}`);
            } else {
              logger.warn(`⚠️ Failed to close window ${targetWindow.id} for display ${targetDisplay}`);
            }
          } else {
            logger.warn(`⚠️ No window found for display ${targetDisplay} to close`);
          }
          
          // Clear the display state
          this.stateManager.clearDisplayState(targetDisplay);
          
          // Force refresh HostService to update display statuses
          this.hostService.forceRefreshFromSystem();
          
          result = { success: true };
          break;

        case 'DEBUG_ENABLE':
          this.debugService.enable();
          result = { success: true };
          break;

        case 'DEBUG_DISABLE':
          this.debugService.disable();
          result = { success: true };
          break;

        case 'GET_LOGS':
          // Get logs from logger
          const limit = payload?.limit || 100;
          const level = payload?.level || 'ALL';
          const logs = logger.getLogs(limit, level);
          
          result = {
            logs: logs.map(log => ({
              id: log.id,
              timestamp: log.timestamp.toISOString(),
              level: log.level,
              category: log.category,
              message: log.message,
              details: log.details
            })),
            total_count: logs.length,
            oldest_log_time: logs.length > 0 ? logs[logs.length - 1].timestamp.toISOString() : null,
            newest_log_time: logs.length > 0 ? logs[0].timestamp.toISOString() : null
          };
          
          logger.info('📋 Retrieved logs', { count: logs.length, level });
          break;
          
        default:
          throw new Error(`Unknown command type: ${type}`);
      }

      // Send success response
      await this.sendCommandResponse({
        commandId,
        success: true,
        data: result
      });

      logger.info('✅ Command executed successfully', {
        commandId,
        type
      });

      // Force immediate heartbeat for commands that change display state
      const displayChangeCommands = [
        'OPEN_DASHBOARD',
        'REFRESH_DASHBOARD',
        'RESTART_DASHBOARD',
        'REMOVE_DASHBOARD'
      ];
      
      if (displayChangeCommands.includes(type)) {
        logger.info('🔄 Display state changed, forcing immediate heartbeat');
        this.sendHeartbeat().catch(err => 
          logger.error('Failed to force heartbeat:', err)
        );
      }

    } catch (error) {
      logger.error('❌ Command execution failed', { commandId, error });
      
      // Send error response
      await this.sendCommandResponse({
        commandId,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async sendCommandResponse(response: any): Promise<void> {
    try {
      await this.httpClient.post('/api/hosts/commands/response', {
        ...response,
        agentId: this.agentId // Adicionar agentId para autenticação
      });
      logger.debug('📤 Command response sent', { commandId: response.commandId });
    } catch (error) {
      logger.error('Failed to send command response', { 
        error: error instanceof Error ? error.message : error,
        commandId: response.commandId 
      });
    }
  }

  private startMetricsReporting(): void {
    this.metricsInterval = setInterval(async () => {
      try {
        await this.sendMetrics();
      } catch (error) {
        // Erro já logado no sendMetrics, não duplicar
      }
    }, this.metricsIntervalMs);
  }

  private async sendMetrics(): Promise<void> {
    try {
      const cpus = os.cpus();
      const totalMemory = os.totalmem();
      const freeMemory = os.freemem();
      const usedMemory = totalMemory - freeMemory;

      const metrics = {
        cpu: {
          usage: this.getCpuUsage(cpus),
          count: cpus.length
        },
        memory: {
          total: totalMemory,
          used: usedMemory,
          free: freeMemory,
          usagePercent: (usedMemory / totalMemory) * 100
        },
        uptime: os.uptime(),
        timestamp: new Date().toISOString()
      };

      await this.httpClient.post('/api/hosts/metrics', {
        agentId: this.agentId,
        metrics
      });

      logger.debug('📊 Metrics sent');
    } catch (error) {
      // Silenciar erros de conexão
      if (axios.isAxiosError(error) && (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND')) {
        return; // Servidor offline, não logar
      }
      logger.warn('Failed to send metrics', { error: error instanceof Error ? error.message : error });
    }
  }

  private getCpuUsage(cpus: os.CpuInfo[]): number {
    let totalIdle = 0;
    let totalTick = 0;

    cpus.forEach(cpu => {
      for (const type in cpu.times) {
        totalTick += cpu.times[type as keyof os.CpuInfo['times']];
      }
      totalIdle += cpu.times.idle;
    });

    const idle = totalIdle / cpus.length;
    const total = totalTick / cpus.length;
    const usage = 100 - ~~(100 * idle / total);

    return usage;
  }

  private startLogStreaming(): void {
    this.logStreamInterval = setInterval(async () => {
      try {
        await this.sendLogs();
      } catch (error) {
        // Erro já logado no sendLogs, não duplicar
      }
    }, this.logStreamIntervalMs);
  }

  private async sendLogs(): Promise<void> {
    try {
      // Get recent logs from logger
      // Note: You'll need to implement a method to get buffered logs
      const logs = this.getRecentLogs();

      if (logs.length > 0) {
        await this.httpClient.post('/api/hosts/logs', {
          agentId: this.agentId,
          logs
        });

        logger.debug('📝 Logs sent', { count: logs.length });
      }
    } catch (error) {
      // Silenciar erros de conexão
      if (axios.isAxiosError(error) && (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND')) {
        return; // Servidor offline, não logar
      }
      logger.warn('Failed to send logs', { error: error instanceof Error ? error.message : error });
    }
  }

  /**
   * 🍪 AUTO-SYNC COOKIES: Automatically sync cookies for a dashboard URL
   * This method fetches cookies from the web-admin and applies them to the current session
   */
  private async autoSyncCookiesForDashboard(dashboardUrl: string): Promise<void> {
    try {
      logger.info('🍪 Auto-syncing cookies for dashboard', { url: dashboardUrl });
      
      // Extract domain from dashboard URL
      const url = new URL(dashboardUrl);
      const domain = url.hostname;
      
      logger.debug('🍪 Extracted domain for cookie sync', { domain, dashboardUrl });
      
      // Fetch cookies for this domain from web-admin
      const response = await this.httpClient.get(`/api/cookies/domain/${encodeURIComponent(domain)}`);
      
      if (response.data.success && response.data.data && response.data.data.cookies) {
        const cookies = response.data.data.cookies;
        
        if (Array.isArray(cookies) && cookies.length > 0) {
          logger.info('🍪 Found cookies to auto-sync', { domain, count: cookies.length });
          
          // Apply cookies to the current session
          const cookiePayload = {
            domain: domain,
            cookies: cookies
          };
          
          await this.hostService.setCookie(cookiePayload);
          logger.info('🍪 Auto-sync completed successfully', { domain, count: cookies.length });
        } else {
          logger.debug('🍪 No cookies found for domain', { domain });
        }
      } else {
        logger.debug('🍪 No cookie data available for domain', { domain });
      }
    } catch (error) {
      // Don't fail the dashboard deployment if cookie sync fails
      logger.warn('🍪 Auto-sync cookies failed (non-critical)', { 
        error: error instanceof Error ? error.message : error,
        dashboardUrl 
      });
    }
  }

  private getRecentLogs(): any[] {
    // TODO: Implement log buffering in logger utility
    // For now, return empty array
    return [];
  }

  public getAgentId(): string {
    return this.agentId;
  }

  public isConnected(): boolean {
    return this.isRunning;
  }

  private formatUptime(seconds: number): string {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  }
}

