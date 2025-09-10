import { EventEmitter } from 'events';
import os from 'os';
import { logger } from '../utils/logger';

export interface HttpAdminClientConfig {
  adminHost: string;
  adminPort: number;
  controllerId?: string;
  heartbeatInterval?: number; // milliseconds
  commandPollInterval?: number; // milliseconds
  maxRetries?: number;
  useHttps?: boolean;
}

export interface ControllerInfo {
  hostname: string;
  macAddress: string;
  localNetwork: string;
  version: string;
  location?: string;
  siteId?: string;
}

interface RegistrationRequest {
  controller_id: string;
  hostname: string;
  mac_address: string;
  local_network: string;
  version: string;
  location?: string;
  site_id?: string;
  mdns_service: string;
  web_admin_url: string;
  system_info: any;
}

interface HeartbeatRequest {
  controller_id: string;
  timestamp: string;
  status: string;
  metrics?: any;
  services?: any[];
  last_error?: string;
  last_error_message?: string;
}

interface PendingCommand {
  command_id: string;
  controller_id: string;
  type: 'dashboard_sync' | 'cookie_sync' | 'config_update' | 'status_request';
  timestamp: string;
  payload: any;
}

export class HttpAdminClient extends EventEmitter {
  private config: HttpAdminClientConfig;
  private isConnected: boolean = false;
  private isRegistered: boolean = false;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private commandPollInterval: NodeJS.Timeout | null = null;
  private controllerId: string;
  private controllerInfo: ControllerInfo | null = null;
  private baseUrl: string;

  constructor(config: HttpAdminClientConfig) {
    super();
    this.config = {
      heartbeatInterval: 30000, // 30 seconds
      commandPollInterval: 10000, // 10 seconds
      maxRetries: 3,
      useHttps: false,
      ...config
    };
    this.controllerId = config.controllerId || this.generateControllerId();
    
    const protocol = this.config.useHttps ? 'https' : 'http';
    this.baseUrl = `${protocol}://${this.config.adminHost}:${this.config.adminPort}`;
  }

  public async connect(): Promise<void> {
    if (this.isConnected) {
      logger.info('HTTP Admin client already connected');
      return;
    }

    try {
      // Collect controller information
      this.controllerInfo = await this.collectControllerInfo();
      
      // Attempt registration
      await this.registerWithAdmin();
      
      // Start periodic heartbeats and command polling
      this.startPeriodicOperations();
      
      this.isConnected = true;
      logger.info('HTTP Admin client connected successfully');
      this.emit('connected');
      
    } catch (error) {
      logger.error('Failed to connect to HTTP Admin server:', error);
      throw error;
    }
  }

  public disconnect(): void {
    this.isConnected = false;
    this.isRegistered = false;
    
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    if (this.commandPollInterval) {
      clearInterval(this.commandPollInterval);
      this.commandPollInterval = null;
    }

    logger.info('HTTP Admin client disconnected');
    this.emit('disconnected');
  }

  private async registerWithAdmin(): Promise<void> {
    if (!this.controllerInfo) {
      throw new Error('Controller info not available');
    }

    const registrationData: RegistrationRequest = {
      controller_id: this.controllerId,
      hostname: this.controllerInfo.hostname,
      mac_address: this.controllerInfo.macAddress,
      local_network: this.controllerInfo.localNetwork,
      version: this.controllerInfo.version,
      location: this.controllerInfo.location,
      site_id: this.controllerInfo.siteId,
      mdns_service: '_displayops._tcp.local',
      web_admin_url: process.env.CONTROLLER_WEB_ADMIN_URL || 'http://localhost:3001',
      system_info: await this.getSystemInfo()
    };

    const response = await this.makeHttpRequest('POST', '/api/controller/register', registrationData);

    if (response.success) {
      this.isRegistered = true;
      logger.info('Controller registration successful via HTTP', {
        controllerId: response.assigned_controller_id || this.controllerId,
        siteId: response.assigned_site_id,
        message: response.message
      });

      this.emit('registered', {
        controllerId: response.assigned_controller_id || this.controllerId,
        siteId: response.assigned_site_id,
        message: response.message
      });
    } else {
      throw new Error(`Registration failed: ${response.message}`);
    }
  }

  private async sendHeartbeat(): Promise<void> {
    if (!this.isRegistered) {
      return;
    }

    try {
      const heartbeatData: HeartbeatRequest = {
        controller_id: this.controllerId,
        timestamp: new Date().toISOString(),
        status: 'online',
        metrics: await this.getSystemMetrics(),
        services: await this.getServiceStatuses()
      };

      const response = await this.makeHttpRequest('POST', '/api/controller/heartbeat', heartbeatData);

      if (response.received) {
        logger.debug('Heartbeat acknowledged via HTTP', { controllerId: this.controllerId });
      }
    } catch (error) {
      logger.error('Failed to send heartbeat via HTTP:', error);
    }
  }

  private async pollForCommands(): Promise<void> {
    if (!this.isRegistered) {
      return;
    }

    try {
      const response = await this.makeHttpRequest('GET', `/api/controller/commands/${this.controllerId}`);

      if (response.commands && response.commands.length > 0) {
        logger.info('Received commands via HTTP polling', {
          controllerId: this.controllerId,
          commandsCount: response.commands.length
        });

        for (const command of response.commands) {
          await this.processCommand(command);
        }
      }
    } catch (error) {
      logger.error('Failed to poll for commands via HTTP:', error);
    }
  }

  private async processCommand(command: PendingCommand): Promise<void> {
    let success = false;
    let errorMessage = '';

    try {
      switch (command.type) {
        case 'dashboard_sync':
          await this.handleDashboardSync(command);
          success = true;
          break;
          
        case 'cookie_sync':
          await this.handleCookieSync(command);
          success = true;
          break;
          
        default:
          errorMessage = `Unknown command type: ${command.type}`;
          logger.warn('Unknown command type via HTTP', { type: command.type });
      }
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : 'Command execution failed';
      logger.error('Failed to process command via HTTP', { 
        type: command.type,
        error: errorMessage 
      });
    }

    // Send response back to admin
    await this.sendCommandResponse(command.command_id, success, errorMessage);
  }

  private async handleDashboardSync(command: PendingCommand): Promise<void> {
    const payload = command.payload;
    logger.info('Processing dashboard sync command via HTTP', {
      dashboardsCount: payload.dashboards?.length || 0,
      syncType: payload.sync_type,
      syncTimestamp: payload.sync_timestamp
    });

    // Convert dashboards from HTTP format to local format
    const dashboards = (payload.dashboards || []).map((d: any) => ({
      id: d.id,
      name: d.name,
      url: d.url,
      description: d.description,
      refreshInterval: d.refresh_interval,
      requiresAuth: d.requires_auth,
      category: d.category || ''
    }));

    // Save dashboards locally
    await this.saveDashboards(dashboards);

    // Emit event for other parts of the application
    this.emit('dashboard_sync', {
      dashboards,
      syncType: payload.sync_type,
      syncTimestamp: payload.sync_timestamp
    });

    logger.info('Dashboard sync completed successfully via HTTP', {
      dashboardsCount: dashboards.length
    });
  }

  private async handleCookieSync(command: PendingCommand): Promise<void> {
    const payload = command.payload;
    logger.info('Processing cookie sync command via HTTP', {
      domainsCount: payload.cookie_domains?.length || 0,
      syncType: payload.sync_type,
      syncTimestamp: payload.sync_timestamp
    });

    // Convert cookie domains from HTTP format to local format
    const cookiesData = {
      domains: {} as any,
      lastUpdated: payload.sync_timestamp
    };

    (payload.cookie_domains || []).forEach((domainData: any) => {
      const cookies = (domainData.cookies || []).map((c: any) => ({
        name: c.name,
        value: c.value,
        domain: c.domain,
        path: c.path,
        secure: c.secure,
        httpOnly: c.http_only,
        sameSite: c.same_site,
        expirationDate: c.expiration_date,
        description: c.description || '',
        importedAt: new Date()
      }));

      cookiesData.domains[domainData.domain] = {
        domain: domainData.domain,
        description: domainData.description,
        cookies,
        lastImport: new Date(),
        lastUpdated: payload.sync_timestamp
      };
    });

    // Save cookies using the CookieStorageManager format
    await this.saveCookiesData(cookiesData);

    // Emit event for other parts of the application
    this.emit('cookie_sync', {
      cookiesData,
      syncType: payload.sync_type,
      syncTimestamp: payload.sync_timestamp
    });

    logger.info('Cookie sync completed successfully via HTTP', {
      domainsCount: Object.keys(cookiesData.domains).length,
      totalCookies: Object.values(cookiesData.domains).reduce((sum: number, domain: any) => sum + domain.cookies.length, 0)
    });
  }

  private async sendCommandResponse(commandId: string, success: boolean, errorMessage?: string): Promise<void> {
    try {
      const responseData = {
        command_id: commandId,
        controller_id: this.controllerId,
        success,
        error_message: errorMessage || '',
        timestamp: new Date().toISOString()
      };

      await this.makeHttpRequest('POST', '/api/controller/command-response', responseData);
      logger.debug('Command response sent via HTTP', { commandId, success });
    } catch (error) {
      logger.error('Failed to send command response via HTTP', { commandId, error });
    }
  }

  private async saveDashboards(dashboards: any[]): Promise<void> {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      
      const dashboardsFile = path.join(process.cwd(), 'data', 'dashboards.json');
      const dataDir = path.dirname(dashboardsFile);
      
      // Ensure data directory exists
      await fs.mkdir(dataDir, { recursive: true });
      
      // Save dashboards
      await fs.writeFile(dashboardsFile, JSON.stringify(dashboards, null, 2), 'utf-8');
      
      logger.info('Dashboards saved locally via HTTP', { 
        count: dashboards.length,
        file: dashboardsFile 
      });
    } catch (error) {
      logger.error('Failed to save dashboards locally via HTTP', { error });
      throw new Error('Failed to save dashboards locally');
    }
  }

  private async saveCookiesData(cookiesData: any): Promise<void> {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      
      const cookiesFile = path.join(process.cwd(), 'data', 'cookies.json');
      const dataDir = path.dirname(cookiesFile);
      
      // Ensure data directory exists
      await fs.mkdir(dataDir, { recursive: true });
      
      // Save cookies data
      await fs.writeFile(cookiesFile, JSON.stringify(cookiesData, null, 2), 'utf-8');
      
      logger.info('Cookies saved locally via HTTP', { 
        domainsCount: Object.keys(cookiesData.domains).length,
        file: cookiesFile 
      });
    } catch (error) {
      logger.error('Failed to save cookies locally via HTTP', { error });
      throw new Error('Failed to save cookies locally');
    }
  }

  private startPeriodicOperations(): void {
    // Start periodic heartbeats
    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeat().catch(error => {
        logger.error('Failed to send periodic heartbeat via HTTP:', error);
      });
    }, this.config.heartbeatInterval!);

    // Start command polling
    this.commandPollInterval = setInterval(() => {
      this.pollForCommands().catch(error => {
        logger.error('Failed to poll for commands via HTTP:', error);
      });
    }, this.config.commandPollInterval!);
  }

  private async makeHttpRequest(method: string, endpoint: string, data?: any): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': `office-tv-controller/${this.controllerId}`
      }
    };

    if (data && (method === 'POST' || method === 'PUT')) {
      options.body = JSON.stringify(data);
    }

    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= this.config.maxRetries!; attempt++) {
      try {
        logger.debug(`HTTP ${method} ${endpoint} (attempt ${attempt}/${this.config.maxRetries})`);
        
        const response = await fetch(url, options);
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();
        
        logger.debug(`HTTP ${method} ${endpoint} successful`);
        return result;
        
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        logger.warn(`HTTP ${method} ${endpoint} failed (attempt ${attempt}/${this.config.maxRetries}):`, lastError.message);
        
        if (attempt < this.config.maxRetries!) {
          // Wait before retry (exponential backoff)
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw lastError || new Error('HTTP request failed after all retries');
  }

  private async collectControllerInfo(): Promise<ControllerInfo> {
    return {
      hostname: os.hostname(),
      macAddress: await this.getMacAddress(),
      localNetwork: await this.getLocalNetwork(),
      version: '1.0.0', // TODO: Get from package.json or env
      location: process.env.CONTROLLER_LOCATION || `${os.hostname()}`,
      siteId: process.env.CONTROLLER_SITE_ID
    };
  }

  private async getMacAddress(): Promise<string> {
    try {
      const interfaces = os.networkInterfaces();
      
      for (const [name, nets] of Object.entries(interfaces)) {
        if (!nets || name.includes('lo')) continue;
        
        for (const net of nets) {
          if (net.family === 'IPv4' && !net.internal && net.mac) {
            return net.mac;
          }
        }
      }
    } catch (error) {
      logger.warn('Could not determine MAC address:', error);
    }
    
    return this.generateFakeMac();
  }

  private generateFakeMac(): string {
    const chars = '0123456789abcdef';
    let mac = '';
    for (let i = 0; i < 6; i++) {
      if (i > 0) mac += ':';
      mac += chars.charAt(Math.floor(Math.random() * chars.length));
      mac += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return mac;
  }

  private async getLocalNetwork(): Promise<string> {
    try {
      const interfaces = os.networkInterfaces();
      
      for (const [name, nets] of Object.entries(interfaces)) {
        if (!nets || name.includes('lo')) continue;
        
        for (const net of nets) {
          if (net.family === 'IPv4' && !net.internal) {
            const ip = net.address;
            const parts = ip.split('.');
            parts[3] = '0';
            return `${parts.join('.')}/24`;
          }
        }
      }
    } catch (error) {
      logger.warn('Could not determine local network:', error);
    }
    
    return '192.168.1.0/24';
  }

  private generateControllerId(): string {
    const hostname = os.hostname().toLowerCase().replace(/[^a-z0-9]/g, '-');
    return `ctrl-${hostname}`;
  }

  private async getSystemInfo() {
    const cpus = os.cpus();
    return {
      platform: os.platform(),
      arch: os.arch(),
      node_version: process.version,
      controller_version: '1.0.0', // TODO: Get from package.json
      total_memory_gb: Math.round(os.totalmem() / (1024 * 1024 * 1024)),
      cpu_cores: cpus.length,
      cpu_model: cpus[0]?.model || 'Unknown'
    };
  }

  private async getSystemMetrics(): Promise<any> {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;

    return {
      cpu_usage_percent: await this.getCpuUsage(),
      memory_usage_percent: (usedMem / totalMem) * 100,
      memory_used_bytes: usedMem,
      memory_total_bytes: totalMem,
      disk_usage_percent: 0,
      disk_free_bytes: 0,
      network_rx_bytes_per_sec: 0,
      network_tx_bytes_per_sec: 0,
      uptime_seconds: os.uptime()
    };
  }

  private async getCpuUsage(): Promise<number> {
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;

    cpus.forEach(cpu => {
      for (const type in cpu.times) {
        totalTick += (cpu.times as any)[type];
      }
      totalIdle += cpu.times.idle;
    });

    const idle = totalIdle / cpus.length;
    const total = totalTick / cpus.length;
    
    return 100 - ~~(100 * idle / total);
  }

  private async getServiceStatuses(): Promise<any[]> {
    return [
      {
        service_name: 'web-server',
        running: true,
        port: 3001,
        last_check: new Date().toISOString(),
        status_message: 'Running'
      },
      {
        service_name: 'mdns-discovery',
        running: true,
        last_check: new Date().toISOString(),
        status_message: 'Active'
      }
    ];
  }

  // Public getters
  public get connected(): boolean {
    return this.isConnected;
  }

  public get registered(): boolean {
    return this.isRegistered;
  }

  public get id(): string {
    return this.controllerId;
  }
}