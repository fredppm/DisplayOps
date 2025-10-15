import { EventEmitter } from 'events';
import { ConfigManager } from '../managers/config-manager';
import { StateManager } from './state-manager';
import { logger } from '../utils/logger';
import os from 'os';

export interface HostRegistrationData {
  agentId: string;
  hostname: string;
  ipAddress: string;
  grpcPort: number;
  displays: Array<{
    id: string;
    name: string;
    width: number;
    height: number;
    isPrimary: boolean;
  }>;
  systemInfo: {
    platform: string;
    arch: string;
    nodeVersion: string;
    electronVersion: string;
    totalMemoryGB: number;
    cpuCores: number;
    cpuModel: string;
    uptime: number;
  };
  version: string;
  status: 'online' | 'offline';
}

export class DirectConnectionService extends EventEmitter {
  private configManager: ConfigManager;
  private stateManager: StateManager;
  private webAdminUrl: string;
  private isRegistered: boolean = false;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private heartbeatIntervalMs: number = 30000; // 30 seconds

  constructor(configManager: ConfigManager, stateManager: StateManager) {
    super();
    this.configManager = configManager;
    this.stateManager = stateManager;
    
    const configUrl = this.configManager.getSettings().webAdminUrl;
    this.webAdminUrl = configUrl || process.env.WEB_ADMIN_URL || process.env.DISPLAYOPS_WEB_ADMIN_URL || 'https://displayops.vtex.com';
    
    logger.info('🏗️ DirectConnectionService initialized', {
      configUrl: configUrl || '(empty)',
      finalUrl: this.webAdminUrl
    });
  }

  public async start(): Promise<void> {
    logger.info('🚀 Starting direct connection to Web-Admin', {
      webAdminUrl: this.webAdminUrl
    });

    try {
      await this.register();
      this.startHeartbeat();
      this.isRegistered = true;
      
      logger.success('✅ Direct connection established successfully');
      this.emit('connected');
    } catch (error) {
      logger.error('❌ Failed to establish direct connection:', error);
      this.scheduleReconnect();
      throw error;
    }
  }

  public async stop(): Promise<void> {
    logger.info('🛑 Stopping direct connection');
    
    this.isRegistered = false;
    
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    // Send offline status
    try {
      await this.sendHeartbeat(true); // offline
    } catch (error) {
      logger.debug('Failed to send offline status:', error);
    }

    this.emit('disconnected');
  }

  private async register(): Promise<void> {
    const config = this.configManager.getConfig();
    const systemInfo = this.configManager.getSystemInfo();
    const displayStates = this.stateManager.getAllDisplayStates();

    const registrationData: HostRegistrationData = {
      agentId: config.agentId,
      hostname: config.hostname,
      ipAddress: this.getLocalIPAddress(),
      grpcPort: 8082,
      displays: config.displays.map(display => ({
        id: display.id,
        name: display.name,
        width: display.bounds?.width || 1920,
        height: display.bounds?.height || 1080,
        isPrimary: display.monitorIndex === 0
      })),
      systemInfo: {
        platform: systemInfo.platform,
        arch: systemInfo.arch,
        nodeVersion: systemInfo.nodeVersion,
        electronVersion: systemInfo.electronVersion || 'unknown',
        totalMemoryGB: Math.round(os.totalmem() / 1024 / 1024 / 1024),
        cpuCores: os.cpus().length,
        cpuModel: os.cpus()[0]?.model || 'Unknown',
        uptime: Math.floor(systemInfo.uptime / 60)
      },
      version: config.version,
      status: 'online'
    };

    logger.info('📝 Registering host with Web-Admin', {
      agentId: registrationData.agentId,
      hostname: registrationData.hostname,
      ipAddress: registrationData.ipAddress
    });

    const response = await fetch(`${this.webAdminUrl}/api/hosts/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(registrationData)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Registration failed: ${errorData.message || response.statusText}`);
    }

    const result = await response.json();
    logger.success('✅ Host registration successful', {
      hostId: result.assignedHostId,
      message: result.message
    });
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(async () => {
      try {
        await this.sendHeartbeat();
      } catch (error) {
        logger.error('❌ Heartbeat failed:', error);
        this.handleConnectionError();
      }
    }, this.heartbeatIntervalMs);
  }

  private async sendHeartbeat(isOffline: boolean = false): Promise<void> {
    if (!this.isRegistered) return;

    const config = this.configManager.getConfig();
    const displayStates = this.stateManager.getAllDisplayStates();

    const heartbeatData = {
      agentId: config.agentId,
      status: isOffline ? 'offline' : 'online',
      lastSeen: new Date().toISOString(),
      displays: config.displays.map(display => {
        const displayState = displayStates[display.id];
        return {
          id: display.id,
          name: display.name,
          width: display.bounds?.width || 1920,
          height: display.bounds?.height || 1080,
          isPrimary: display.monitorIndex === 0,
          assignedDashboard: displayState?.assignedDashboard || null,
          isActive: displayState?.isActive || false
        };
      })
    };

    const response = await fetch(`${this.webAdminUrl}/api/hosts/heartbeat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(heartbeatData)
    });

    if (!response.ok) {
      throw new Error(`Heartbeat failed: ${response.statusText}`);
    }
  }

  private handleConnectionError(): void {
    this.isRegistered = false;
    this.scheduleReconnect();
    this.emit('connection-error');
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error('❌ Max reconnection attempts reached');
      this.emit('max-reconnect-attempts-reached');
      return;
    }

    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000); // Exponential backoff, max 30s
    this.reconnectAttempts++;

    logger.info('🔄 Scheduling reconnection', {
      attempt: this.reconnectAttempts,
      delayMs: delay
    });

    this.reconnectTimeout = setTimeout(async () => {
      try {
        await this.start();
        this.reconnectAttempts = 0; // Reset on success
      } catch (error) {
        logger.error('❌ Reconnection attempt failed:', error);
        this.handleConnectionError();
      }
    }, delay);
  }

  private getLocalIPAddress(): string {
    const interfaces = os.networkInterfaces();
    
    for (const interfaceName in interfaces) {
      const networkInterface = interfaces[interfaceName];
      if (networkInterface) {
        for (const net of networkInterface) {
          // Skip internal and non-IPv4 addresses
          if (!net.internal && net.family === 'IPv4') {
            return net.address;
          }
        }
      }
    }
    
    return '127.0.0.1'; // Fallback
  }

  public async forceUpdate(): Promise<void> {
    if (this.isRegistered) {
      await this.sendHeartbeat();
    }
  }

  public isConnected(): boolean {
    return this.isRegistered;
  }
}


