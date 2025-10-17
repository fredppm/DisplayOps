import { EventEmitter } from 'events';
import { io, Socket } from 'socket.io-client';
import { ConfigManager } from '../managers/config-manager';
import { StateManager } from './state-manager';
import { HostService } from './host-service';
import { WindowManager } from '../managers/window-manager';
import { DebugService } from './debug-service';
import { DisplayIdentifier } from './display-identifier';
import { logger } from '../utils/logger';
import os from 'os';

/**
 * Socket Client Service
 * 
 * Maintains persistent Socket.IO connection with Web-Admin
 * Handles:
 * - Connection management (with auto-reconnect)
 * - Heartbeat (replaces HTTP polling)
 * - Command execution (replaces gRPC server)
 * - Real-time metrics reporting
 */
export class SocketClientService extends EventEmitter {
  private socket: Socket | null = null;
  private configManager: ConfigManager;
  private stateManager: StateManager;
  private hostService: HostService;
  private windowManager: WindowManager;
  private debugService: DebugService;
  private displayIdentifier: DisplayIdentifier;
  private webAdminUrl: string;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private heartbeatIntervalMs: number = 30000; // 30 seconds
  private metricsInterval: NodeJS.Timeout | null = null;
  private metricsIntervalMs: number = 10000; // 10 seconds - more frequent than heartbeat
  private logStreamInterval: NodeJS.Timeout | null = null;
  private logStreamIntervalMs: number = 2000; // 2 seconds - very frequent for logs
  private lastLogId: string = '';
  private isConnected: boolean = false;

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
    
    // Simple: ENV vars or default (no config file nonsense)
    this.webAdminUrl = 
      process.env.WEB_ADMIN_URL || 
      process.env.DISPLAYOPS_WEB_ADMIN_URL || 
      'https://displayops.vtex.com';
    
    logger.info('🔌 SocketClientService initialized', {
      webAdminUrl: this.webAdminUrl,
      source: process.env.WEB_ADMIN_URL ? 'WEB_ADMIN_URL' : 
              process.env.DISPLAYOPS_WEB_ADMIN_URL ? 'DISPLAYOPS_WEB_ADMIN_URL' : 'default'
    });
  }

  public async start(): Promise<void> {
    if (this.socket) {
      logger.warn('Socket already connected');
      return;
    }

    logger.info('🌐 Connecting to Web-Admin via Socket.IO', { url: this.webAdminUrl });

    try {
      await this.connect();
    } catch (error) {
      logger.error('Failed to connect to Web-Admin', { error });
      // Don't throw - allow retry
    }
  }

  public async stop(): Promise<void> {
    logger.info('🛑 Disconnecting from Web-Admin');

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
    }

    if (this.logStreamInterval) {
      clearInterval(this.logStreamInterval);
      this.logStreamInterval = null;
    }

    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    this.isConnected = false;
    this.emit('disconnected');
  }

  private async connect(): Promise<void> {
    const config = this.configManager.getConfig();

    // Create socket connection with namespace
    const socketUrl = `${this.webAdminUrl}/host`; // Namespace
    
    this.socket = io(socketUrl, {
      path: '/api/websocket',  // Socket.IO endpoint path
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 5000,
      reconnectionDelayMax: 30000,
      reconnectionAttempts: Infinity,
      timeout: 10000,
      query: {
        agentId: config.agentId
      }
    });

    logger.info('🔌 Socket.IO connecting to:', {
      url: socketUrl,
      path: '/api/websocket',
      agentId: config.agentId
    });

    // Setup event handlers
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    if (!this.socket) return;

    // Connection established
    this.socket.on('connect', () => {
      logger.success('✅ Connected to Web-Admin via Socket.IO', {
        socketId: this.socket?.id
      });
      
      this.isConnected = true;
      this.emit('connected');

      // Start heartbeat
      this.startHeartbeat();

      // Start real-time metrics streaming
      this.startMetrics();

      // Start real-time log streaming
      this.startLogStream();

      // Send initial registration/heartbeat
      this.sendHeartbeat();
    });

    // Connection error
    this.socket.on('connect_error', (error) => {
      logger.error('Socket.IO connection error:', { error: error.message });
      this.isConnected = false;
    });

    // Disconnected
    this.socket.on('disconnect', (reason) => {
      logger.warn('⚠️ Disconnected from Web-Admin', { reason });
      this.isConnected = false;
      this.emit('disconnected');

      // Stop heartbeat, metrics, and log streaming
      if (this.heartbeatInterval) {
        clearInterval(this.heartbeatInterval);
        this.heartbeatInterval = null;
      }
      if (this.metricsInterval) {
        clearInterval(this.metricsInterval);
        this.metricsInterval = null;
      }
      if (this.logStreamInterval) {
        clearInterval(this.logStreamInterval);
        this.logStreamInterval = null;
      }
    });

    // Reconnecting
    this.socket.on('reconnect_attempt', (attemptNumber) => {
      logger.info('🔄 Reconnecting to Web-Admin...', { attempt: attemptNumber });
    });

    // Reconnected
    this.socket.on('reconnect', (attemptNumber) => {
      logger.success('✅ Reconnected to Web-Admin', { attempts: attemptNumber });
      this.sendHeartbeat();
    });

    // Heartbeat acknowledgement
    this.socket.on('heartbeat:ack', (data) => {
      logger.debug('💓 Heartbeat acknowledged', data);
    });

    // Command from admin
    this.socket.on('command', async (commandData) => {
      await this.handleCommand(commandData);
    });
  }

  private startHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeat();
    }, this.heartbeatIntervalMs);

    logger.info('💓 Heartbeat started', { 
      interval: `${this.heartbeatIntervalMs / 1000}s` 
    });
  }

  // Force immediate heartbeat (e.g., after display state changes)
  public async forceHeartbeat(): Promise<void> {
    logger.info('🔄 Forcing immediate heartbeat (state changed)');
    await this.sendHeartbeat();
  }

  private async sendHeartbeat(): Promise<void> {
    if (!this.socket || !this.isConnected) {
      return;
    }

    const config = this.configManager.getConfig();
    const systemInfo = this.configManager.getSystemInfo();
    const displayStatesRecord = this.stateManager.getAllDisplayStates();

    try {
      const systemStatus = this.hostService.getSystemStatus();

      const heartbeatData = {
        agentId: config.agentId,
        hostname: config.hostname,
        version: config.version,
        status: 'online',
        timestamp: new Date().toISOString(),
        lastSeen: new Date().toISOString(),
        displays: config.displays.map(display => {
          const state = displayStatesRecord[display.id];
          return {
            id: display.id,
            name: display.name,
            width: display.bounds?.width || 1920,
            height: display.bounds?.height || 1080,
            isPrimary: display.monitorIndex === 0,
            assignedDashboard: state?.assignedDashboard ? {
              dashboardId: state.assignedDashboard.dashboardId,
              url: state.assignedDashboard.url
            } : null,
            isActive: state?.isActive || false
          };
        }),
        systemInfo: {
          platform: systemInfo.platform,
          arch: systemInfo.arch,
          nodeVersion: systemInfo.nodeVersion,
          electronVersion: systemInfo.electronVersion || 'unknown',
          totalMemoryGB: Math.round(os.totalmem() / 1024 / 1024 / 1024),
          cpuCores: os.cpus().length,
          cpuModel: os.cpus()[0]?.model || 'Unknown',
          systemUptimeSeconds: Math.floor(os.uptime()),              // OS uptime
          processUptimeSeconds: Math.floor(process.uptime()),        // Agent uptime
          systemUptimeFormatted: this.formatUptime(os.uptime()),     // Human-readable OS uptime
          processUptimeFormatted: this.formatUptime(process.uptime()) // Human-readable agent uptime
        },
        metrics: {
          cpuUsagePercent: systemStatus.hostStatus.cpuUsage || 0,
          memoryUsagePercent: systemStatus.hostStatus.memoryUsage || 0,
          memoryUsedGB: (os.totalmem() - os.freemem()) / 1024 / 1024 / 1024,
          memoryTotalGB: os.totalmem() / 1024 / 1024 / 1024
        }
      };

      this.socket.emit('heartbeat', heartbeatData);
      
      logger.debug('💓 Heartbeat sent', {
        displays: heartbeatData.displays.length
      });

    } catch (error) {
      logger.error('Failed to send heartbeat:', error);
    }
  }

  private startMetrics(): void {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }

    this.metricsInterval = setInterval(() => {
      this.sendMetrics();
    }, this.metricsIntervalMs);

    logger.info('📊 Real-time metrics streaming started', { 
      interval: `${this.metricsIntervalMs / 1000}s` 
    });
  }

  private async sendMetrics(): Promise<void> {
    if (!this.socket || !this.isConnected) {
      return;
    }

    const config = this.configManager.getConfig();

    try {
      const systemStatus = this.hostService.getSystemStatus();
      const displayStatesRecord = this.stateManager.getAllDisplayStates();

      const metricsData = {
        agentId: config.agentId,
        timestamp: new Date().toISOString(),
        cpu: {
          usage: systemStatus.hostStatus.cpuUsage || 0,
          cores: os.cpus().length,
          model: os.cpus()[0]?.model || 'Unknown'
        },
        memory: {
          usagePercent: systemStatus.hostStatus.memoryUsage || 0,
          usedGB: (os.totalmem() - os.freemem()) / 1024 / 1024 / 1024,
          totalGB: os.totalmem() / 1024 / 1024 / 1024,
          freeGB: os.freemem() / 1024 / 1024 / 1024
        },
        displays: {
          total: config.displays.length,
          active: Object.values(displayStatesRecord).filter((s: any) => s.isActive).length,
          states: config.displays.map(display => {
            const state = displayStatesRecord[display.id];
            return {
              id: display.id,
              name: display.name,
              isActive: state?.isActive || false,
              hasUrl: !!state?.assignedDashboard?.url
            };
          })
        },
        browser: {
          processes: systemStatus.hostStatus.browserProcesses || 0
        }
      };

      this.socket.emit('metrics', metricsData);
      
      logger.debug('📊 Metrics sent', {
        cpu: `${metricsData.cpu.usage.toFixed(1)}%`,
        memory: `${metricsData.memory.usagePercent.toFixed(1)}%`,
        displays: `${metricsData.displays.active}/${metricsData.displays.total}`
      });

    } catch (error) {
      logger.error('Failed to send metrics:', error);
    }
  }

  private startLogStream(): void {
    if (this.logStreamInterval) {
      clearInterval(this.logStreamInterval);
    }

    // Get initial logs
    const allLogs = logger.getLogs();
    if (allLogs.length > 0) {
      this.lastLogId = allLogs[allLogs.length - 1].id;
    }

    this.logStreamInterval = setInterval(() => {
      this.sendNewLogs();
    }, this.logStreamIntervalMs);

    logger.info('📝 Real-time log streaming started', { 
      interval: `${this.logStreamIntervalMs / 1000}s`,
      lastLogId: this.lastLogId
    });
  }

  private async sendNewLogs(): Promise<void> {
    if (!this.socket || !this.isConnected) {
      return;
    }

    try {
      const allLogs = logger.getLogs(1000); // Get last 1000 logs
      
      // Find new logs (after lastLogId)
      const lastIndex = allLogs.findIndex(log => log.id === this.lastLogId);
      const newLogs = lastIndex >= 0 ? allLogs.slice(lastIndex + 1) : allLogs;

      if (newLogs.length > 0) {
        const config = this.configManager.getConfig();
        
        const logData = {
          agentId: config.agentId,
          logs: newLogs.map(log => ({
            id: log.id,
            timestamp: log.timestamp.toISOString(),
            level: log.level,
            category: log.category,
            message: log.message,
            details: log.details
          })),
          timestamp: new Date().toISOString()
        };

        this.socket.emit('logs', logData);
        
        // Update last log ID
        this.lastLogId = newLogs[newLogs.length - 1].id;
        
        logger.debug('📝 Sent new logs', {
          count: newLogs.length,
          lastLogId: this.lastLogId
        });
      }

    } catch (error) {
      logger.error('Failed to send logs:', error);
    }
  }

  private async handleCommand(commandData: any): Promise<void> {
    const { commandId, type, payload, targetDisplay } = commandData;

    logger.info('📥 Received command from admin', {
      commandId,
      type,
      targetDisplay
    });

    try {
      let result;

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
          break;

        case 'REFRESH_DASHBOARD':
          result = await this.windowManager.refreshDisplay(targetDisplay);
          break;

        case 'SET_COOKIES':
        case 'SYNC_COOKIES':
          result = await this.handleSetCookies(payload.cookies, payload.domain);
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
          // Close the display by removing its state
          this.stateManager.clearDisplayState(targetDisplay);
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
          result = await this.handleGetLogs(payload.limit, payload.level);
          break;

        default:
          throw new Error(`Unknown command type: ${type}`);
      }

      // Send success response
      this.sendCommandResponse({
        commandId,
        success: true,
        data: result,
        timestamp: new Date()
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
        // Don't await to avoid blocking command response
        this.forceHeartbeat().catch(err => 
          logger.error('Failed to force heartbeat:', err)
        );
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Command execution failed';
      
      logger.error('❌ Command execution failed:', {
        commandId,
        type,
        error: errorMessage
      });

      // Send error response
      this.sendCommandResponse({
        commandId,
        success: false,
        error: errorMessage,
        timestamp: new Date()
      });
    }
  }

  private sendCommandResponse(response: any): void {
    if (!this.socket || !this.isConnected) {
      logger.error('Cannot send command response: not connected');
      return;
    }

    this.socket.emit('command:response', response);
  }

  private async handleSetCookies(cookies: any[], domain?: string): Promise<any> {
    logger.info(`Starting cookie sync for ${cookies.length} cookies on domain: ${domain || 'default'}`);
    
    let cookiesSet = 0;
    const failedCookies: string[] = [];
    const domainsCleared = new Set<string>();

    // Group cookies by domain
    const cookiesByDomain = new Map<string, any[]>();
    for (const cookie of cookies) {
      const cookieDomain = cookie.domain || domain;
      if (!cookiesByDomain.has(cookieDomain)) {
        cookiesByDomain.set(cookieDomain, []);
      }
      cookiesByDomain.get(cookieDomain)!.push(cookie);
    }

    // Clear existing cookies for each domain first
    for (const [cookieDomain] of cookiesByDomain.entries()) {
      if (cookieDomain && !domainsCleared.has(cookieDomain)) {
        try {
          await this.hostService.clearDomainCookies(cookieDomain);
          domainsCleared.add(cookieDomain);
        } catch (error) {
          logger.error(`Failed to clear cookies for domain ${cookieDomain}:`, error);
        }
      }
    }

    // Set all cookies
    for (const cookie of cookies) {
      try {
        const cookieData = {
          name: cookie.name,
          value: cookie.value,
          domain: cookie.domain || domain,
          path: cookie.path || '/',
          expires: cookie.expires && cookie.expires > 0 ? new Date(cookie.expires * 1000) : undefined,
          httpOnly: cookie.httpOnly || false,
          secure: cookie.secure !== false,
          sameSite: cookie.sameSite || 'lax'
        };

        const success = await this.hostService.setCookie(cookieData);
        
        if (success) {
          cookiesSet++;
        } else {
          failedCookies.push(cookie.name);
        }
      } catch (error) {
        failedCookies.push(cookie.name);
        logger.error(`Exception setting cookie ${cookie.name}:`, error);
      }
    }

    return {
      cookies_set: cookiesSet,
      failed_cookies: failedCookies,
      total_attempted: cookies.length
    };
  }

  private async handleGetLogs(limit: number = 100, level: string = 'ALL'): Promise<any> {
    try {
      const logs = logger.getLogs(limit, level !== 'ALL' ? level : undefined);
      
      return {
        logs: logs.map(log => ({
          id: log.id,
          timestamp: log.timestamp.toISOString(),
          level: log.level,
          category: log.category,
          message: log.message,
          details: log.details
        })),
        total_count: logs.length,
        oldest_log_time: logs.length > 0 ? logs[0].timestamp.toISOString() : null,
        newest_log_time: logs.length > 0 ? logs[logs.length - 1].timestamp.toISOString() : null
      };
    } catch (error) {
      logger.error('Failed to get logs:', error);
      return {
        logs: [],
        total_count: 0,
        oldest_log_time: null,
        newest_log_time: null
      };
    }
  }

  public isSocketConnected(): boolean {
    return this.isConnected && !!this.socket?.connected;
  }

  // Helper to format uptime in human-readable format
  private formatUptime(seconds: number): string {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    const parts: string[] = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

    return parts.join(' ');
  }
}

