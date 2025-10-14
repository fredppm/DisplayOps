import { createContextLogger } from '@/utils/logger';

const wsLogger = createContextLogger('websocket');

// WebSocket functionality disabled - using direct gRPC connections instead
// Controllers removed in favor of direct host-agent connections
// This is a stub to maintain compatibility with existing code

declare global {
  var __webSocketServerSingletonInstance: WebSocketServerSingleton | undefined;
}

class WebSocketServerSingleton {
  private static instance: WebSocketServerSingleton;
  private isStarted: boolean = false;
  private port: number;

  private constructor() {
    this.port = parseInt(process.env.WEBSOCKET_CONTROLLER_ADMIN_PORT || process.env.ADMIN_PORT || '3000');
    wsLogger.info('WebSocketServerSingleton: Legacy WebSocket disabled, using direct gRPC connections');
  }

  public static getInstance(): WebSocketServerSingleton {
    if (!global.__webSocketServerSingletonInstance) {
      global.__webSocketServerSingletonInstance = new WebSocketServerSingleton();
      WebSocketServerSingleton.instance = global.__webSocketServerSingletonInstance;
    } else {
      WebSocketServerSingleton.instance = global.__webSocketServerSingletonInstance;
    }
    return WebSocketServerSingleton.instance;
  }

  // Stub methods for compatibility
  public async startWithIO(io: any): Promise<any> {
    wsLogger.debug('WebSocket startWithIO called (disabled, returning mock)');
    this.isStarted = true;
    return {};
  }

  public async start(httpServer?: any): Promise<any> {
    wsLogger.debug('WebSocket start called (disabled, returning mock)');
    this.isStarted = true;
    return {};
  }

  public stop(): void {
    wsLogger.debug('WebSocket stop called (disabled)');
    this.isStarted = false;
  }

  public forceStop(): void {
    wsLogger.debug('WebSocket forceStop called (disabled)');
    this.isStarted = false;
  }

  public isRunning(): boolean {
    return false; // Always return false since WebSocket is disabled
  }

  public getPort(): number {
    return this.port;
  }

  public getConnectionStats(): { connected: number; total: number } {
    return { connected: 0, total: 0 };
  }

  public isControllerConnected(controllerId: string): boolean {
    return false;
  }

  public async sendCommandToController(controllerId: string, command: any): Promise<void> {
    wsLogger.warn('sendCommandToController called but WebSocket is disabled');
    throw new Error('WebSocket functionality disabled - use direct gRPC connections instead');
  }

  public getConnectedControllers(): string[] {
    return [];
  }

  public getControllerStatus(controllerId: string): any {
    return null;
  }

  public getAllControllerStatuses(): any[] {
    return [];
  }

  // Sync methods (stubs for compatibility)
  public triggerDashboardSync(): void {
    wsLogger.debug('triggerDashboardSync called (disabled)');
  }

  public triggerCookieSync(): void {
    wsLogger.debug('triggerCookieSync called (disabled)');
  }

  // Event emitter stubs
  public on(event: string, handler: (...args: any[]) => void): void {
    // No-op
  }

  public off(event: string, handler: (...args: any[]) => void): void {
    // No-op
  }

  public emit(event: string, ...args: any[]): void {
    // No-op
  }
}

// Export singleton instance
export const webSocketServerSingleton = WebSocketServerSingleton.getInstance();
