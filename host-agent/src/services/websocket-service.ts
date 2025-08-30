import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import { logger } from '../utils/logger';

export interface WebSocketMessage {
  type: string;
  data?: any;
  timestamp: Date;
  clientId?: string;
}

export interface DisplayStateMessage extends WebSocketMessage {
  type: 'display_state_changed' | 'display_refreshed' | 'dashboard_deployed';
  data: {
    displayId: string;
    state: {
      isActive: boolean;
      currentUrl?: string;
      dashboardId?: string;
      windowId?: string;
      lastRefresh: Date;
      isResponsive: boolean;
    };
  };
}

export interface HeartbeatMessage extends WebSocketMessage {
  type: 'heartbeat' | 'heartbeat_response';
  data: {
    hostId: string;
    timestamp: Date;
    systemStatus?: any;
  };
}

export class WebSocketService {
  private wss: WebSocketServer | null = null;
  private server: any = null;
  private clients: Map<string, WebSocket> = new Map();
  private port: number;
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor(port: number = 8081) {
    this.port = port;
  }

  public async start(): Promise<void> {
    try {
      // Create HTTP server for WebSocket
      this.server = createServer();
      
      // Create WebSocket server
      this.wss = new WebSocketServer({ 
        server: this.server,
        path: '/ws'
      });

      this.setupWebSocketHandlers();
      
      // Start HTTP server
      await new Promise<void>((resolve, reject) => {
        this.server!.listen(this.port, (err: any) => {
          if (err) {
            reject(err);
          } else {
            logger.success(`WebSocket server listening on port ${this.port}`);
            resolve();
          }
        });
      });

      this.startHeartbeat();
      
    } catch (error) {
      logger.error('Failed to start WebSocket service:', error);
      throw error;
    }
  }

  public stop(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }

    if (this.server) {
      this.server.close();
      this.server = null;
    }

    this.clients.clear();
    logger.info('WebSocket service stopped');
  }

  private setupWebSocketHandlers(): void {
    if (!this.wss) return;

    this.wss.on('connection', (ws: WebSocket, request) => {
      const clientId = this.generateClientId();
      this.clients.set(clientId, ws);
      
      logger.info(`WebSocket client connected: ${clientId} from ${request.socket.remoteAddress}`);

      // Send welcome message
      this.sendToClient(clientId, {
        type: 'connection_established',
        data: { clientId, timestamp: new Date() },
        timestamp: new Date(),
        clientId
      });

      // Handle messages from client
      ws.on('message', (data: Buffer) => {
        try {
          const message: WebSocketMessage = JSON.parse(data.toString());
          this.handleClientMessage(clientId, message);
        } catch (error) {
          logger.error(`Error parsing WebSocket message from ${clientId}:`, error);
        }
      });

      // Handle client disconnect
      ws.on('close', () => {
        this.clients.delete(clientId);
        logger.info(`WebSocket client disconnected: ${clientId}`);
      });

      // Handle errors
      ws.on('error', (error) => {
        logger.error(`WebSocket error for client ${clientId}:`, error);
        this.clients.delete(clientId);
      });
    });
  }

  private handleClientMessage(clientId: string, message: WebSocketMessage): void {
    logger.debug(`Received WebSocket message from ${clientId}:`, message.type);

    switch (message.type) {
      case 'heartbeat':
        this.handleHeartbeat(clientId, message as HeartbeatMessage);
        break;
      
      case 'request_display_status':
        this.handleDisplayStatusRequest(clientId, message);
        break;
      
      case 'subscribe_to_events':
        this.handleEventSubscription(clientId, message);
        break;
      
      default:
        logger.warn(`Unknown WebSocket message type: ${message.type}`);
    }
  }

  private handleHeartbeat(clientId: string, message: HeartbeatMessage): void {
    // Respond to heartbeat
    this.sendToClient(clientId, {
      type: 'heartbeat_response',
      data: {
        hostId: message.data.hostId,
        timestamp: new Date()
      },
      timestamp: new Date(),
      clientId
    });
  }

  private handleDisplayStatusRequest(clientId: string, message: WebSocketMessage): void {
    // This would be implemented to send current display status
    // For now, just acknowledge the request
    this.sendToClient(clientId, {
      type: 'display_status_response',
      data: { message: 'Display status request received' },
      timestamp: new Date(),
      clientId
    });
  }

  private handleEventSubscription(clientId: string, message: WebSocketMessage): void {
    // Mark client as subscribed to events
    logger.info(`Client ${clientId} subscribed to events`);
    
    this.sendToClient(clientId, {
      type: 'subscription_confirmed',
      data: { eventTypes: ['display_state_changed', 'dashboard_deployed', 'display_refreshed'] },
      timestamp: new Date(),
      clientId
    });
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      this.broadcastHeartbeat();
    }, 30000); // Every 30 seconds
  }

  private broadcastHeartbeat(): void {
    const heartbeatMessage: HeartbeatMessage = {
      type: 'heartbeat',
      data: {
        hostId: process.env.HOST_ID || 'unknown',
        timestamp: new Date()
      },
      timestamp: new Date()
    };

    this.broadcast(heartbeatMessage);
  }

  private generateClientId(): string {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private sendToClient(clientId: string, message: WebSocketMessage): void {
    const client = this.clients.get(clientId);
    if (client && client.readyState === WebSocket.OPEN) {
      try {
        client.send(JSON.stringify(message));
      } catch (error) {
        logger.error(`Error sending message to client ${clientId}:`, error);
        this.clients.delete(clientId);
      }
    }
  }

  // Public methods for broadcasting events
  public broadcast(message: WebSocketMessage): void {
    const messageStr = JSON.stringify(message);
    
    this.clients.forEach((client, clientId) => {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(messageStr);
        } catch (error) {
          logger.error(`Error broadcasting to client ${clientId}:`, error);
          this.clients.delete(clientId);
        }
      } else {
        this.clients.delete(clientId);
      }
    });
  }

  public broadcastDisplayStateChanged(displayId: string, state: any): void {
    const message: DisplayStateMessage = {
      type: 'display_state_changed',
      data: {
        displayId,
        state: {
          isActive: state.active || false,
          currentUrl: state.currentUrl,
          dashboardId: state.dashboardId,
          windowId: state.windowId,
          lastRefresh: state.lastRefresh || new Date(),
          isResponsive: state.isResponsive || false
        }
      },
      timestamp: new Date()
    };

    this.broadcast(message);
    logger.debug(`Broadcasted display state change for ${displayId}`);
  }

  public broadcastDashboardDeployed(displayId: string, dashboardId: string, url: string): void {
    const message: DisplayStateMessage = {
      type: 'dashboard_deployed',
      data: {
        displayId,
        state: {
          isActive: true,
          currentUrl: url,
          dashboardId,
          lastRefresh: new Date(),
          isResponsive: true
        }
      },
      timestamp: new Date()
    };

    this.broadcast(message);
    logger.info(`Broadcasted dashboard deployment: ${dashboardId} on ${displayId}`);
  }

  public broadcastDisplayRefreshed(displayId: string, windowId: string): void {
    const message: DisplayStateMessage = {
      type: 'display_refreshed',
      data: {
        displayId,
        state: {
          isActive: true,
          windowId,
          lastRefresh: new Date(),
          isResponsive: true
        }
      },
      timestamp: new Date()
    };

    this.broadcast(message);
    logger.info(`Broadcasted display refresh for ${displayId}`);
  }

  public getConnectedClientsCount(): number {
    return this.clients.size;
  }

  public isRunning(): boolean {
    return this.wss !== null && this.server !== null;
  }
}
