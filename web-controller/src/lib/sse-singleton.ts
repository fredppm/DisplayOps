import { MiniPC } from '@/types/shared-types';

export interface HostDiscoveryUpdate {
  success: boolean;
  data: MiniPC[];
  timestamp: Date;
  changeType?: string;
  changedHost?: MiniPC;
}

type EventHandler = (update: HostDiscoveryUpdate) => void;

// SSE Connection configuration
const SSE_CONFIG = {
  INITIAL_RECONNECT_DELAY: 1000,  // Start with 1s
  MAX_RECONNECT_DELAY: 30000,     // Max 30s between attempts
  RECONNECT_MULTIPLIER: 2,        // Double delay each attempt
  MAX_RECONNECT_ATTEMPTS: 10,     // Stop after 10 failed attempts
  HEARTBEAT_TIMEOUT: 45000,       // 45s without heartbeat = disconnected
  CONNECTION_TIMEOUT: 10000       // 10s connection timeout
};

enum ConnectionState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  RECONNECTING = 'reconnecting',
  FAILED = 'failed'
}

class SSESingleton {
  private static instance: SSESingleton | null = null;
  private eventSource: EventSource | null = null;
  private handlers: Set<EventHandler> = new Set();
  private connectionState: ConnectionState = ConnectionState.DISCONNECTED;
  private lastUpdate: Date | null = null;
  private currentHosts: MiniPC[] = [];
  private reconnectAttempts: number = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private lastHeartbeat: Date | null = null;

  private constructor() {}

  public static getInstance(): SSESingleton {
    if (!SSESingleton.instance) {
      SSESingleton.instance = new SSESingleton();
    }
    return SSESingleton.instance;
  }

  public connect(): Promise<boolean> {
    if (this.connectionState === ConnectionState.CONNECTING || 
        this.connectionState === ConnectionState.CONNECTED) {
      console.log('🔄 SSE already connected or connecting, state:', this.connectionState);
      return Promise.resolve(this.connectionState === ConnectionState.CONNECTED);
    }

    // Add beforeunload listener if not already added
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', this.handleBeforeUnload.bind(this));
    }

    return this.doConnect();
  }

  private doConnect(): Promise<boolean> {
    return new Promise((resolve) => {
      console.log('🔌 SSE Singleton connecting to /api/discovery/events...');
      console.log('🌐 Base URL:', window.location.origin);
      
      this.connectionState = ConnectionState.CONNECTING;
      this.clearTimers();
      
      // Close existing connection if any
      if (this.eventSource) {
        this.eventSource.close();
      }
      
      this.eventSource = new EventSource('/api/discovery/events');

      this.eventSource.onopen = () => {
        console.log('✅ SSE Singleton connected');
        this.connectionState = ConnectionState.CONNECTED;
        this.reconnectAttempts = 0;
        this.startHeartbeatMonitoring();
        resolve(true);
      };

      this.eventSource.onerror = (error) => {
        console.error('❌ SSE Singleton error:', error, 'ReadyState:', this.eventSource?.readyState);
        
        if (this.eventSource?.readyState === EventSource.CLOSED) {
          this.connectionState = ConnectionState.DISCONNECTED;
          this.scheduleReconnect();
        } else if (this.connectionState === ConnectionState.CONNECTING) {
          // Connection failed during initial connect
          this.connectionState = ConnectionState.DISCONNECTED;
          resolve(false);
        }
      };

      this.eventSource.addEventListener('hosts_update', (event) => {
        console.log('📡 SSE Singleton received hosts_update');
        this.lastHeartbeat = new Date(); // Data reception counts as heartbeat
        
        try {
          const update: HostDiscoveryUpdate = JSON.parse(event.data);
          this.currentHosts = update.data || [];
          this.lastUpdate = new Date(update.timestamp);
          
          // Notify all handlers
          this.handlers.forEach(handler => {
            try {
              handler(update);
            } catch (error) {
              console.error('❌ Error in SSE handler:', error);
            }
          });
        } catch (error) {
          console.error('❌ Error parsing SSE data:', error);
        }
      });

      this.eventSource.addEventListener('heartbeat', (event) => {
        console.log('💓 SSE Singleton heartbeat');
        this.lastHeartbeat = new Date();
      });

      // Connection timeout
      const timeoutId = setTimeout(() => {
        if (this.connectionState === ConnectionState.CONNECTING) {
          console.error('❌ SSE Singleton connection timeout');
          this.connectionState = ConnectionState.DISCONNECTED;
          this.eventSource?.close();
          resolve(false);
        }
      }, SSE_CONFIG.CONNECTION_TIMEOUT);
      
      // Clear timeout on successful connection
      this.eventSource.onopen = (originalOnOpen => {
        return () => {
          clearTimeout(timeoutId);
          if (originalOnOpen) originalOnOpen();
        };
      })(this.eventSource.onopen);
    });
  }
  
  private startHeartbeatMonitoring(): void {
    this.lastHeartbeat = new Date();
    
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }
    
    this.heartbeatTimer = setInterval(() => {
      const now = new Date();
      const timeSinceLastHeartbeat = now.getTime() - (this.lastHeartbeat?.getTime() || 0);
      
      if (timeSinceLastHeartbeat > SSE_CONFIG.HEARTBEAT_TIMEOUT) {
        console.error('💔 SSE heartbeat timeout, connection lost');
        this.connectionState = ConnectionState.DISCONNECTED;
        this.eventSource?.close();
        this.scheduleReconnect();
      }
    }, 5000); // Check every 5 seconds
  }
  
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= SSE_CONFIG.MAX_RECONNECT_ATTEMPTS) {
      console.error('❌ Max SSE reconnection attempts reached');
      this.connectionState = ConnectionState.FAILED;
      return;
    }
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    
    this.reconnectAttempts++;
    const delay = Math.min(
      SSE_CONFIG.INITIAL_RECONNECT_DELAY * Math.pow(SSE_CONFIG.RECONNECT_MULTIPLIER, this.reconnectAttempts - 1),
      SSE_CONFIG.MAX_RECONNECT_DELAY
    );
    
    console.log(`🔄 SSE Scheduling reconnection attempt ${this.reconnectAttempts}/${SSE_CONFIG.MAX_RECONNECT_ATTEMPTS} in ${delay}ms`);
    this.connectionState = ConnectionState.RECONNECTING;
    
    this.reconnectTimer = setTimeout(() => {
      this.doConnect().catch(error => {
        console.error('❌ SSE Reconnection failed:', error);
        this.scheduleReconnect();
      });
    }, delay);
  }
  
  private clearTimers(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  public addHandler(handler: EventHandler): void {
    this.handlers.add(handler);
    
    // If we already have data, send it immediately
    if (this.currentHosts.length > 0 && this.lastUpdate) {
      handler({
        success: true,
        data: this.currentHosts,
        timestamp: this.lastUpdate,
        changeType: 'cached_data'
      });
    }
  }

  public removeHandler(handler: EventHandler): void {
    this.handlers.delete(handler);
  }

  private handleBeforeUnload(): void {
    console.log('🔄 Page unloading, closing SSE connection');
    this.disconnect();
  }

  public disconnect(): void {
    console.log('🔌 SSE Singleton disconnecting');
    
    this.connectionState = ConnectionState.DISCONNECTED;
    this.clearTimers();
    
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }

    // Remove beforeunload listener
    if (typeof window !== 'undefined') {
      window.removeEventListener('beforeunload', this.handleBeforeUnload.bind(this));
    }
  }
  
  public forceReconnect(): Promise<boolean> {
    console.log('🔄 SSE Force reconnecting...');
    this.reconnectAttempts = 0;
    this.disconnect();
    return this.connect();
  }

  public getStatus() {
    return {
      connectionState: this.connectionState,
      isConnected: this.connectionState === ConnectionState.CONNECTED,
      reconnectAttempts: this.reconnectAttempts,
      lastUpdate: this.lastUpdate,
      lastHeartbeat: this.lastHeartbeat,
      hostsCount: this.currentHosts.length,
      readyState: this.eventSource?.readyState || EventSource.CLOSED
    };
  }
}

export const sseService = SSESingleton.getInstance();


