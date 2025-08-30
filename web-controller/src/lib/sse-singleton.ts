import { MiniPC } from '@/types/shared-types';

export interface HostDiscoveryUpdate {
  success: boolean;
  data: MiniPC[];
  timestamp: Date;
  changeType?: string;
  changedHost?: MiniPC;
}

type EventHandler = (update: HostDiscoveryUpdate) => void;

class SSESingleton {
  private static instance: SSESingleton | null = null;
  private eventSource: EventSource | null = null;
  private handlers: Set<EventHandler> = new Set();
  private isConnected: boolean = false;
  private lastUpdate: Date | null = null;
  private currentHosts: MiniPC[] = [];

  private constructor() {}

  public static getInstance(): SSESingleton {
    if (!SSESingleton.instance) {
      SSESingleton.instance = new SSESingleton();
    }
    return SSESingleton.instance;
  }

  public connect(): Promise<boolean> {
    if (this.eventSource && this.eventSource.readyState !== EventSource.CLOSED) {
      console.log('🔄 SSE already connected or connecting, readyState:', this.eventSource.readyState);
      return Promise.resolve(this.isConnected);
    }

    return new Promise((resolve) => {
      console.log('🔌 SSE Singleton connecting to /api/discovery/events...');
      console.log('🌐 Base URL:', window.location.origin);
      
      this.eventSource = new EventSource('/api/discovery/events');

      this.eventSource.onopen = () => {
        console.log('✅ SSE Singleton connected');
        this.isConnected = true;
        resolve(true);
      };

      this.eventSource.onerror = (error) => {
        console.error('❌ SSE Singleton error:', error);
        this.isConnected = false;
        resolve(false);
      };

      this.eventSource.addEventListener('hosts_update', (event) => {
        console.log('📡 SSE Singleton received hosts_update:', event.data);
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
      });

      // Timeout after 10 seconds
      setTimeout(() => {
        if (!this.isConnected) {
          console.error('❌ SSE Singleton connection timeout');
          resolve(false);
        }
      }, 10000);
    });
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

  public disconnect(): void {
    if (this.eventSource) {
      console.log('🔌 SSE Singleton disconnecting');
      this.eventSource.close();
      this.eventSource = null;
      this.isConnected = false;
    }
  }

  public getStatus() {
    return {
      isConnected: this.isConnected,
      lastUpdate: this.lastUpdate,
      hostsCount: this.currentHosts.length
    };
  }
}

export const sseService = SSESingleton.getInstance();


