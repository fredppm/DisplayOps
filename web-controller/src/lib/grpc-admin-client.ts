import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { join } from 'path';
import { EventEmitter } from 'events';
import os from 'os';
// Using proto-loader runtime types (no static TypeScript types)
import { logger } from '../utils/logger';

// Load protobuf definition
const PROTO_PATH = process.resourcesPath 
  ? join(process.resourcesPath, 'shared', 'proto', 'controller-admin.proto') // Production (Electron packaged)
  : join(process.cwd(), '..', 'shared', 'proto', 'controller-admin.proto');  // Development

export interface GrpcAdminClientConfig {
  adminHost: string;
  adminPort: number;
  controllerId?: string;
  heartbeatInterval?: number; // milliseconds
  reconnectDelay?: number; // milliseconds
  maxReconnectAttempts?: number;
}

export interface ControllerInfo {
  hostname: string;
  macAddress: string;
  localNetwork: string;
  version: string;
  location?: string;
  siteId?: string;
}

// gRPC message creation helpers
function createTimestamp(): any {
  const now = Date.now();
  return {
    seconds: Math.floor(now / 1000),
    nanos: (now % 1000) * 1000000
  };
}

function createRegistrationHeartbeat(controllerId: string, registrationData: any): any {
  return {
    controller_id: controllerId,
    type: 'REGISTRATION',
    timestamp: createTimestamp(),
    registration: {
      hostname: registrationData.hostname,
      mac_address: registrationData.macAddress,
      local_network: registrationData.localNetwork,
      version: registrationData.version,
      location: registrationData.location,
      site_id: registrationData.siteId,
      mdns_service: registrationData.mdnsService,
      web_admin_url: registrationData.webAdminUrl,
      system_info: registrationData.systemInfo
    }
  };
}

function createStatusHeartbeat(controllerId: string, statusData: any): any {
  return {
    controller_id: controllerId,
    type: 'STATUS_UPDATE',
    timestamp: createTimestamp(),
    status: {
      status: statusData.status,
      metrics: statusData.metrics,
      services: statusData.services,
      last_error: statusData.lastError,
      last_error_message: statusData.lastErrorMessage
    }
  };
}

export class GrpcAdminClient extends EventEmitter {
  private client: any;
  private config: GrpcAdminClientConfig;
  private heartbeatStream: grpc.ClientDuplexStream<any, any> | null = null;
  private commandStream: grpc.ClientDuplexStream<any, any> | null = null;
  private isConnected: boolean = false;
  private isRegistered: boolean = false;
  private reconnectAttempts: number = 0;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private packageDefinition: any;
  private protoDescriptor: any;
  private controllerId: string;
  private controllerInfo: ControllerInfo | null = null;

  constructor(config: GrpcAdminClientConfig) {
    super();
    this.config = {
      heartbeatInterval: 30000, // 30 seconds
      reconnectDelay: 5000,
      maxReconnectAttempts: -1, // infinite retries
      ...config
    };
    this.controllerId = config.controllerId || this.generateControllerId();
    this.setupClient();
  }

  private setupClient(): void {
    try {
      // Load proto file
      this.packageDefinition = protoLoader.loadSync(PROTO_PATH, {
        keepCase: true,
        longs: String,
        enums: String,
        defaults: true,
        oneofs: true
      });

      this.protoDescriptor = grpc.loadPackageDefinition(this.packageDefinition);
      
      // Create gRPC client
      const address = `${this.config.adminHost}:${this.config.adminPort}`;
      this.client = new this.protoDescriptor.displayops.ControllerAdminService(
        address,
        grpc.credentials.createInsecure()
      );

      logger.info('gRPC Admin client initialized', { address, controllerId: this.controllerId });
    } catch (error) {
      logger.error('Failed to setup gRPC Admin client:', error);
      throw error;
    }
  }

  public async connect(): Promise<void> {
    if (this.isConnected) {
      logger.info('gRPC Admin client already connected');
      return;
    }

    try {
      // Collect controller information
      this.controllerInfo = await this.collectControllerInfo();
      
      // Start heartbeat stream
      await this.startHeartbeatStream();
      
      // Start command stream
      await this.startCommandStream();
      
    } catch (error) {
      logger.error('Failed to connect to gRPC Admin server:', error);
      this.handleDisconnection();
      throw error;
    }
  }

  public disconnect(): void {
    this.isConnected = false;
    this.isRegistered = false;
    
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    if (this.heartbeatStream) {
      try {
        this.heartbeatStream.end();
      } catch (error) {
        logger.warn('Error ending heartbeat stream:', error);
      }
      this.heartbeatStream = null;
    }

    if (this.commandStream) {
      try {
        this.commandStream.end();
      } catch (error) {
        logger.warn('Error ending command stream:', error);
      }
      this.commandStream = null;
    }

    logger.info('gRPC Admin client disconnected');
    this.emit('disconnected');
  }

  private async startHeartbeatStream(): Promise<void> {
    if (this.heartbeatStream) {
      logger.warn('Heartbeat stream already active');
      return;
    }

    try {
      this.heartbeatStream = this.client.HeartbeatStream();

      // Handle responses from admin
      this.heartbeatStream?.on('data', (response: any) => {
        this.handleAdminResponse(response);
      });

      this.heartbeatStream?.on('end', () => {
        logger.info('Heartbeat stream ended');
        this.heartbeatStream = null;
        this.handleDisconnection();
      });

      this.heartbeatStream?.on('error', (error: any) => {
        logger.error('Heartbeat stream error:', error);
        this.heartbeatStream = null;
        this.handleDisconnection();
      });

      // Send initial registration heartbeat
      await this.sendRegistrationHeartbeat();
      
      this.isConnected = true;
      this.reconnectAttempts = 0;
      
      // Start periodic status heartbeats
      this.startPeriodicHeartbeats();
      
      logger.info('gRPC heartbeat stream established');
      this.emit('connected');

    } catch (error) {
      logger.error('Failed to start heartbeat stream:', error);
      this.handleDisconnection();
      throw error;
    }
  }

  private async startCommandStream(): Promise<void> {
    if (this.commandStream) {
      logger.warn('Command stream already active');
      return;
    }

    try {
      this.commandStream = this.client.AdminCommandStream();

      // Handle commands from admin
      this.commandStream?.on('data', (command: any) => {
        this.handleAdminCommand(command);
      });

      this.commandStream?.on('end', () => {
        logger.info('Command stream ended');
        this.commandStream = null;
      });

      this.commandStream?.on('error', (error: any) => {
        logger.error('Command stream error:', error);
        this.commandStream = null;
      });

      logger.info('gRPC command stream established');

    } catch (error) {
      logger.error('Failed to start command stream:', error);
      throw error;
    }
  }

  private async sendRegistrationHeartbeat(): Promise<void> {
    if (!this.controllerInfo || !this.heartbeatStream) {
      throw new Error('Controller info or heartbeat stream not available');
    }

    const heartbeat = createRegistrationHeartbeat(
      this.controllerId,
      {
        hostname: this.controllerInfo.hostname,
        macAddress: this.controllerInfo.macAddress,
        localNetwork: this.controllerInfo.localNetwork,
        version: this.controllerInfo.version,
        location: this.controllerInfo.location,
        siteId: this.controllerInfo.siteId,
        mdnsService: '_displayops._tcp.local',
        webAdminUrl: process.env.CONTROLLER_WEB_ADMIN_URL || 'http://localhost:3001',
        systemInfo: await this.getSystemInfo()
      }
    );

    this.heartbeatStream.write(heartbeat);
    logger.info('Registration heartbeat sent', { controllerId: this.controllerId });
  }

  private async sendStatusHeartbeat(): Promise<void> {
    if (!this.isRegistered || !this.heartbeatStream) {
      return;
    }

    try {
      const heartbeat = createStatusHeartbeat(
        this.controllerId,
        {
          status: 'ONLINE',
          metrics: await this.getSystemMetrics(),
          services: await this.getServiceStatuses()
        }
      );

      this.heartbeatStream.write(heartbeat);
      logger.debug('Status heartbeat sent', { controllerId: this.controllerId });
    } catch (error) {
      logger.error('Failed to send status heartbeat:', error);
    }
  }

  private handleAdminResponse(response: any): void {
    logger.debug('Received admin response', { 
      type: response.type,
      controllerId: response.controller_id 
    });

    switch (response.type) {
      case 'REGISTRATION_SUCCESS':
        this.handleRegistrationSuccess(response);
        break;
        
      case 'REGISTRATION_ERROR':
        this.handleRegistrationError(response);
        break;
        
      case 'STATUS_ACKNOWLEDGED':
        // Status was acknowledged, nothing special to do
        break;
        
      case 'ERROR':
        this.handleErrorResponse(response);
        break;
        
      default:
        logger.warn('Unknown admin response type', { type: response.type });
    }
  }

  private handleRegistrationSuccess(response: any): void {
    const regResponse = response.registration_response;
    if (regResponse) {
      logger.info('Controller registration successful', {
        controllerId: this.controllerId,
        assignedId: regResponse.assigned_controller_id,
        siteId: regResponse.assigned_site_id,
        message: regResponse.message
      });

      this.isRegistered = true;
      this.emit('registered', {
        controllerId: regResponse.assigned_controller_id || this.controllerId,
        siteId: regResponse.assigned_site_id,
        message: regResponse.message
      });
    }
  }

  private handleRegistrationError(response: any): void {
    const regResponse = response.registration_response;
    const message = regResponse?.message || 'Registration failed';
    
    logger.error('Controller registration failed', { 
      controllerId: this.controllerId,
      message 
    });
    
    this.emit('registration_error', { controllerId: this.controllerId, message });
  }

  private handleErrorResponse(response: any): void {
    const errorResponse = response.error;
    if (errorResponse) {
      logger.error('Admin error response', {
        errorCode: errorResponse.error_code,
        message: errorResponse.error_message,
        retrySuggested: errorResponse.retry_suggested
      });
      
      this.emit('error', errorResponse);
    }
  }

  private async handleAdminCommand(command: any): Promise<void> {
    logger.debug('Received admin command', { 
      type: command.type,
      commandId: command.command_id 
    });

    let success = false;
    let errorMessage = '';

    try {
      switch (command.type) {
        case 'DASHBOARD_SYNC':
          await this.handleDashboardSync(command);
          success = true;
          break;
          
        case 'COOKIE_SYNC':
          await this.handleCookieSync(command);
          success = true;
          break;
          
        case 'CONFIG_UPDATE':
          await this.handleConfigUpdate(command);
          success = true;
          break;
          
        case 'STATUS_REQUEST':
          await this.handleStatusRequest(command);
          success = true;
          break;
          
        default:
          errorMessage = `Unknown command type: ${command.type}`;
          logger.warn('Unknown admin command type', { type: command.type });
      }
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : 'Command execution failed';
      logger.error('Failed to handle admin command', { 
        type: command.type,
        error: errorMessage 
      });
    }

    // Send response back to admin
    await this.sendCommandResponse(command.command_id, success, errorMessage);
  }

  private async handleDashboardSync(command: any): Promise<void> {
    const dashboardSync = command.dashboard_sync;
    if (!dashboardSync) {
      throw new Error('Dashboard sync command missing payload');
    }

    logger.info('Processing dashboard sync command', {
      dashboardsCount: dashboardSync.dashboards?.length || 0,
      syncType: dashboardSync.sync_type,
      syncTimestamp: dashboardSync.sync_timestamp
    });

    // Convert dashboards from gRPC format to local format
    const dashboards = (dashboardSync.dashboards || []).map((d: any) => ({
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
      syncType: dashboardSync.sync_type,
      syncTimestamp: dashboardSync.sync_timestamp
    });

    logger.info('Dashboard sync completed successfully', {
      dashboardsCount: dashboards.length
    });
  }

  private async handleCookieSync(command: any): Promise<void> {
    const cookieSync = command.cookie_sync;
    if (!cookieSync) {
      throw new Error('Cookie sync command missing payload');
    }

    logger.info('Processing cookie sync command', {
      domainsCount: cookieSync.cookie_domains?.length || 0,
      syncType: cookieSync.sync_type,
      syncTimestamp: cookieSync.sync_timestamp
    });

    // Convert cookie domains from gRPC format to local format
    const cookiesData = {
      domains: {} as any,
      lastUpdated: cookieSync.sync_timestamp
    };

    (cookieSync.cookie_domains || []).forEach((domainData: any) => {
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
        lastUpdated: cookieSync.sync_timestamp
      };
    });

    // Save cookies using the CookieStorageManager format
    await this.saveCookiesData(cookiesData);

    // Emit event for other parts of the application
    this.emit('cookie_sync', {
      cookiesData,
      syncType: cookieSync.sync_type,
      syncTimestamp: cookieSync.sync_timestamp
    });

    logger.info('Cookie sync completed successfully', {
      domainsCount: Object.keys(cookiesData.domains).length,
      totalCookies: Object.values(cookiesData.domains).reduce((sum: number, domain: any) => sum + domain.cookies.length, 0)
    });
  }

  private async handleConfigUpdate(command: any): Promise<void> {
    const configUpdate = command.config_update;
    if (!configUpdate) {
      throw new Error('Config update command missing payload');
    }

    logger.info('Processing config update command', {
      configValues: Object.keys(configUpdate.config_values || {}).length
    });

    // TODO: Implement config update logic
    this.emit('config_update', configUpdate);
  }

  private async handleStatusRequest(command: any): Promise<void> {
    const statusRequest = command.status_request;
    logger.info('Processing status request command', {
      includeDetailedMetrics: statusRequest?.include_detailed_metrics
    });

    // TODO: Implement status request logic
    this.emit('status_request', statusRequest);
  }

  private async sendCommandResponse(commandId: string, success: boolean, errorMessage?: string): Promise<void> {
    if (!this.commandStream) {
      logger.warn('Cannot send command response - command stream not active');
      return;
    }

    const response = {
      command_id: commandId,
      success,
      error_message: errorMessage || '',
      timestamp: this.createTimestamp()
    };

    try {
      this.commandStream.write(response);
      logger.debug('Command response sent', { commandId, success });
    } catch (error) {
      logger.error('Failed to send command response', { commandId, error });
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
      
      logger.info('Dashboards saved locally', { 
        count: dashboards.length,
        file: dashboardsFile 
      });
    } catch (error) {
      logger.error('Failed to save dashboards locally', { error });
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
      
      logger.info('Cookies saved locally', { 
        domainsCount: Object.keys(cookiesData.domains).length,
        file: cookiesFile 
      });
    } catch (error) {
      logger.error('Failed to save cookies locally', { error });
      throw new Error('Failed to save cookies locally');
    }
  }

  private startPeriodicHeartbeats(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.heartbeatInterval = setInterval(() => {
      this.sendStatusHeartbeat().catch(error => {
        logger.error('Failed to send periodic heartbeat:', error);
      });
    }, this.config.heartbeatInterval!);
  }

  private handleDisconnection(): void {
    if (!this.isConnected && !this.heartbeatStream && !this.commandStream) {
      return; // Already handling disconnection
    }

    this.isConnected = false;
    this.isRegistered = false;
    this.heartbeatStream = null;
    this.commandStream = null;

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    this.emit('disconnected');

    // Schedule reconnection
    if (this.config.maxReconnectAttempts === -1 || this.reconnectAttempts < this.config.maxReconnectAttempts!) {
      this.scheduleReconnection();
    } else {
      logger.error('Max reconnection attempts reached');
      this.emit('max_reconnect_attempts');
    }
  }

  private scheduleReconnection(): void {
    this.reconnectAttempts++;
    const delay = this.config.reconnectDelay! * Math.pow(2, Math.min(this.reconnectAttempts - 1, 5));
    
    logger.info(`Scheduling reconnection attempt ${this.reconnectAttempts} in ${delay}ms`);
    
    this.reconnectTimeout = setTimeout(() => {
      this.setupClient(); // Recreate gRPC client but preserve controller ID
      this.connect().catch(error => {
        logger.error('Reconnection attempt failed:', error);
      });
    }, delay);
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
    
    // Generate a fake MAC address for fallback
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
            // Infer network from IP (assumes /24 for simplicity)
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
    
    return '192.168.1.0/24'; // fallback
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
      disk_usage_percent: 0, // TODO: Implement disk usage
      disk_free_bytes: 0, // TODO: Implement disk usage
      network_rx_bytes_per_sec: 0, // TODO: Implement network stats
      network_tx_bytes_per_sec: 0, // TODO: Implement network stats
      uptime_seconds: os.uptime()
    };
  }

  private async getCpuUsage(): Promise<number> {
    // Simple CPU usage calculation
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
    // TODO: Implement actual service status checking
    return [
      {
        service_name: 'web-server',
        running: true,
        port: 3001,
        last_check: this.createTimestamp(),
        status_message: 'Running'
      },
      {
        service_name: 'mdns-discovery',
        running: true,
        last_check: this.createTimestamp(),
        status_message: 'Active'
      }
    ];
  }

  private createTimestamp(): { seconds: number; nanos: number } {
    const now = Date.now();
    return {
      seconds: Math.floor(now / 1000),
      nanos: (now % 1000) * 1000000
    };
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

  public get reconnectAttemptsCount(): number {
    return this.reconnectAttempts;
  }
}