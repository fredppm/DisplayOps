import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { join } from 'path';
import { EventEmitter } from 'events';
import os from 'os';
// Using proto-loader runtime types (no static TypeScript types)
import { logger } from './logger';

// Load protobuf definition
const PROTO_PATH = join(process.cwd(), '..', 'shared', 'proto', 'controller-admin.proto');

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
    if (!this.isConnected && !this.heartbeatStream) {
      return; // Already handling disconnection
    }

    this.isConnected = false;
    this.isRegistered = false;
    this.heartbeatStream = null;

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
      this.setupClient(); // Create new client
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
      location: process.env.CONTROLLER_LOCATION || `${os.hostname()} - Auto-discovered`,
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
    const timestamp = Date.now().toString(36);
    return `ctrl-${hostname}-${timestamp}`;
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