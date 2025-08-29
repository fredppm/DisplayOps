import { EventEmitter } from 'events';
import { ConfigManager } from '../managers/config-manager';

export interface DebugEvent {
  id: string;
  timestamp: Date;
  type: 'api_request' | 'api_response' | 'mdns_event' | 'window_event' | 'system_event' | 'error';
  category: string;
  message: string;
  data?: any;
  duration?: number;
}

export interface SystemMetrics {
  cpu: number;
  memory: number;
  uptime: number;
  activeWindows: number;
  apiRequestsPerMinute: number;
  mdnsStatus: 'active' | 'inactive' | 'error';
  displays: any[];
}

export class DebugService extends EventEmitter {
  private events: DebugEvent[] = [];
  private maxEvents: number = 100;
  private configManager: ConfigManager;
  private apiRequestCount: number = 0;
  private apiRequestTimes: number[] = [];
  private isEnabled: boolean = false;

  constructor(configManager: ConfigManager) {
    super();
    this.configManager = configManager;
  }

  public enable(): void {
    const wasEnabled = this.isEnabled;
    this.isEnabled = true;
    
    if (!wasEnabled) {
      console.log('🐛 Debug mode ENABLED (state synchronized)');
      this.logEvent('system_event', 'Debug Service', 'Debug mode enabled');
      this.emit('debug-state-changed', { enabled: true, source: 'api' });
    }
  }

  public disable(): void {
    const wasEnabled = this.isEnabled;
    this.isEnabled = false;
    
    if (wasEnabled) {
      console.log('🐛 Debug mode DISABLED (state synchronized)');
      this.logEvent('system_event', 'Debug Service', 'Debug mode disabled');
      this.emit('debug-state-changed', { enabled: false, source: 'api' });
    }
  }

  public enableFromHotkey(): void {
    const wasEnabled = this.isEnabled;
    this.isEnabled = true;
    
    if (!wasEnabled) {
      console.log('🐛 Debug mode ENABLED via hotkey (state synchronized)');
      this.logEvent('system_event', 'Debug Service', 'Debug mode enabled via hotkey');
      this.emit('debug-state-changed', { enabled: true, source: 'hotkey' });
    }
  }

  public disableFromHotkey(): void {
    const wasEnabled = this.isEnabled;
    this.isEnabled = false;
    
    if (wasEnabled) {
      console.log('🐛 Debug mode DISABLED via hotkey (state synchronized)');
      this.logEvent('system_event', 'Debug Service', 'Debug mode disabled via hotkey');
      this.emit('debug-state-changed', { enabled: false, source: 'hotkey' });
    }
  }

  public toggleFromHotkey(): boolean {
    if (this.isEnabled) {
      this.disableFromHotkey();
    } else {
      this.enableFromHotkey();
    }
    return this.isEnabled;
  }

  public isDebugEnabled(): boolean {
    return this.isEnabled;
  }

  public logApiRequest(endpoint: string, method: string, data?: any): string {
    if (!this.isEnabled) return '';

    const eventId = this.generateEventId();
    const event: DebugEvent = {
      id: eventId,
      timestamp: new Date(),
      type: 'api_request',
      category: 'API',
      message: `${method} ${endpoint}`,
      data: data ? { body: data } : undefined
    };

    this.addEvent(event);
    this.trackApiRequest();
    
    return eventId;
  }

  public logApiResponse(requestId: string, success: boolean, duration: number, data?: any): void {
    if (!this.isEnabled) return;

    const event: DebugEvent = {
      id: this.generateEventId(),
      timestamp: new Date(),
      type: 'api_response',
      category: 'API',
      message: `Response (${success ? 'SUCCESS' : 'ERROR'})`,
      data: data ? { response: data } : undefined,
      duration
    };

    this.addEvent(event);
  }

  public logMdnsEvent(event: string, data?: any): void {
    if (!this.isEnabled) return;

    const debugEvent: DebugEvent = {
      id: this.generateEventId(),
      timestamp: new Date(),
      type: 'mdns_event',
      category: 'mDNS',
      message: event,
      data
    };

    this.addEvent(debugEvent);
  }

  public logWindowEvent(windowId: string, event: string, data?: any): void {
    if (!this.isEnabled) return;

    const debugEvent: DebugEvent = {
      id: this.generateEventId(),
      timestamp: new Date(),
      type: 'window_event',
      category: 'Window',
      message: `${windowId}: ${event}`,
      data
    };

    this.addEvent(debugEvent);
  }

  public logError(category: string, error: Error | string, data?: any): void {
    if (!this.isEnabled) return;

    const message = error instanceof Error ? error.message : error;
    const debugEvent: DebugEvent = {
      id: this.generateEventId(),
      timestamp: new Date(),
      type: 'error',
      category,
      message: `ERROR: ${message}`,
      data: {
        error: error instanceof Error ? {
          name: error.name,
          message: error.message,
          stack: error.stack
        } : error,
        ...data
      }
    };

    this.addEvent(debugEvent);
  }

  public logEvent(type: DebugEvent['type'], category: string, message: string, data?: any): void {
    if (!this.isEnabled) return;

    const event: DebugEvent = {
      id: this.generateEventId(),
      timestamp: new Date(),
      type,
      category,
      message,
      data
    };

    this.addEvent(event);
  }

  public getRecentEvents(limit: number = 10): DebugEvent[] {
    return this.events.slice(-limit).reverse();
  }

  public getSystemMetrics(): SystemMetrics {
    return {
      cpu: this.getCpuUsage(),
      memory: this.getMemoryUsage(),
      uptime: process.uptime(),
      activeWindows: this.getActiveWindowsCount(),
      apiRequestsPerMinute: this.getApiRequestsPerMinute(),
      mdnsStatus: this.getMdnsStatus(),
      displays: this.getDisplays()
    };
  }

  public clearEvents(): void {
    this.events = [];
    this.emit('events-cleared');
  }

  private addEvent(event: DebugEvent): void {
    this.events.push(event);
    
    // Keep only recent events
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents);
    }

    // Emit event for real-time updates
    this.emit('debug-event', event);
  }

  private generateEventId(): string {
    return `debug-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private trackApiRequest(): void {
    const now = Date.now();
    this.apiRequestCount++;
    this.apiRequestTimes.push(now);

    // Keep only requests from the last minute
    const oneMinuteAgo = now - 60000;
    this.apiRequestTimes = this.apiRequestTimes.filter(time => time > oneMinuteAgo);
  }

  private getApiRequestsPerMinute(): number {
    return this.apiRequestTimes.length;
  }

  private getCpuUsage(): number {
    // Simplified CPU usage estimation
    // In a real implementation, you might want to use a proper system monitoring library
    return Math.floor(Math.random() * 20) + 5; // Mock data for now
  }

  private getMemoryUsage(): number {
    const memUsage = process.memoryUsage();
    return Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100);
  }

  private getActiveWindowsCount(): number {
    // This should be connected to the WindowManager
    // For now, return a mock value
    return 0; // Will be updated when integrated
  }

  private getMdnsStatus(): 'active' | 'inactive' | 'error' {
    // This should be connected to the MDNSService
    // For now, return a mock status
    return 'active'; // Will be updated when integrated
  }

  private getDisplays(): any[] {
    try {
      // Get displays from ConfigManager
      return this.configManager.getDisplays();
    } catch (error) {
      console.error('Error getting displays:', error);
      return [];
    }
  }

  public getEventStats(): { [key: string]: number } {
    const stats: { [key: string]: number } = {};
    
    this.events.forEach(event => {
      const key = `${event.type}_${event.category}`;
      stats[key] = (stats[key] || 0) + 1;
    });

    return stats;
  }

  public exportEvents(format: 'json' | 'csv' = 'json'): string {
    if (format === 'json') {
      return JSON.stringify(this.events, null, 2);
    }

    // CSV format
    const headers = ['timestamp', 'type', 'category', 'message', 'duration'];
    const csvRows = [headers.join(',')];

    this.events.forEach(event => {
      const row = [
        event.timestamp.toISOString(),
        event.type,
        event.category,
        `"${event.message}"`,
        event.duration || ''
      ];
      csvRows.push(row.join(','));
    });

    return csvRows.join('\n');
  }
}
