import { EventEmitter } from 'events';
import { ConfigManager } from '../managers/config-manager';
import { StateManager } from './state-manager';
import { logger } from '../utils/logger';
import os from 'os';

/**
 * Registry Service
 * 
 * Registers and maintains connection with Web-Admin
 * Replaces mDNS discovery with direct HTTP communication
 */
export class RegistryService extends EventEmitter {
  private configManager: ConfigManager;
  private stateManager: StateManager;
  private webAdminUrl: string;
  private isRegistered: boolean = false;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;
  private heartbeatIntervalMs: number = 30000; // 30 seconds

  constructor(configManager: ConfigManager, stateManager: StateManager) {
    super();
    this.configManager = configManager;
    this.stateManager = stateManager;
    this.webAdminUrl = this.configManager.getSettings().webAdminUrl || 'http://localhost:3000';
    
    logger.debug('🏗️ RegistryService instance created', {
      webAdminUrl: this.webAdminUrl
    });
  }

  public async start(): Promise<void> {
    // Prevent multiple registration attempts
    if (this.isRegistered) {
      logger.debug('Already registered with Web-Admin, skipping');
      return;
    }

    logger.info('🌐 Connecting to Web-Admin', { url: this.webAdminUrl });

    try {
      await this.register();
      this.startHeartbeat();
      this.isRegistered = true;
      
      logger.success('✅ Registered with Web-Admin');
      this.emit('connected');
    } catch (error) {
      logger.warn('⚠️ Failed to connect to Web-Admin (will retry)', { 
        error: error instanceof Error ? error.message : String(error)
      });
      this.scheduleReconnect();
      // Don't throw - allow app to continue
    }
  }

  public async stop(): Promise<void> {
    logger.info('🛑 Disconnecting from Web-Admin');
    
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
      await this.sendHeartbeat(true);
    } catch (error) {
      logger.debug('Could not send offline status:', error);
    }

    this.emit('disconnected');
  }

  private async register(): Promise<void> {
    const config = this.configManager.getConfig();

    const registrationData = {
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
        platform: os.platform(),
        arch: os.arch(),
        nodeVersion: process.version,
        electronVersion: process.versions.electron || 'unknown',
        totalMemoryGB: Math.round(os.totalmem() / 1024 / 1024 / 1024),
        cpuCores: os.cpus().length,
        cpuModel: os.cpus()[0]?.model || 'Unknown',
        uptime: Math.floor(process.uptime() / 60)
      },
      version: config.version,
      status: 'online'
    };

    logger.debug('📝 Registering with Web-Admin', {
      agentId: registrationData.agentId,
      hostname: registrationData.hostname,
      ipAddress: registrationData.ipAddress
    });

    const response = await fetch(`${this.webAdminUrl}/api/hosts/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(registrationData)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(`Registration failed: ${errorData.message || response.statusText}`);
    }

    const result = await response.json();
    logger.success('✅ Registration successful', {
      hostId: result.assignedHostId,
      message: result.message
    });
  }

  private startHeartbeat(): void {
    // Clear any existing interval first
    if (this.heartbeatInterval) {
      logger.debug('Clearing existing heartbeat interval');
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    // Send initial heartbeat
    this.sendHeartbeat().catch(err => {
      logger.error('Initial heartbeat failed:', err);
    });

    // Schedule periodic heartbeats
    this.heartbeatInterval = setInterval(async () => {
      try {
        await this.sendHeartbeat();
      } catch (error) {
        logger.error('💔 Heartbeat failed:', error);
        this.handleConnectionError();
      }
    }, this.heartbeatIntervalMs);
    
    logger.debug('💓 Heartbeat started', { 
      intervalSeconds: this.heartbeatIntervalMs / 1000 
    });
  }

  private lastHeartbeatTime: number = 0;

  private async sendHeartbeat(isOffline: boolean = false): Promise<void> {
    if (!this.isRegistered && !isOffline) return;

    // Prevent duplicate heartbeats (spam protection)
    const now = Date.now();
    const timeSinceLastHeartbeat = now - this.lastHeartbeatTime;
    
    if (timeSinceLastHeartbeat < 10000 && !isOffline) { // Less than 10 seconds
      logger.warn('⚠️ Heartbeat spam detected! Skipping duplicate', {
        timeSinceLastMs: timeSinceLastHeartbeat,
        expectedMs: this.heartbeatIntervalMs
      });
      return;
    }
    
    this.lastHeartbeatTime = now;

    const config = this.configManager.getConfig();
    const displayStates = this.stateManager.getAllDisplayStates();

    // Calculate metrics
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memoryUsagePercent = Math.round((usedMem / totalMem) * 100 * 10) / 10;

    // CPU usage calculation (average over all cores)
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;
    cpus.forEach(cpu => {
      for (const type in cpu.times) {
        totalTick += cpu.times[type as keyof typeof cpu.times];
      }
      totalIdle += cpu.times.idle;
    });
    const cpuUsagePercent = Math.round((1 - totalIdle / totalTick) * 100 * 10) / 10;

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
      }),
      systemInfo: {
        platform: os.platform(),
        arch: os.arch(),
        nodeVersion: process.version,
        electronVersion: process.versions.electron || 'N/A',
        totalMemoryGB: Math.round(os.totalmem() / (1024 * 1024 * 1024) * 10) / 10,
        cpuCores: os.cpus().length,
        cpuModel: os.cpus()[0]?.model || 'Unknown',
        uptime: Math.floor(os.uptime())
      },
      metrics: {
        cpuUsagePercent: cpuUsagePercent,
        memoryUsagePercent: memoryUsagePercent,
        memoryUsedGB: Math.round(usedMem / (1024 * 1024 * 1024) * 10) / 10,
        memoryTotalGB: Math.round(totalMem / (1024 * 1024 * 1024) * 10) / 10
      }
    };

    const response = await fetch(`${this.webAdminUrl}/api/hosts/heartbeat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(heartbeatData)
    });

    if (!response.ok) {
      throw new Error(`Heartbeat failed: ${response.statusText}`);
    }

    logger.debug('💓 Heartbeat sent');
  }

  private handleConnectionError(): void {
    // Stop heartbeat
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    
    this.isRegistered = false;
    this.scheduleReconnect();
    this.emit('connection-error');
  }

  private scheduleReconnect(): void {
    // Clear any existing reconnect timeout
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error('❌ Max reconnection attempts reached', {
        maxAttempts: this.maxReconnectAttempts
      });
      this.emit('max-reconnect-attempts');
      return;
    }

    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 60000); // Max 60s
    this.reconnectAttempts++;

    logger.info('🔄 Scheduling reconnection', {
      attempt: this.reconnectAttempts,
      maxAttempts: this.maxReconnectAttempts,
      delaySeconds: Math.round(delay / 1000)
    });

    this.reconnectTimeout = setTimeout(async () => {
      this.reconnectTimeout = null;
      
      try {
        await this.register();
        this.startHeartbeat();
        this.isRegistered = true;
        this.reconnectAttempts = 0; // Reset on success
        
        logger.success('✅ Reconnected to Web-Admin');
        this.emit('connected');
      } catch (error) {
        logger.error('❌ Reconnection attempt failed:', error);
        this.scheduleReconnect();
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
    
    return '127.0.0.1';
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

