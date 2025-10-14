import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { join } from 'path';
import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import { HostService } from './host-service';
import { WindowManager } from '../managers/window-manager';
import { DebugService } from './debug-service';
import { DisplayIdentifier } from './display-identifier';
import { DisplayMonitor } from './display-monitor';
import { ConfigManager } from '../managers/config-manager';
import { StateManager } from './state-manager';

// Load protobuf definition
const PROTO_PATH =  join(__dirname, '..', '..', '..', '..', '..', 'shared', 'proto', 'host-agent.proto'); // Development

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true
});

const protoDescriptor = grpc.loadPackageDefinition(packageDefinition) as any;

const displayops = protoDescriptor.displayops;

if (!displayops) {
  console.error('❌ displayops package not found. Available packages:', Object.keys(protoDescriptor));
  throw new Error('Failed to load displayops package from proto definition');
}

if (!displayops.HostAgent) {
  console.error('HostAgent service not found. Available services:', Object.keys(displayops));
  throw new Error('HostAgent service not found in displayops package');
}

export class GrpcService extends EventEmitter {
  private server: grpc.Server;
  private port: number;
  private isStarted: boolean = false;
  private eventStreams: Set<grpc.ServerWritableStream<any, any>> = new Set();
  private lastCpuInfo: any = null;
  private lastCpuTime: number = Date.now();

  constructor(
    port: number = 8082,
    private hostService: HostService,
    private windowManager: WindowManager,
    private debugService: DebugService,
    private displayIdentifier: DisplayIdentifier,
    private displayMonitor: DisplayMonitor,
    private configManager: ConfigManager,
    private stateManager: StateManager
  ) {
    super();
    this.port = port;
    this.server = new grpc.Server();
    this.setupServiceHandlers();
  }

  private setupServiceHandlers(): void {
    this.server.addService(displayops.HostAgent.service, {
      ExecuteCommand: this.executeCommand.bind(this),
      StreamEvents: this.streamEvents.bind(this),
      StreamCommands: this.streamCommands.bind(this),
      HealthCheck: this.healthCheck.bind(this)
    });
  }

  // Execute single command
  private async executeCommand(
    call: grpc.ServerUnaryCall<any, any>,
    callback: grpc.sendUnaryData<any>
  ): Promise<void> {
    try {
      const request = call.request;
      const response = await this.processCommand(request);
      callback(null, response);
    } catch (error) {
      logger.error('gRPC ExecuteCommand error:', error);
      callback({
        code: grpc.status.INTERNAL,
        details: error instanceof Error ? error.message : 'Internal error'
      }, null);
    }
  }

  // Stream events to client
  private streamEvents(call: grpc.ServerWritableStream<any, any>): void {
    logger.info('New gRPC event stream client connected');
    this.eventStreams.add(call);

    // Send initial heartbeat
    this.sendEventToStream(call, {
      event_id: `heartbeat_${Date.now()}`,
      type: 'HEARTBEAT',
      timestamp: { seconds: Math.floor(Date.now() / 1000), nanos: 0 },
      heartbeat: {
        host_status: this.getHostStatus(),
        display_statuses: this.getDisplayStatuses()
      }
    });

    call.on('cancelled', () => {
      logger.info('gRPC event stream cancelled');
      this.eventStreams.delete(call);
    });

    call.on('error', (error) => {
      logger.error('gRPC event stream error:', error);
      this.eventStreams.delete(call);
    });
  }

  // Bidirectional command streaming
  private streamCommands(call: grpc.ServerDuplexStream<any, any>): void {
    logger.info('New gRPC command stream client connected');

    call.on('data', async (request) => {
      try {
        const response = await this.processCommand(request);
        call.write(response);
      } catch (error) {
        logger.error('gRPC StreamCommands error:', error);
        call.write({
          command_id: request.command_id,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: { seconds: Math.floor(Date.now() / 1000), nanos: 0 }
        });
      }
    });

    call.on('end', () => {
      logger.info('gRPC command stream ended');
      call.end();
    });

    call.on('error', (error) => {
      logger.error('gRPC command stream error:', error);
    });
  }

  // Health check
  private async healthCheck(
    call: grpc.ServerUnaryCall<any, any>,
    callback: grpc.sendUnaryData<any>
  ): Promise<void> {
    try {
      const systemStatus = await this.hostService.getSystemStatus();
      
      const response = {
        host_status: this.getHostStatus(),
        display_statuses: this.getDisplayStatuses(),
        system_info: {
          uptime_seconds: Math.floor(process.uptime()),
          platform: process.platform,
          node_version: process.version,
          agent_version: this.configManager.getVersion(),
          total_displays: this.configManager.getDisplays().length,
          available_display_ids: this.configManager.getDisplays().map(d => d.id)
        }
      };

      callback(null, response);
    } catch (error) {
      logger.error('gRPC HealthCheck error:', error);
      callback({
        code: grpc.status.INTERNAL,
        details: error instanceof Error ? error.message : 'Internal error'
      }, null);
    }
  }

  // Process command based on type
  private async processCommand(request: any): Promise<any> {
    const startTime = Date.now();
    
    logger.debug(`Received gRPC command: ${request.type} (${request.command_id})`);
    
    try {
      let result: any = {};

      switch (request.type) {
        case 'OPEN_DASHBOARD':
          result = await this.handleOpenDashboard(request.open_dashboard);
          break;
        case 'REFRESH_DASHBOARD':
          result = await this.handleRefreshDashboard(request.refresh_dashboard);
          break;
        case 'SET_COOKIES':
          result = await this.handleSetCookies(request.set_cookies);
          break;
        case 'HEALTH_CHECK':
          result = { health_check_result: await this.getHealthCheckResult() };
          break;
        case 'IDENTIFY_DISPLAYS':
          result = await this.handleIdentifyDisplays(request.identify_displays);
          break;
        case 'TAKE_SCREENSHOT':
          result = await this.handleTakeScreenshot(request.take_screenshot);
          break;
        case 'RESTART_DASHBOARD':
          result = await this.handleRestartDashboard(request.restart_dashboard);
          break;
        case 'DEBUG_ENABLE':
          result = await this.handleDebugEnable(request.debug_enable);
          break;
        case 'DEBUG_DISABLE':
          result = await this.handleDebugDisable(request.debug_disable);
          break;
        case 'REMOVE_DASHBOARD':
          result = await this.handleRemoveDashboard(request.remove_dashboard);
          break;
        default:
          throw new Error(`Unknown command type: ${request.type}`);
      }

      const executionTime = Date.now() - startTime;

      return {
        command_id: request.command_id,
        success: true,
        timestamp: { seconds: Math.floor(Date.now() / 1000), nanos: 0 },
        execution_time_ms: executionTime,
        ...result
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      return {
        command_id: request.command_id,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: { seconds: Math.floor(Date.now() / 1000), nanos: 0 },
        execution_time_ms: executionTime
      };
    }
  }

  // Command handlers
  private async handleOpenDashboard(cmd: any): Promise<any> {
    const config = {
      url: cmd.url,
      displayId: cmd.display_id,
      fullscreen: cmd.fullscreen || true,
      refreshInterval: cmd.refresh_interval_ms || 0,
      dashboardId: cmd.dashboard_id || 'dashboard'
    };

    const result = await this.windowManager.deployDashboard(config);
    
    // Force refresh HostService display states to reflect StateManager changes
    this.hostService.forceRefreshFromSystem();
    
    // Broadcast display state change event
    this.broadcastEvent({
      event_id: `display_state_${Date.now()}`,
      type: 'DISPLAY_STATE_CHANGED',
      timestamp: { seconds: Math.floor(Date.now() / 1000), nanos: 0 },
      display_state_changed: {
        display_id: cmd.display_id,
        status: this.getDisplayStatus(cmd.display_id)
      }
    });

    return {
      open_dashboard_result: {
        display_id: cmd.display_id,
        loaded_url: cmd.url,
        is_responsive: result.success
      }
    };
  }

  private async handleRefreshDashboard(cmd: any): Promise<any> {
    const result = await this.windowManager.refreshDisplay(cmd.display_id);
    
    // Broadcast display state change event
    this.broadcastEvent({
      event_id: `dashboard_refresh_${Date.now()}`,
      type: 'DISPLAY_STATE_CHANGED',
      timestamp: { seconds: Math.floor(Date.now() / 1000), nanos: 0 },
      display_state_changed: {
        display_id: cmd.display_id,
        status: this.getDisplayStatus(cmd.display_id)
      }
    });

    return {
      refresh_dashboard_result: {
        display_id: cmd.display_id,
        current_url: result.url || '',
        refresh_time: { seconds: Math.floor(Date.now() / 1000), nanos: 0 }
      }
    };
  }

  private async handleSetCookies(cmd: any): Promise<any> {
    logger.info(`Starting cookie sync for ${cmd.cookies.length} cookies on domain: ${cmd.domain || 'default'}`);
    
    let cookiesSet = 0;
    const failedCookies: string[] = [];
    let domainsCleared = new Set<string>();

    // Group cookies by domain and clear existing cookies for each domain first
    const cookiesByDomain = new Map<string, any[]>();
    for (const cookie of cmd.cookies) {
      const domain = cookie.domain || cmd.domain;
      if (!cookiesByDomain.has(domain)) {
        cookiesByDomain.set(domain, []);
      }
      cookiesByDomain.get(domain)!.push(cookie);
    }

    // Clear existing cookies for each domain first
    for (const [domain, cookies] of cookiesByDomain.entries()) {
      if (domain && !domainsCleared.has(domain)) {
        logger.debug(`Clearing existing cookies for domain: ${domain}`);
        try {
          await this.hostService.clearDomainCookies(domain);
          domainsCleared.add(domain);
          logger.debug(`Cleared existing cookies for domain: ${domain}`);
        } catch (error) {
          logger.error(`Failed to clear cookies for domain ${domain}:`, error);
          // Continue anyway - clearing is optional, setting is more important
        }
      }
    }

    // Now set all the new cookies
    for (let i = 0; i < cmd.cookies.length; i++) {
      const cookie = cmd.cookies[i];
      try {
        logger.debug(`Processing cookie ${i + 1}/${cmd.cookies.length}: ${cookie.name}`);
        
        // Convert gRPC cookie format to internal format
        const cookieData = {
          name: cookie.name,
          value: cookie.value,
          domain: cookie.domain || cmd.domain,
          path: cookie.path || '/',
          expires: cookie.expires && cookie.expires > 0 ? new Date(cookie.expires * 1000) : undefined,
          httpOnly: cookie.http_only || false,
          secure: cookie.secure !== false, // Default to secure unless explicitly false
          sameSite: cookie.same_site || 'lax'
        };

        logger.debug(`Converted cookie data for ${cookie.name}`, { domain: cookieData.domain, secure: cookieData.secure });

        const success = await this.hostService.setCookie(cookieData);
        
        if (success) {
          cookiesSet++;
          logger.debug(`Successfully set cookie: ${cookie.name}`);
        } else {
          failedCookies.push(cookie.name);
          logger.warn(`Failed to set cookie: ${cookie.name}`);
        }
      } catch (error) {
        failedCookies.push(cookie.name);
        logger.error(`Exception setting cookie ${cookie.name}:`, error);
      }
    }

    const result = {
      set_cookies_result: {
        cookies_set: cookiesSet,
        failed_cookies: failedCookies,
        domains_processed: Array.from(domainsCleared),
        total_attempted: cmd.cookies.length
      }
    };

    logger.info(`Cookie sync completed: ${cookiesSet}/${cmd.cookies.length} successful, ${domainsCleared.size} domains processed`);
    if (failedCookies.length > 0) {
      logger.warn(`Failed cookies: ${failedCookies.join(', ')}`);
    }

    return result;
  }

  private async handleValidateUrl(cmd: any): Promise<any> {
    const startTime = Date.now();
    
    try {
      const isValid = await this.hostService.validateUrl(cmd.url, cmd.timeout_ms || 5000);
      const responseTime = Date.now() - startTime;

      return {
        validate_url_result: {
          is_valid: isValid,
          response_time_ms: responseTime,
          status_code: isValid ? 200 : 0,
          error: isValid ? '' : 'URL validation failed'
        }
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      return {
        validate_url_result: {
          is_valid: false,
          response_time_ms: responseTime,
          status_code: 0,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }

  private async handleIdentifyDisplays(cmd: any): Promise<any> {
    logger.info('🔍 IDENTIFY_DISPLAYS command received', { 
      rawCmd: cmd, 
      duration_seconds: cmd.duration_seconds 
    });
    
    const duration = cmd.duration_seconds || 5;
    const pattern = cmd.pattern || 'highlight';
    
    logger.info('🖥️ Calling displayIdentifier.identifyDisplays', { 
      duration, 
      pattern 
    });
    
    const result = await this.displayIdentifier.identifyDisplays({
      duration,
      fontSize: cmd.font_size || 48,
      backgroundColor: cmd.background_color || '#000000'
    });
    
    logger.info('✅ Display identification result:', { result });

    // identifyDisplays retorna string, mas protobuf espera array
    // Vamos retornar array de displays com status
    const displays = this.configManager.getDisplays();
    const identifiedDisplays = displays.map((display, index) => ({
      display_id: display.id,
      display_number: index + 1,
      identified: true,
      message: `Display ${index + 1} identified`
    }));

    return {
      identify_displays_result: {
        identified_displays: identifiedDisplays,
        success_message: result
      }
    };
  }

  private async handleTakeScreenshot(cmd: any): Promise<any> {
    const screenshot = await this.windowManager.takeScreenshot(cmd.display_id, {
      format: cmd.format || 'png',
      quality: cmd.quality || 90
    });

    return {
      screenshot_result: {
        display_id: cmd.display_id,
        image_data: screenshot.data,
        format: screenshot.format,
        width: screenshot.width,
        height: screenshot.height
      }
    };
  }

  private async handleRestartDashboard(cmd: any): Promise<any> {
    logger.info(`🔄 handleRestartDashboard called with:`, {
      display_ids: cmd.display_ids,
      force_kill: cmd.force_kill,
      delay_seconds: cmd.delay_seconds
    });
    
    const targetDisplays = cmd.display_ids?.length > 0 ? cmd.display_ids : this.configManager.getDisplays().map(d => d.id);
    const restartedDisplays: string[] = [];
    const failedDisplays: string[] = [];
    let processesKilled = 0;
    let processesStarted = 0;

    try {
      // Delay if specified
      if (cmd.delay_seconds > 0) {
        await new Promise(resolve => setTimeout(resolve, cmd.delay_seconds * 1000));
      }

      for (const displayId of targetDisplays) {
        try {
          logger.info(`♻️ Restarting dashboard for display ${displayId}`);

          // Find windows for this display
          const windows = this.windowManager.getAllWindows().filter(w => 
            w.config.displayId === displayId
          );

          for (const window of windows) {
            try {
              // Close the window (kills browser process)
              await this.windowManager.closeWindow(window.id);
              processesKilled++;
              
              // Wait a bit before recreating
              await new Promise(resolve => setTimeout(resolve, 1000));
              
              // Recreate the window with same dashboard
              const newWindowId = await this.windowManager.createWindow(window.config);
              processesStarted++;
              logger.info(`Restarted dashboard for display ${displayId}: ${window.id} → ${newWindowId}`);
            } catch (error) {
              logger.error(`Failed to restart window ${window.id}:`, error);
            }
          }

          // Broadcast display state change event
          this.broadcastEvent({
            event_id: `display_state_${Date.now()}`,
            type: 'DISPLAY_STATE_CHANGED',
            timestamp: { seconds: Math.floor(Date.now() / 1000), nanos: 0 },
            display_state_changed: {
              display_id: displayId,
              status: this.getDisplayStatus(displayId)
            }
          });
          
          restartedDisplays.push(displayId);
        } catch (error) {
          failedDisplays.push(displayId);
          logger.error(`Failed to restart display ${displayId}:`, error);
        }
      }

      return {
        restart_dashboard_result: {
          restarted_displays: restartedDisplays,
          failed_displays: failedDisplays,
          processes_killed: processesKilled,
          processes_started: processesStarted
        }
      };
    } catch (error) {
      return {
        restart_dashboard_result: {
          restarted_displays: [],
          failed_displays: targetDisplays,
          processes_killed: processesKilled,
          processes_started: processesStarted
        }
      };
    }
  }

  private async getHealthCheckResult(): Promise<any> {
    return {
      host_status: this.getHostStatus(),
      display_statuses: this.getDisplayStatuses(),
      system_info: {
        uptime_seconds: Math.floor(process.uptime()),
        platform: process.platform,
        node_version: process.version,
        agent_version: this.configManager.getVersion(),
        total_displays: this.configManager.getDisplays().length,
        available_display_ids: this.configManager.getDisplays().map(d => d.id)
      }
    };
  }

  // Utility methods
  private getHostStatus(): any {
    const systemMetrics = this.getSystemMetrics();
    const legacyStatus = this.hostService.getHostStatus(); // Only for error info and browser processes

    const result = {
      online: true, // Always online if gRPC is responding
      cpu_usage_percent: systemMetrics.cpuUsage,
      memory_usage_percent: systemMetrics.memoryUsagePercent,
      memory_used_bytes: systemMetrics.memoryUsedBytes,
      memory_total_bytes: systemMetrics.memoryTotalBytes,
      browser_processes: legacyStatus.browserProcesses || 0, // Default to 0 if undefined
      last_error: legacyStatus.lastError || '',
      last_update: { seconds: Math.floor(Date.now() / 1000), nanos: 0 },
      debug_enabled: this.debugService.isDebugEnabled(), // Include debug status
      system_metrics: {
        load_average_1m: systemMetrics.loadAverage[0] || 0,
        load_average_5m: systemMetrics.loadAverage[1] || 0,
        load_average_15m: systemMetrics.loadAverage[2] || 0,
        uptime_seconds: Math.floor(require('os').uptime()),
        cpu_cores: require('os').cpus().length,
        cpu_model: require('os').cpus()[0]?.model || 'Unknown',
        disk_usage_percent: systemMetrics.diskUsagePercent,
        disk_free_bytes: systemMetrics.diskFreeBytes,
        disk_total_bytes: systemMetrics.diskTotalBytes,
        network_connections: systemMetrics.networkConnections
      }
    };

    return result;
  }

  private getSystemMetrics(): any {
    const os = require('os');
    const fs = require('fs');
    
    try {
      // Memory metrics - REAL system memory, not process memory
      const totalMemory = os.totalmem();
      const freeMemory = os.freemem();
      const usedMemory = totalMemory - freeMemory;
      const memoryUsagePercent = (usedMemory / totalMemory) * 100;

      // CPU usage - IMPROVED calculation using current CPU state
      const cpuUsage = this.calculateRealCpuUsage();

      // Disk metrics (for current working directory)
      let diskMetrics = {
        diskUsagePercent: 0,
        diskFreeBytes: 0,
        diskTotalBytes: 0
      };

      try {
        if (process.platform === 'win32') {
          // On Windows, we'll use a simple approximation
          // In a real implementation, you'd use a native module
          diskMetrics = {
            diskUsagePercent: 75, // Placeholder
            diskFreeBytes: 100 * 1024 * 1024 * 1024, // 100GB placeholder
            diskTotalBytes: 500 * 1024 * 1024 * 1024 // 500GB placeholder
          };
        } else {
          // On Unix systems, try to get real disk stats
          const stats = fs.statSync(process.cwd());
          // This is a simplified approach - in production you'd use statvfs
          diskMetrics = {
            diskUsagePercent: 75, // Placeholder
            diskFreeBytes: 100 * 1024 * 1024 * 1024,
            diskTotalBytes: 500 * 1024 * 1024 * 1024
          };
        }
      } catch (error) {
        // Fallback values if disk stats fail
      }

      return {
        cpuUsage: Math.round(cpuUsage * 100) / 100,
        memoryUsagePercent: Math.round(memoryUsagePercent * 100) / 100,
        memoryUsedBytes: usedMemory,
        memoryTotalBytes: totalMemory,
        loadAverage: os.loadavg(), // Fix: use os.loadavg() directly
        networkConnections: 0, // Placeholder - would need native module for real count
        ...diskMetrics
      };
    } catch (error) {
      logger.error('Failed to get system metrics:', error);
      
      // Return safe fallback values
      return {
        cpuUsage: 0,
        memoryUsagePercent: 0,
        memoryUsedBytes: 0,
        memoryTotalBytes: os.totalmem(),
        loadAverage: [0, 0, 0],
        networkConnections: 0,
        diskUsagePercent: 0,
        diskFreeBytes: 0,
        diskTotalBytes: 0
      };
    }
  }

  private async handleRemoveDashboard(cmd: any): Promise<any> {
    const displayId = cmd.display_id;
    
    logger.info(`🗑️ handleRemoveDashboard called for display: ${displayId}`);
    
    try {
      // Clear the assigned dashboard from state
      this.stateManager.clearAssignedDashboard(displayId);
      
      // Force refresh HostService display states to reflect StateManager changes
      this.hostService.forceRefreshFromSystem();
      
      // Close any existing windows for this display
      const windows = this.windowManager.getAllWindows().filter(w => 
        w.config.displayId === displayId
      );
      
      for (const window of windows) {
        try {
          await this.windowManager.closeWindow(window.id);
          logger.info(`🔪 Closed window ${window.id} for display ${displayId}`);
        } catch (error) {
          logger.error(`Failed to close window ${window.id}:`, error);
        }
      }
      
      // Broadcast display state change event
      this.broadcastEvent({
        event_id: `dashboard_removed_${Date.now()}`,
        type: 'DISPLAY_STATE_CHANGED',
        timestamp: { seconds: Math.floor(Date.now() / 1000), nanos: 0 },
        display_state_changed: {
          display_id: displayId,
          status: this.getDisplayStatus(displayId)
        }
      });
      
      logger.info(`✅ Dashboard successfully removed from display ${displayId}`);
      
      return {
        remove_dashboard_result: {
          display_id: displayId,
          dashboard_removed: true,
          status_message: `Dashboard removed from ${displayId}`
        }
      };
    } catch (error) {
      logger.error(`❌ Failed to remove dashboard from display ${displayId}:`, error);
      
      return {
        remove_dashboard_result: {
          display_id: displayId,
          dashboard_removed: false,
          status_message: `Failed to remove dashboard: ${error instanceof Error ? error.message : 'Unknown error'}`
        }
      };
    }
  }

  private getDisplayStatuses(): any[] {
    const displays = this.hostService.getDisplayStatuses();
    
    // 🔍 LOG: Verificar dados de display antes da conversão
    logger.debug(`Retrieved ${displays.length} display statuses`);
    // Log display summary
    const activeDisplays = displays.filter((d: any) => d.active).length;
    logger.debug(`Display summary: ${activeDisplays}/${displays.length} active displays`);
    
    return displays.map(display => this.convertDisplayStatus(display));
  }

  private getDisplayStatus(displayId: string): any {
    const display = this.hostService.getDisplayStatus(displayId);
    return this.convertDisplayStatus(display);
  }

  private convertDisplayStatus(display: any): any {
    return {
      display_id: display.id,
      active: display.active,
      current_url: display.currentUrl || '',
      last_refresh: { seconds: Math.floor((display.lastRefresh?.getTime() || Date.now()) / 1000), nanos: 0 },
      is_responsive: display.isResponsive,
      error_count: display.errorCount,
      last_error: display.lastError || '',
      assigned_dashboard: display.assignedDashboard ? {
        dashboard_id: display.assignedDashboard.dashboardId,
        url: display.assignedDashboard.url,
        refresh_interval_ms: display.assignedDashboard.refreshInterval || 0
      } : undefined
    };
  }

  // Event broadcasting
  public broadcastEvent(event: any): void {
    this.eventStreams.forEach(stream => {
      this.sendEventToStream(stream, event);
    });
  }

  private sendEventToStream(stream: grpc.ServerWritableStream<any, any>, event: any): void {
    try {
      stream.write(event);
    } catch (error) {
      logger.error('Failed to send event to stream:', error instanceof Error ? error.message : error);
      this.eventStreams.delete(stream);
    }
  }

  // Lifecycle methods
  public async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server.bindAsync(
        `0.0.0.0:${this.port}`,
        grpc.ServerCredentials.createInsecure(),
        (error, port) => {
          if (error) {
            logger.error('Failed to bind gRPC server:', error);
            reject(error);
            return;
          }

          this.server.start();
          this.isStarted = true;
          logger.success(`gRPC server listening on port ${port}`);
          
          // Setup periodic heartbeat
          this.setupHeartbeat();
          
          // Setup window event listeners
          this.setupWindowEventListeners();
          
          resolve();
        }
      );
    });
  }

  public stop(): void {
    if (this.isStarted) {
      this.server.tryShutdown((error) => {
        if (error) {
          logger.error('Error shutting down gRPC server:', error);
        } else {
          logger.info('gRPC server shut down successfully');
        }
      });
      this.isStarted = false;
    }
  }

  private setupHeartbeat(): void {
    // Send heartbeat every 30 seconds
    setInterval(() => {
      const heartbeatEvent = {
        event_id: `heartbeat_${Date.now()}`,
        type: 'HEARTBEAT',
        timestamp: { seconds: Math.floor(Date.now() / 1000), nanos: 0 },
        heartbeat: {
          host_status: this.getHostStatus(),
          display_statuses: this.getDisplayStatuses()
        }
      };

      this.broadcastEvent(heartbeatEvent);
    }, 30000);
  }

  private setupWindowEventListeners(): void {
    logger.debug('Setting up window event listeners');
    
    // Listen for window closed events from WindowManager
    this.windowManager.on('window-closed', (event: { windowId: string; displayId: string; totalWindows: number }) => {
      console.log(`🎯 [GRPC-RECEIVED] Window closed event received:`, event);
      logger.info(`📺 Window closed event: ${event.windowId} on ${event.displayId}`);
      
      // Force refresh HostService to reflect StateManager changes
      this.hostService.forceRefreshFromSystem();
      
      // Broadcast display state change via gRPC
      this.broadcastEvent({
        event_id: `dashboard_closed_${Date.now()}`,
        type: 'DISPLAY_STATE_CHANGED',
        timestamp: { seconds: Math.floor(Date.now() / 1000), nanos: 0 },
        display_state_changed: {
          display_id: event.displayId,
          status: this.getDisplayStatus(event.displayId)
        }
      });
      
      logger.debug(`Broadcasted dashboard closed event for ${event.displayId}`);
      logger.info(`📡 Broadcasted dashboard closed event for ${event.displayId}`);
    });
    
    logger.debug('Window event listeners setup complete');
    logger.info('✅ Window event listeners setup complete');
  }

  private calculateRealCpuUsage(): number {
    try {
      const os = require('os');
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
        // First measurement or too soon - use multiple fallbacks for Windows
        
        let fallbackUsage = 0;
        
        // Try load average first (works on Unix-like systems)
        try {
          const loadAvg = os.loadavg();
          const cpuCount = cpus.length;
          fallbackUsage = Math.min((loadAvg[0] / cpuCount) * 100, 100);
        } catch (e) {
        }
        
        // If load average is 0 or not available (Windows), start with 0 and wait for real measurement
        if (fallbackUsage === 0 && process.platform === 'win32') {
          fallbackUsage = 0;
        }
        
        // Store current values for next time
        this.lastCpuInfo = { idle: totalIdle, total: totalTick };
        this.lastCpuTime = now;
        
        return Math.max(0, Math.min(100, fallbackUsage)); // Return fixed fallback value on first measurement
      }
    } catch (error) {
      console.error('Error calculating CPU usage:', error);
      
      // Ultimate fallback
      return 15; // Return a reasonable default value
    }
  }

  public getConnectedClientsCount(): number {
    return this.eventStreams.size;
  }

  // Debug command handlers
  private async handleDebugEnable(cmd: any): Promise<any> {
    try {
      logger.info('gRPC: Enabling debug mode');
      
      // Enable debug service
      this.debugService.enable();
      
      return {
        debug_enable_result: {
          debug_enabled: true,
          status_message: 'Debug mode enabled successfully'
        }
      };
    } catch (error) {
      logger.error('Failed to enable debug mode:', error);
      throw new Error(`Failed to enable debug mode: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async handleDebugDisable(cmd: any): Promise<any> {
    try {
      logger.info('gRPC: Disabling debug mode');
      
      // Disable debug service
      this.debugService.disable();
      
      return {
        debug_disable_result: {
          debug_disabled: true,
          status_message: 'Debug mode disabled successfully'
        }
      };
    } catch (error) {
      logger.error('Failed to disable debug mode:', error);
      throw new Error(`Failed to disable debug mode: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}