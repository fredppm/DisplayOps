import { EventEmitter } from 'events';
import { io, Socket } from 'socket.io-client';
import os from 'os';
import { logger } from '../utils/logger';

export interface WebSocketAdminClientConfig {
  adminHost: string;
  adminPort: number;
  controllerId?: string;
  heartbeatInterval?: number; // milliseconds
  reconnectDelay?: number; // milliseconds
  maxReconnectAttempts?: number;
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

interface WebSocketMessage {
  type: 'registration' | 'status_update' | 'command_response';
  controller_id: string;
  timestamp: string;
  payload: any;
}

interface AdminMessage {
  type: 'registration_success' | 'registration_error' | 'status_acknowledged' | 'dashboard_sync' | 'cookie_sync' | 'error';
  controller_id: string;
  timestamp: string;
  payload: any;
}

export class WebSocketAdminClient extends EventEmitter {
  private socket: Socket | null = null;
  private config: WebSocketAdminClientConfig;
  private isConnected: boolean = false;
  private isRegistered: boolean = false;
  private reconnectAttempts: number = 0;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private controllerId: string;
  private controllerInfo: ControllerInfo | null = null;

  constructor(config: WebSocketAdminClientConfig) {
    super();
    this.config = {
      heartbeatInterval: 30000, // 30 seconds
      reconnectDelay: 5000,
      maxReconnectAttempts: -1, // infinite retries
      useHttps: false,
      ...config
    };
    this.controllerId = config.controllerId || this.generateControllerId();
  }

  public async connect(): Promise<void> {
    if (this.isConnected) {
      logger.info('WebSocket Admin client already connected');
      return;
    }

    try {
      // Collect controller information
      this.controllerInfo = await this.collectControllerInfo();
      
      // Setup WebSocket connection
      await this.setupWebSocketConnection();
      
    } catch (error) {
      logger.error('Failed to connect to WebSocket Admin server:', error);
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

    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    logger.info('WebSocket Admin client disconnected');
    this.emit('disconnected');
  }

  private async setupWebSocketConnection(): Promise<void> {
    const protocol = this.config.useHttps ? 'https' : 'http';
    const url = `${protocol}://${this.config.adminHost}:${this.config.adminPort}`;
    
    logger.info('Connecting to WebSocket Admin server', { 
      url, 
      controllerId: this.controllerId 
    });

    this.socket = io(url, {
      path: '/api/websocket',
      transports: ['websocket', 'polling'],
      timeout: 20000,
      reconnection: false, // We'll handle reconnection manually
      autoConnect: false
    });

    // Setup event handlers
    this.socket.on('connect', () => {
      logger.info('WebSocket connected to admin server');
      this.onWebSocketConnected();
    });

    this.socket.on('disconnect', (reason) => {
      logger.info('WebSocket disconnected from admin server', { reason });
      this.handleDisconnection();
    });

    this.socket.on('connect_error', (error) => {
      logger.error('WebSocket connection error:', error);
      this.handleDisconnection();
    });

    this.socket.on('admin-message', (message: AdminMessage) => {
      this.handleAdminMessage(message);
    });

    this.socket.on('connected', (data) => {
      logger.debug('Received connection acknowledgment', data);
    });

    this.socket.on('pong', () => {
      logger.debug('Received pong from server');
    });

    // Connect
    this.socket.connect();
  }

  private async onWebSocketConnected(): Promise<void> {
    this.isConnected = true;
    this.reconnectAttempts = 0;
    
    // Send initial registration
    await this.sendRegistrationMessage();
    
    // Start periodic heartbeats after registration
    this.startPeriodicHeartbeats();
    
    logger.info('WebSocket Admin client established connection');
    this.emit('connected');
  }

  private async sendRegistrationMessage(): Promise<void> {
    if (!this.controllerInfo || !this.socket) {
      throw new Error('Controller info or socket not available');
    }

    const registrationMessage: WebSocketMessage = {
      type: 'registration',
      controller_id: this.controllerId,
      timestamp: new Date().toISOString(),
      payload: {
        hostname: this.controllerInfo.hostname,
        mac_address: this.controllerInfo.macAddress,
        local_network: this.controllerInfo.localNetwork,
        version: this.controllerInfo.version,
        location: this.controllerInfo.location,
        site_id: this.controllerInfo.siteId,
        mdns_service: '_displayops._tcp.local',
        web_admin_url: process.env.CONTROLLER_WEB_ADMIN_URL || 'http://localhost:3001',
        system_info: await this.getSystemInfo()
      }
    };

    this.socket.emit('controller-message', registrationMessage);
    logger.info('Registration message sent', { controllerId: this.controllerId });
  }

  private async sendStatusHeartbeat(): Promise<void> {
    if (!this.isRegistered || !this.socket) {
      return;
    }

    try {
      const statusMessage: WebSocketMessage = {
        type: 'status_update',
        controller_id: this.controllerId,
        timestamp: new Date().toISOString(),
        payload: {
          status: 'online',
          metrics: await this.getSystemMetrics(),
          services: await this.getServiceStatuses()
        }
      };

      this.socket.emit('controller-message', statusMessage);
      logger.debug('Status heartbeat sent', { controllerId: this.controllerId });
    } catch (error) {
      logger.error('Failed to send status heartbeat:', error);
    }
  }

  private handleAdminMessage(message: AdminMessage): void {
    logger.debug('Received admin message', { 
      type: message.type,
      controllerId: message.controller_id 
    });

    switch (message.type) {
      case 'registration_success':
        this.handleRegistrationSuccess(message);
        break;
        
      case 'registration_error':
        this.handleRegistrationError(message);
        break;
        
      case 'status_acknowledged':
        // Status was acknowledged, nothing special to do
        break;
        
      case 'dashboard_sync':
        this.handleDashboardSync(message);
        break;
        
      case 'cookie_sync':
        this.handleCookieSync(message);
        break;
        
      case 'error':
        this.handleErrorMessage(message);
        break;
        
      default:
        logger.warn('Unknown admin message type', { type: message.type });
    }
  }

  private handleRegistrationSuccess(message: AdminMessage): void {
    const payload = message.payload;
    logger.info('Controller registration successful', {
      controllerId: this.controllerId,
      assignedId: payload.assigned_controller_id,
      siteId: payload.assigned_site_id,
      message: payload.message
    });

    this.isRegistered = true;
    this.emit('registered', {
      controllerId: payload.assigned_controller_id || this.controllerId,
      siteId: payload.assigned_site_id,
      message: payload.message
    });
  }

  private handleRegistrationError(message: AdminMessage): void {
    const payload = message.payload;
    const errorMessage = payload.message || 'Registration failed';
    
    logger.error('Controller registration failed', { 
      controllerId: this.controllerId,
      message: errorMessage 
    });
    
    this.emit('registration_error', { controllerId: this.controllerId, message: errorMessage });
  }

  private handleErrorMessage(message: AdminMessage): void {
    const payload = message.payload;
    logger.error('Admin error message', {
      errorCode: payload.error_code,
      message: payload.error_message,
      retrySuggested: payload.retry_suggested
    });
    
    this.emit('error', payload);
  }

  private async handleDashboardSync(message: AdminMessage): Promise<void> {
    const payload = message.payload;
    logger.info('Processing dashboard sync command', {
      dashboardsCount: payload.dashboards?.length || 0,
      syncType: payload.sync_type,
      syncTimestamp: payload.sync_timestamp
    });

    let success = false;
    let errorMessage = '';

    try {
      // Convert dashboards from WebSocket format to local format
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

      success = true;
      logger.info('Dashboard sync completed successfully', {
        dashboardsCount: dashboards.length
      });

    } catch (error) {
      errorMessage = error instanceof Error ? error.message : 'Dashboard sync failed';
      logger.error('Failed to handle dashboard sync:', error);
    }

    // Send response back to admin
    await this.sendCommandResponse(payload.command_id, success, errorMessage);
  }

  private async handleCookieSync(message: AdminMessage): Promise<void> {
    const payload = message.payload;
    logger.info('Processing cookie sync command', {
      domainsCount: payload.cookie_domains?.length || 0,
      syncType: payload.sync_type,
      syncTimestamp: payload.sync_timestamp
    });

    let success = false;
    let errorMessage = '';

    try {
      // Convert cookie domains from WebSocket format to local format
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

      success = true;
      logger.info('Cookie sync completed successfully', {
        domainsCount: Object.keys(cookiesData.domains).length,
        totalCookies: Object.values(cookiesData.domains).reduce((sum: number, domain: any) => sum + domain.cookies.length, 0)
      });

    } catch (error) {
      errorMessage = error instanceof Error ? error.message : 'Cookie sync failed';
      logger.error('Failed to handle cookie sync:', error);
    }

    // Send response back to admin
    await this.sendCommandResponse(payload.command_id, success, errorMessage);
  }

  private async sendCommandResponse(commandId: string, success: boolean, errorMessage?: string): Promise<void> {
    if (!this.socket) {
      logger.warn('Cannot send command response - socket not connected');
      return;
    }

    const responseMessage: WebSocketMessage = {
      type: 'command_response',
      controller_id: this.controllerId,
      timestamp: new Date().toISOString(),
      payload: {
        command_id: commandId,
        success,
        error_message: errorMessage || ''
      }
    };

    try {
      this.socket.emit('controller-message', responseMessage);
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

    // Also send ping periodically for keepalive
    setInterval(() => {
      if (this.socket && this.socket.connected) {
        this.socket.emit('ping');
      }
    }, 25000); // Every 25 seconds
  }

  private handleDisconnection(): void {
    if (!this.isConnected && !this.socket) {
      return; // Already handling disconnection
    }

    this.isConnected = false;
    this.isRegistered = false;
    this.socket = null;

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
    
    logger.info(`Scheduling WebSocket reconnection attempt ${this.reconnectAttempts} in ${delay}ms`);
    
    this.reconnectTimeout = setTimeout(() => {
      this.connect().catch(error => {
        logger.error('WebSocket reconnection attempt failed:', error);
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

  public get reconnectAttemptsCount(): number {
    return this.reconnectAttempts;
  }
}