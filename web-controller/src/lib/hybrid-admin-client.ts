import { EventEmitter } from 'events';
import { WebSocketAdminClient, WebSocketAdminClientConfig } from './websocket-admin-client';
import { HttpAdminClient, HttpAdminClientConfig } from './http-admin-client';
import { logger } from '../utils/logger';

export interface HybridAdminClientConfig {
  adminHost: string;
  adminPort: number;
  controllerId?: string;
  heartbeatInterval?: number;
  useHttps?: boolean;
  preferWebSocket?: boolean; // true = try WebSocket first, false = HTTP first
  websocketTimeout?: number; // How long to wait for WebSocket before falling back
  fallbackDelay?: number; // Delay before attempting fallback
}

type ConnectionMode = 'websocket' | 'http' | 'none';

export class HybridAdminClient extends EventEmitter {
  private config: HybridAdminClientConfig;
  private webSocketClient: WebSocketAdminClient | null = null;
  private httpClient: HttpAdminClient | null = null;
  private currentMode: ConnectionMode = 'none';
  private isConnected: boolean = false;
  private isRegistered: boolean = false;
  private fallbackTimeout: NodeJS.Timeout | null = null;
  private connectionAttempts: number = 0;
  private maxConnectionAttempts: number = 5;
  private isInFallback: boolean = false; // Prevent recursive fallback calls
  private webSocketDisabled: boolean = false; // Disable WebSocket after failure
  private httpDisabled: boolean = false; // Disable HTTP after failure

  constructor(config: HybridAdminClientConfig) {
    super();
    this.config = {
      heartbeatInterval: 30000,
      useHttps: false,
      preferWebSocket: true,
      websocketTimeout: 10000, // 10 seconds
      fallbackDelay: 2000, // 2 seconds
      ...config
    };
    
    this.setupClients();
  }

  private setupClients(): void {
    // Setup WebSocket client
    const wsConfig: WebSocketAdminClientConfig = {
      adminHost: this.config.adminHost,
      adminPort: this.config.adminPort,
      controllerId: this.config.controllerId,
      heartbeatInterval: this.config.heartbeatInterval,
      maxReconnectAttempts: 0, // Disable WebSocket auto-reconnect in hybrid mode
      useHttps: this.config.useHttps
    };
    this.webSocketClient = new WebSocketAdminClient(wsConfig);
    
    // Setup HTTP client
    const httpConfig: HttpAdminClientConfig = {
      adminHost: this.config.adminHost,
      adminPort: this.config.adminPort,
      controllerId: this.config.controllerId,
      heartbeatInterval: this.config.heartbeatInterval,
      useHttps: this.config.useHttps
    };
    this.httpClient = new HttpAdminClient(httpConfig);
    
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    // WebSocket client events
    if (this.webSocketClient) {
      this.webSocketClient.on('connected', () => {
        if (this.currentMode === 'websocket') {
          logger.info('WebSocket connection established in hybrid mode');
          this.onConnectionEstablished('websocket');
        }
      });

      this.webSocketClient.on('registered', (data) => {
        if (this.currentMode === 'websocket') {
          logger.info('WebSocket registration successful in hybrid mode');
          this.onRegistrationSuccess('websocket', data);
        }
      });

      this.webSocketClient.on('disconnected', () => {
        if (this.currentMode === 'websocket') {
          logger.warn('WebSocket disconnected in hybrid mode, attempting HTTP fallback');
          this.handleWebSocketFailure();
        }
      });

      this.webSocketClient.on('registration_error', (error) => {
        if (this.currentMode === 'websocket') {
          logger.error('WebSocket registration failed in hybrid mode:', error);
          this.handleWebSocketFailure();
        }
      });

      // Forward WebSocket events
      this.webSocketClient.on('dashboard_sync', (data) => this.emit('dashboard_sync', data));
      this.webSocketClient.on('cookie_sync', (data) => this.emit('cookie_sync', data));
      this.webSocketClient.on('error', (error) => this.emit('error', error));
    }

    // HTTP client events
    if (this.httpClient) {
      this.httpClient.on('connected', () => {
        if (this.currentMode === 'http') {
          logger.info('HTTP connection established in hybrid mode');
          this.onConnectionEstablished('http');
        }
      });

      this.httpClient.on('registered', (data) => {
        if (this.currentMode === 'http') {
          logger.info('HTTP registration successful in hybrid mode');
          this.onRegistrationSuccess('http', data);
        }
      });

      this.httpClient.on('disconnected', () => {
        if (this.currentMode === 'http') {
          logger.warn('HTTP disconnected in hybrid mode');
          this.handleHttpFailure();
        }
      });

      // Forward HTTP events
      this.httpClient.on('dashboard_sync', (data) => this.emit('dashboard_sync', data));
      this.httpClient.on('cookie_sync', (data) => this.emit('cookie_sync', data));
      this.httpClient.on('error', (error) => this.emit('error', error));
    }
  }

  public async connect(): Promise<void> {
    if (this.isConnected) {
      logger.info('Hybrid Admin client already connected');
      return;
    }

    this.connectionAttempts++;
    logger.info(`Hybrid Admin client connection attempt ${this.connectionAttempts}`, {
      preferWebSocket: this.config.preferWebSocket
    });

    try {
      if (this.config.preferWebSocket) {
        await this.tryWebSocketFirst();
      } else {
        await this.tryHttpFirst();
      }
    } catch (error) {
      logger.error('All connection methods failed in hybrid mode:', error);
      
      if (this.connectionAttempts < this.maxConnectionAttempts) {
        logger.info(`Retrying connection in ${this.config.fallbackDelay}ms (attempt ${this.connectionAttempts + 1}/${this.maxConnectionAttempts})`);
        setTimeout(() => {
          this.connect().catch(err => {
            logger.error('Retry connection failed:', err);
          });
        }, this.config.fallbackDelay);
      } else {
        logger.error('Max connection attempts reached, giving up');
        this.emit('connection_failed');
      }
      
      throw error;
    }
  }

  private async tryWebSocketFirst(): Promise<void> {
    logger.info('Attempting WebSocket connection first');
    this.currentMode = 'websocket';
    
    try {
      // Set up fallback timeout
      const fallbackPromise = new Promise<void>((_, reject) => {
        this.fallbackTimeout = setTimeout(() => {
          reject(new Error('WebSocket connection timeout'));
        }, this.config.websocketTimeout);
      });

      // Race between WebSocket connection and timeout
      await Promise.race([
        this.webSocketClient!.connect(),
        fallbackPromise
      ]);

      // If we get here, WebSocket connected successfully
      if (this.fallbackTimeout) {
        clearTimeout(this.fallbackTimeout);
        this.fallbackTimeout = null;
      }

    } catch (error) {
      logger.warn('WebSocket connection failed, falling back to HTTP:', error);
      await this.fallbackToHttp();
    }
  }

  private async tryHttpFirst(): Promise<void> {
    logger.info('Attempting HTTP connection first');
    this.currentMode = 'http';
    
    try {
      await this.httpClient!.connect();
    } catch (error) {
      logger.warn('HTTP connection failed, falling back to WebSocket:', error);
      await this.fallbackToWebSocket();
    }
  }

  private async fallbackToHttp(): Promise<void> {
    // Clean up WebSocket
    if (this.webSocketClient) {
      this.webSocketClient.disconnect();
    }
    
    // Clear any pending timeouts
    if (this.fallbackTimeout) {
      clearTimeout(this.fallbackTimeout);
      this.fallbackTimeout = null;
    }

    // Wait before attempting fallback
    await new Promise(resolve => setTimeout(resolve, this.config.fallbackDelay));
    
    logger.info('Falling back to HTTP connection');
    this.currentMode = 'http';
    
    try {
      await this.httpClient!.connect();
    } catch (error) {
      this.currentMode = 'none';
      throw new Error('Both WebSocket and HTTP connections failed');
    }
  }

  private async fallbackToWebSocket(): Promise<void> {
    // Clean up HTTP
    if (this.httpClient) {
      this.httpClient.disconnect();
    }

    // Wait before attempting fallback
    await new Promise(resolve => setTimeout(resolve, this.config.fallbackDelay));
    
    logger.info('Falling back to WebSocket connection');
    this.currentMode = 'websocket';
    
    try {
      await this.webSocketClient!.connect();
    } catch (error) {
      this.currentMode = 'none';
      throw new Error('Both HTTP and WebSocket connections failed');
    }
  }

  private handleWebSocketFailure(): void {
    if (this.currentMode !== 'websocket' || this.isInFallback) {
      return; // Not our current mode or already in fallback, ignore
    }

    // Disable WebSocket after first failure to prevent infinite loops
    this.webSocketDisabled = true;
    logger.warn('WebSocket failed permanently, disabling WebSocket and switching to HTTP mode');
    
    this.isInFallback = true;
    
    // Schedule fallback after a delay
    this.fallbackTimeout = setTimeout(() => {
      if (!this.httpDisabled) {
        this.fallbackToHttp().catch(error => {
          logger.error('Failed to fallback to HTTP:', error);
          this.currentMode = 'none';
          this.isConnected = false;
          this.isRegistered = false;
          this.emit('disconnected');
        }).finally(() => {
          this.isInFallback = false;
          this.fallbackTimeout = null;
        });
      } else {
        logger.error('Both WebSocket and HTTP are disabled, connection failed');
        this.currentMode = 'none';
        this.isConnected = false;
        this.isRegistered = false;
        this.emit('disconnected');
        this.isInFallback = false;
        this.fallbackTimeout = null;
      }
    }, this.config.fallbackDelay || 2000);
  }

  private handleHttpFailure(): void {
    if (this.currentMode !== 'http' || this.isInFallback) {
      return; // Not our current mode or already in fallback, ignore
    }

    // Disable HTTP after first failure to prevent infinite loops
    this.httpDisabled = true;
    logger.warn('HTTP failed permanently, disabling HTTP and attempting WebSocket mode');
    
    this.isInFallback = true;
    
    // Schedule fallback after a delay
    this.fallbackTimeout = setTimeout(() => {
      if (!this.webSocketDisabled) {
        this.fallbackToWebSocket().catch(error => {
          logger.error('Failed to fallback to WebSocket:', error);
          this.currentMode = 'none';
          this.isConnected = false;
          this.isRegistered = false;
          this.emit('disconnected');
        }).finally(() => {
          this.isInFallback = false;
          this.fallbackTimeout = null;
        });
      } else {
        logger.error('Both WebSocket and HTTP are disabled, connection failed');
        this.currentMode = 'none';
        this.isConnected = false;
        this.isRegistered = false;
        this.emit('disconnected');
        this.isInFallback = false;
        this.fallbackTimeout = null;
      }
    }, this.config.fallbackDelay || 2000);
  }

  private onConnectionEstablished(mode: ConnectionMode): void {
    logger.info(`Connection established via ${mode} in hybrid mode`);
    this.isConnected = true;
    this.connectionAttempts = 0; // Reset attempts on successful connection
    
    // Cancel any pending fallback timeouts
    if (this.fallbackTimeout) {
      clearTimeout(this.fallbackTimeout);
      this.fallbackTimeout = null;
    }
    
    this.emit('connected', { mode });
  }

  private onRegistrationSuccess(mode: ConnectionMode, data: any): void {
    logger.info(`Registration successful via ${mode} in hybrid mode`);
    this.isRegistered = true;
    this.emit('registered', { ...data, mode });
  }

  public disconnect(): void {
    logger.info('Disconnecting hybrid admin client');
    
    this.isConnected = false;
    this.isRegistered = false;
    this.currentMode = 'none';
    this.isInFallback = false;
    
    if (this.fallbackTimeout) {
      clearTimeout(this.fallbackTimeout);
      this.fallbackTimeout = null;
    }

    if (this.webSocketClient) {
      this.webSocketClient.disconnect();
    }

    if (this.httpClient) {
      this.httpClient.disconnect();
    }

    logger.info('Hybrid Admin client disconnected');
    this.emit('disconnected');
  }

  // Public getters
  public get connected(): boolean {
    return this.isConnected;
  }

  public get registered(): boolean {
    return this.isRegistered;
  }

  public get connectionMode(): ConnectionMode {
    return this.currentMode;
  }

  public get id(): string {
    // Both clients should have the same ID
    return this.webSocketClient?.id || this.httpClient?.id || 'unknown';
  }

  public get reconnectAttemptsCount(): number {
    // Return attempts from the active client
    if (this.currentMode === 'websocket') {
      return this.webSocketClient?.reconnectAttemptsCount || 0;
    } else if (this.currentMode === 'http') {
      return 0; // HTTP client doesn't track reconnect attempts the same way
    }
    return 0;
  }

  // Utility methods for external monitoring
  public getConnectionInfo(): {
    mode: ConnectionMode;
    connected: boolean;
    registered: boolean;
    attempts: number;
  } {
    return {
      mode: this.currentMode,
      connected: this.isConnected,
      registered: this.isRegistered,
      attempts: this.connectionAttempts
    };
  }

  public forceMode(mode: 'websocket' | 'http'): Promise<void> {
    logger.info(`Forcing connection mode to ${mode}`);
    
    // Disconnect current connection
    if (this.isConnected) {
      this.disconnect();
    }

    // Set preference and reconnect
    this.config.preferWebSocket = (mode === 'websocket');
    
    return this.connect();
  }
}