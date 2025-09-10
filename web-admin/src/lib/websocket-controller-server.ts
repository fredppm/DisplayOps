import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { EventEmitter } from 'events';
import fs from 'fs/promises';
import path from 'path';
import { Controller } from '@/types/multi-site-types';
import { createContextLogger } from '@/utils/logger';

const wsServerLogger = createContextLogger('websocket-server');

interface ControllerConnection {
  controllerId: string;
  socket: any;
  lastHeartbeat: Date;
  isRegistered: boolean;
  metadata?: any;
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

export class WebSocketControllerServer extends EventEmitter {
  private io: SocketIOServer | null = null;
  private connections: Map<string, ControllerConnection> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private port: number;
  private server: HTTPServer | null = null;

  constructor(port: number = 3001) {
    super();
    this.port = port;
  }

  public async startWithIO(existingIO: any): Promise<void> {
    return new Promise(async (resolve, reject) => {
      try {
        wsServerLogger.info('Starting WebSocket Controller Server with existing Socket.IO instance');

        // Use the existing Socket.IO instance
        this.io = existingIO;

        // Handle connections
        this.io.on('connection', (socket) => {
          this.handleConnection(socket);
        });

        // Start connection cleanup
        this.startConnectionCleanup();

        // Emit event for health status updates
        this.emit('websocket-server-started', { port: this.port });

        wsServerLogger.info('WebSocket Controller Server started with existing Socket.IO instance');
        resolve();

      } catch (error) {
        wsServerLogger.error('Failed to start WebSocket server with existing Socket.IO:', error);
        reject(error);
      }
    });
  }

  public async start(httpServer?: HTTPServer): Promise<void> {
    return new Promise(async (resolve, reject) => {
      try {
        wsServerLogger.info('Starting WebSocket Controller Server', { port: this.port });

        // Check and clean up port if needed (for hot reload scenarios)
        if (!httpServer) {
          await this.ensurePortAvailable();
        }

        // Create Socket.IO server with error handling
        try {
          this.io = new SocketIOServer(httpServer || this.port, {
            path: '/ws/controller-admin',
            cors: {
              origin: "*",
              methods: ["GET", "POST"]
            },
            transports: ['websocket', 'polling'],
            pingTimeout: 60000,
            pingInterval: 25000,
            allowEIO3: true
          });
        } catch (createError) {
          if ((createError as any).code === 'EADDRINUSE') {
            wsServerLogger.warn('Port in use during Socket.IO creation, likely hot reload');
            resolve(); // Resolve gracefully for hot reload
            return;
          }
          throw createError;
        }

        // Handle server errors (like EADDRINUSE)
        this.io.on('error', (error: any) => {
          wsServerLogger.error('Socket.IO server error:', error);
          if (error.code === 'EADDRINUSE') {
            wsServerLogger.warn('Port already in use, this may be due to hot reload');
            // Don't reject, as this might be a hot reload scenario
            resolve();
          } else {
            reject(error);
          }
        });

        // Handle connections
        this.io.on('connection', (socket) => {
          this.handleConnection(socket);
        });

        // Start connection cleanup
        this.startConnectionCleanup();

        // Emit event for health status updates
        this.emit('websocket-server-started', { port: this.port });

        wsServerLogger.info('WebSocket Controller Server started successfully', { port: this.port });
        resolve();

      } catch (error) {
        wsServerLogger.error('Failed to start WebSocket server:', error);
        
        // Handle port in use error gracefully
        if ((error as any).code === 'EADDRINUSE') {
          wsServerLogger.warn('Port already in use during start, likely hot reload');
          resolve(); // Don't reject for hot reload
        } else {
          reject(error);
        }
      }
    });
  }

  public async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.heartbeatInterval) {
        clearInterval(this.heartbeatInterval);
        this.heartbeatInterval = null;
      }

      // Close all connections
      this.connections.forEach((conn) => {
        try {
          conn.socket.disconnect(true);
        } catch (error) {
          wsServerLogger.warn('Error closing connection:', error);
        }
      });
      this.connections.clear();

      // Close Socket.IO server
      if (this.io) {
        this.io.close(() => {
          wsServerLogger.info('WebSocket Controller Server stopped gracefully');
          this.emit('websocket-server-stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  public forceStop(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    // Force close all connections
    this.connections.forEach((conn) => {
      try {
        conn.socket.disconnect(true);
      } catch (error) {
        wsServerLogger.warn('Error force closing connection:', error);
      }
    });
    this.connections.clear();

    // Force close Socket.IO server
    if (this.io) {
      this.io.close();
      wsServerLogger.info('WebSocket Controller Server force stopped');
    }

    this.emit('websocket-server-stopped');
  }

  private handleConnection(socket: any): void {
    const connectionId = this.generateConnectionId();
    wsServerLogger.info('New controller WebSocket connection', { 
      socketId: socket.id, 
      connectionId 
    });

    let connection: ControllerConnection | null = null;

    // Handle controller messages
    socket.on('controller-message', async (message: WebSocketMessage) => {
      try {
        wsServerLogger.debug('Received controller message', { 
          type: message.type, 
          controllerId: message.controller_id,
          socketId: socket.id
        });

        // Update or create connection tracking
        if (!connection) {
          connection = {
            controllerId: message.controller_id,
            socket: socket,
            lastHeartbeat: new Date(),
            isRegistered: false
          };
          this.connections.set(socket.id, connection);
        } else {
          connection.lastHeartbeat = new Date();
          connection.controllerId = message.controller_id;
        }

        await this.processMessage(socket, message, connection);

      } catch (error) {
        wsServerLogger.error('Error processing controller message:', error);
        this.sendErrorResponse(socket, message.controller_id, 'PROCESSING_ERROR', 
          `Error processing message: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    });

    // Handle disconnection
    socket.on('disconnect', (reason: string) => {
      wsServerLogger.info('Controller disconnected', { 
        socketId: socket.id, 
        reason,
        controllerId: connection?.controllerId 
      });
      
      if (connection) {
        this.emit('controller_disconnected', connection.controllerId);
        this.emit('controller-disconnected', connection.controllerId);
        this.connections.delete(socket.id);
      }
    });

    // Handle ping/pong for keepalive
    socket.on('ping', () => {
      socket.emit('pong');
      if (connection) {
        connection.lastHeartbeat = new Date();
      }
    });

    // Send initial connection acknowledgment
    socket.emit('connected', { 
      timestamp: this.createTimestamp(),
      server: 'websocket-controller-admin'
    });
  }

  private async processMessage(
    socket: any, 
    message: WebSocketMessage, 
    connection: ControllerConnection
  ): Promise<void> {
    switch (message.type) {
      case 'registration':
        await this.handleRegistration(socket, message, connection);
        break;
      case 'status_update':
        await this.handleStatusUpdate(socket, message, connection);
        break;
      case 'command_response':
        await this.handleCommandResponse(socket, message, connection);
        break;
      default:
        wsServerLogger.warn('Unknown message type received', { 
          type: message.type, 
          controllerId: message.controller_id 
        });
    }
  }

  private async handleRegistration(
    socket: any, 
    message: WebSocketMessage, 
    connection: ControllerConnection
  ): Promise<void> {
    const { controller_id } = message;
    const registrationData = message.payload;

    if (!registrationData) {
      wsServerLogger.error('Registration message missing registration data', { controller_id });
      this.sendErrorResponse(socket, controller_id, 'MISSING_DATA', 'Registration data is required');
      return;
    }

    wsServerLogger.info('Processing controller registration', {
      controller_id,
      hostname: registrationData.hostname,
      location: registrationData.location
    });

    try {
      const controller = await this.registerController(controller_id, registrationData);
      connection.isRegistered = true;

      const successResponse: AdminMessage = {
        type: 'registration_success',
        controller_id,
        timestamp: this.createTimestamp(),
        payload: {
          success: true,
          message: `Controller registered successfully as ${controller.name}`,
          assigned_controller_id: controller.id,
          assigned_site_id: controller.siteId
        }
      };

      socket.emit('admin-message', successResponse);

      // Emit events for other parts of the application
      this.emit('controller_registered', controller);
      this.emit('controller-registered', controller);

      // Process pending syncs
      await this.processPendingSyncs(socket, controller.id);
      await this.processPendingCookieSyncs(socket, controller.id);

      wsServerLogger.info('Controller registration successful', {
        controller_id: controller.id,
        name: controller.name,
        siteId: controller.siteId
      });

    } catch (error) {
      wsServerLogger.error('Controller registration failed:', error);
      
      const errorResponse: AdminMessage = {
        type: 'registration_error',
        controller_id,
        timestamp: this.createTimestamp(),
        payload: {
          success: false,
          message: `Registration failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        }
      };
      
      socket.emit('admin-message', errorResponse);
    }
  }

  private async handleStatusUpdate(
    socket: any, 
    message: WebSocketMessage, 
    connection: ControllerConnection
  ): Promise<void> {
    const { controller_id } = message;
    const statusData = message.payload;

    if (!connection.isRegistered) {
      wsServerLogger.warn('Status update from unregistered controller', { controller_id });
      this.sendErrorResponse(socket, controller_id, 'NOT_REGISTERED', 
        'Controller must complete registration first');
      return;
    }

    if (!statusData) {
      wsServerLogger.error('Status message missing status data', { controller_id });
      this.sendErrorResponse(socket, controller_id, 'MISSING_DATA', 'Status data is required');
      return;
    }

    try {
      await this.updateControllerStatus(controller_id, statusData);
      
      const ackResponse: AdminMessage = {
        type: 'status_acknowledged',
        controller_id,
        timestamp: this.createTimestamp(),
        payload: {
          received: true,
          server_time: this.createTimestamp()
        }
      };
      
      socket.emit('admin-message', ackResponse);

      // Emit events for monitoring systems
      this.emit('controller_status_update', {
        controller_id,
        status: statusData,
        timestamp: new Date()
      });
      
      this.emit('controller-status-updated', {
        controllerId: controller_id,
        status: statusData,
        timestamp: new Date()
      });

      wsServerLogger.debug('Status update processed', { controller_id });

    } catch (error) {
      wsServerLogger.error('Failed to update controller status:', error);
      this.sendErrorResponse(socket, controller_id, 'UPDATE_ERROR', 
        `Failed to update status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async handleCommandResponse(
    socket: any, 
    message: WebSocketMessage, 
    connection: ControllerConnection
  ): Promise<void> {
    const { controller_id } = message;
    const responseData = message.payload;

    wsServerLogger.info('Received command response', {
      controller_id,
      command_id: responseData.command_id,
      success: responseData.success
    });

    // TODO: Process command response based on command type
    // This would handle responses from dashboard sync, cookie sync, etc.
  }

  private sendErrorResponse(
    socket: any, 
    controllerId: string, 
    errorCode: string, 
    errorMessage: string
  ): void {
    const errorResponse: AdminMessage = {
      type: 'error',
      controller_id: controllerId,
      timestamp: this.createTimestamp(),
      payload: {
        error_code: errorCode,
        error_message: errorMessage,
        retry_suggested: true
      }
    };
    
    try {
      socket.emit('admin-message', errorResponse);
    } catch (error) {
      wsServerLogger.error('Failed to send error response:', error);
    }
  }

  private generateConnectionId(): string {
    return `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private createTimestamp(): string {
    return new Date().toISOString();
  }

  private startConnectionCleanup(): void {
    this.heartbeatInterval = setInterval(() => {
      const now = new Date();
      const timeoutMs = 60000; // 1 minute timeout

      for (const [socketId, connection] of this.connections.entries()) {
        if (now.getTime() - connection.lastHeartbeat.getTime() > timeoutMs) {
          wsServerLogger.warn('Cleaning up stale connection', { 
            socketId, 
            controllerId: connection.controllerId 
          });
          
          try {
            connection.socket.disconnect(true);
          } catch (error) {
            wsServerLogger.warn('Error ending stale connection:', error);
          }
          
          this.connections.delete(socketId);
        }
      }
    }, 30000); // Check every 30 seconds
  }

  // File I/O helpers (similar to gRPC server)
  private async readControllersData(filePath: string): Promise<{ controllers: Controller[] }> {
    try {
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      return { controllers: [] };
    }
  }

  private async writeControllersData(filePath: string, data: { controllers: Controller[] }): Promise<void> {
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
  }

  private async readSitesData(filePath: string): Promise<{ sites: any[] }> {
    try {
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      return { sites: [] };
    }
  }

  private async writeSitesData(filePath: string, data: { sites: any[] }): Promise<void> {
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
  }

  private async registerController(controllerId: string, registrationData: any): Promise<Controller> {
    const CONTROLLERS_FILE = path.join(process.cwd(), 'data', 'controllers.json');
    const SITES_FILE = path.join(process.cwd(), 'data', 'sites.json');

    const controllersData = await this.readControllersData(CONTROLLERS_FILE);
    const sitesData = await this.readSitesData(SITES_FILE);
    
    let targetSiteId = registrationData.site_id || undefined;
    if (targetSiteId) {
      const site = sitesData.sites.find((s: any) => s.id === targetSiteId);
      if (!site) {
        targetSiteId = undefined;
      }
    }

    const existingController = controllersData.controllers.find(
      (c: Controller) => c.id === controllerId
    );

    if (existingController) {
      existingController.name = registrationData.location || registrationData.hostname;
      existingController.localNetwork = registrationData.local_network;
      existingController.mdnsService = registrationData.mdns_service;
      existingController.controllerUrl = registrationData.web_admin_url || existingController.controllerUrl;
      existingController.version = registrationData.version;
      existingController.status = 'online';
      existingController.lastSync = new Date().toISOString();

      await this.writeControllersData(CONTROLLERS_FILE, controllersData);
      return existingController;
    }

    const newController: Controller = {
      id: controllerId,
      siteId: targetSiteId,
      name: registrationData.location || registrationData.hostname,
      localNetwork: registrationData.local_network,
      mdnsService: registrationData.mdns_service,
      controllerUrl: registrationData.web_admin_url || 'http://localhost:3000',
      status: 'online',
      lastSync: new Date().toISOString(),
      version: registrationData.version
    };

    controllersData.controllers.push(newController);
    await this.writeControllersData(CONTROLLERS_FILE, controllersData);

    if (targetSiteId) {
      const targetSite = sitesData.sites.find((s: any) => s.id === targetSiteId);
      if (targetSite && !targetSite.controllers.includes(controllerId)) {
        targetSite.controllers.push(controllerId);
        targetSite.updatedAt = new Date().toISOString();
        await this.writeSitesData(SITES_FILE, sitesData);
      }
    }

    return newController;
  }

  private async updateControllerStatus(controllerId: string, statusData: any): Promise<void> {
    const CONTROLLERS_FILE = path.join(process.cwd(), 'data', 'controllers.json');
    const controllersData = await this.readControllersData(CONTROLLERS_FILE);
    
    const controller = controllersData.controllers.find((c: Controller) => c.id === controllerId);
    if (controller) {
      controller.status = statusData.status.toLowerCase();
      controller.lastSync = new Date().toISOString();
      await this.writeControllersData(CONTROLLERS_FILE, controllersData);
    }
  }

  // Dashboard sync functions (similar to gRPC server)
  public async markAllControllersForSync(): Promise<void> {
    const CONTROLLERS_FILE = path.join(process.cwd(), 'data', 'controllers.json');
    const controllersData = await this.readControllersData(CONTROLLERS_FILE);
    const syncTimestamp = new Date().toISOString();

    controllersData.controllers.forEach((controller: any) => {
      controller.pendingDashboardSync = true;
      controller.dashboardSyncTimestamp = syncTimestamp;
    });

    await this.writeControllersData(CONTROLLERS_FILE, controllersData);
    
    wsServerLogger.info('All controllers marked for dashboard sync', {
      controllersCount: controllersData.controllers.length,
      syncTimestamp
    });
  }

  public async broadcastDashboardSync(): Promise<void> {
    const dashboards = await this.loadDashboards();
    const syncTimestamp = this.createTimestamp();

    let successCount = 0;
    let errorCount = 0;

    for (const [socketId, connection] of this.connections.entries()) {
      if (connection.isRegistered) {
        try {
          const dashboardSyncMessage: AdminMessage = {
            type: 'dashboard_sync',
            controller_id: connection.controllerId,
            timestamp: syncTimestamp,
            payload: {
              command_id: this.generateConnectionId(),
              dashboards: dashboards.map(d => ({
                id: d.id,
                name: d.name,
                url: d.url,
                description: d.description,
                refresh_interval: d.refreshInterval,
                requires_auth: d.requiresAuth,
                category: d.category || ''
              })),
              sync_timestamp: syncTimestamp,
              sync_type: 'full'
            }
          };

          connection.socket.emit('admin-message', dashboardSyncMessage);
          await this.clearSyncFlag(connection.controllerId);
          successCount++;
          
          wsServerLogger.debug('Dashboard sync sent to controller', {
            controllerId: connection.controllerId,
            dashboardsCount: dashboards.length
          });
        } catch (error) {
          errorCount++;
          wsServerLogger.error('Failed to send dashboard sync to controller', {
            controllerId: connection.controllerId,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }
    }

    wsServerLogger.info('Dashboard sync broadcast completed', {
      successCount,
      errorCount,
      totalDashboards: dashboards.length,
      syncTimestamp
    });
  }

  private async processPendingSyncs(socket: any, controllerId: string): Promise<void> {
    const CONTROLLERS_FILE = path.join(process.cwd(), 'data', 'controllers.json');
    const controllersData = await this.readControllersData(CONTROLLERS_FILE);
    
    const controller: any = controllersData.controllers.find(c => c.id === controllerId);
    if (!controller || !controller.pendingDashboardSync) {
      return;
    }

    wsServerLogger.info('Processing pending dashboard sync', {
      controllerId,
      pendingSince: controller.dashboardSyncTimestamp
    });

    const dashboards = await this.loadDashboards();
    const syncTimestamp = this.createTimestamp();

    const dashboardSyncMessage: AdminMessage = {
      type: 'dashboard_sync',
      controller_id: controllerId,
      timestamp: syncTimestamp,
      payload: {
        command_id: this.generateConnectionId(),
        dashboards: dashboards.map(d => ({
          id: d.id,
          name: d.name,
          url: d.url,
          description: d.description,
          refresh_interval: d.refreshInterval,
          requires_auth: d.requiresAuth,
          category: d.category || ''
        })),
        sync_timestamp: syncTimestamp,
        sync_type: 'full'
      }
    };

    try {
      socket.emit('admin-message', dashboardSyncMessage);
      await this.clearSyncFlag(controllerId);
      
      wsServerLogger.info('Pending dashboard sync sent successfully', {
        controllerId,
        dashboardsCount: dashboards.length
      });
    } catch (error) {
      wsServerLogger.error('Failed to send pending dashboard sync', {
        controllerId,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private async clearSyncFlag(controllerId: string): Promise<void> {
    const CONTROLLERS_FILE = path.join(process.cwd(), 'data', 'controllers.json');
    const controllersData = await this.readControllersData(CONTROLLERS_FILE);
    
    const controller: any = controllersData.controllers.find(c => c.id === controllerId);
    if (controller) {
      controller.pendingDashboardSync = false;
      controller.dashboardSyncTimestamp = null;
      await this.writeControllersData(CONTROLLERS_FILE, controllersData);
    }
  }

  private async loadDashboards(): Promise<any[]> {
    const DASHBOARDS_FILE = path.join(process.cwd(), 'data', 'dashboards.json');
    try {
      const data = await fs.readFile(DASHBOARDS_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      return Array.isArray(parsed) ? parsed : parsed.dashboards || [];
    } catch (error) {
      wsServerLogger.error('Error loading dashboards for sync', { error });
      return [];
    }
  }

  // Cookie sync functions
  public async markAllControllersForCookieSync(): Promise<void> {
    const CONTROLLERS_FILE = path.join(process.cwd(), 'data', 'controllers.json');
    const controllersData = await this.readControllersData(CONTROLLERS_FILE);
    const syncTimestamp = new Date().toISOString();

    controllersData.controllers.forEach((controller: any) => {
      controller.pendingCookieSync = true;
      controller.cookieSyncTimestamp = syncTimestamp;
    });

    await this.writeControllersData(CONTROLLERS_FILE, controllersData);
    
    wsServerLogger.info('All controllers marked for cookie sync', {
      controllersCount: controllersData.controllers.length,
      syncTimestamp
    });
  }

  public async broadcastCookieSync(): Promise<void> {
    const cookiesData = await this.loadCookies();
    const syncTimestamp = this.createTimestamp();

    const cookieDomains = Object.values(cookiesData.domains).map((domain: any) => ({
      domain: domain.domain,
      description: domain.description,
      cookies: domain.cookies.map((cookie: any) => ({
        name: cookie.name,
        value: cookie.value,
        domain: cookie.domain,
        path: cookie.path,
        secure: cookie.secure,
        http_only: cookie.httpOnly,
        same_site: cookie.sameSite,
        expiration_date: cookie.expirationDate,
        description: cookie.description || ''
      })),
      last_updated: syncTimestamp
    }));

    let successCount = 0;
    let errorCount = 0;

    for (const [socketId, connection] of this.connections.entries()) {
      if (connection.isRegistered) {
        try {
          const cookieSyncMessage: AdminMessage = {
            type: 'cookie_sync',
            controller_id: connection.controllerId,
            timestamp: syncTimestamp,
            payload: {
              command_id: this.generateConnectionId(),
              cookie_domains: cookieDomains,
              sync_timestamp: syncTimestamp,
              sync_type: 'full'
            }
          };

          connection.socket.emit('admin-message', cookieSyncMessage);
          await this.clearCookieSyncFlag(connection.controllerId);
          successCount++;
          
          wsServerLogger.debug('Cookie sync sent to controller', {
            controllerId: connection.controllerId,
            domainsCount: cookieDomains.length
          });
        } catch (error) {
          errorCount++;
          wsServerLogger.error('Failed to send cookie sync to controller', {
            controllerId: connection.controllerId,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }
    }

    wsServerLogger.info('Cookie sync broadcast completed', {
      successCount,
      errorCount,
      totalDomains: cookieDomains.length,
      syncTimestamp
    });
  }

  private async processPendingCookieSyncs(socket: any, controllerId: string): Promise<void> {
    const CONTROLLERS_FILE = path.join(process.cwd(), 'data', 'controllers.json');
    const controllersData = await this.readControllersData(CONTROLLERS_FILE);
    
    const controller: any = controllersData.controllers.find(c => c.id === controllerId);
    if (!controller || !controller.pendingCookieSync) {
      return;
    }

    wsServerLogger.info('Processing pending cookie sync', {
      controllerId,
      pendingSince: controller.cookieSyncTimestamp
    });

    const cookiesData = await this.loadCookies();
    const syncTimestamp = this.createTimestamp();

    const cookieDomains = Object.values(cookiesData.domains).map((domain: any) => ({
      domain: domain.domain,
      description: domain.description,  
      cookies: domain.cookies.map((cookie: any) => ({
        name: cookie.name,
        value: cookie.value,
        domain: cookie.domain,
        path: cookie.path,
        secure: cookie.secure,
        http_only: cookie.httpOnly,
        same_site: cookie.sameSite,
        expiration_date: cookie.expirationDate,
        description: cookie.description || ''
      })),
      last_updated: syncTimestamp
    }));

    const cookieSyncMessage: AdminMessage = {
      type: 'cookie_sync',
      controller_id: controllerId,
      timestamp: syncTimestamp,
      payload: {
        command_id: this.generateConnectionId(),
        cookie_domains: cookieDomains,
        sync_timestamp: syncTimestamp,
        sync_type: 'full'
      }
    };

    try {
      socket.emit('admin-message', cookieSyncMessage);
      await this.clearCookieSyncFlag(controllerId);
      
      wsServerLogger.info('Pending cookie sync sent successfully', {
        controllerId,
        domainsCount: cookieDomains.length
      });
    } catch (error) {
      wsServerLogger.error('Failed to send pending cookie sync', {
        controllerId,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private async clearCookieSyncFlag(controllerId: string): Promise<void> {
    const CONTROLLERS_FILE = path.join(process.cwd(), 'data', 'controllers.json');
    const controllersData = await this.readControllersData(CONTROLLERS_FILE);
    
    const controller: any = controllersData.controllers.find(c => c.id === controllerId);
    if (controller) {
      controller.pendingCookieSync = false;
      controller.cookieSyncTimestamp = null;
      await this.writeControllersData(CONTROLLERS_FILE, controllersData);
    }
  }

  private async loadCookies(): Promise<any> {
    const COOKIES_FILE = path.join(process.cwd(), 'data', 'cookies.json');
    try {
      const data = await fs.readFile(COOKIES_FILE, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      wsServerLogger.error('Error loading cookies for sync', { error });
      return { domains: {}, lastUpdated: new Date().toISOString() };
    }
  }

  // Public getters (similar to gRPC server)
  public getActiveConnections(): Array<{ controllerId: string; lastHeartbeat: Date; isRegistered: boolean }> {
    return Array.from(this.connections.values()).map(conn => ({
      controllerId: conn.controllerId,
      lastHeartbeat: conn.lastHeartbeat,
      isRegistered: conn.isRegistered
    }));
  }

  public getConnectionCount(): number {
    return this.connections.size;
  }

  public isControllerConnected(controllerId: string): boolean {
    return Array.from(this.connections.values()).some(conn => 
      conn.controllerId === controllerId && conn.isRegistered
    );
  }

  // Port management for hot reload scenarios
  private async ensurePortAvailable(): Promise<void> {
    let retryCount = 0;
    const maxRetries = 3;
    
    while (retryCount < maxRetries) {
      const portInUse = await this.isPortInUse(this.port);
      if (!portInUse) {
        break; // Port is free, proceed
      }
      
      wsServerLogger.warn(`Port ${this.port} is in use (attempt ${retryCount + 1}/${maxRetries}), attempting to free it...`);
      await this.killProcessOnPort(this.port);
      
      // Progressive delay: 2s, 3s, 5s
      const delay = 2000 + (retryCount * 1000);
      await new Promise(r => setTimeout(r, delay));
      
      const stillInUse = await this.isPortInUse(this.port);
      if (!stillInUse) {
        wsServerLogger.info(`Port ${this.port} successfully freed after cleanup attempt ${retryCount + 1}`);
        break;
      }
      
      retryCount++;
      
      if (retryCount >= maxRetries) {
        wsServerLogger.warn(`Failed to free port ${this.port} after ${maxRetries} attempts. Continuing anyway (may be hot reload).`);
      }
    }
  }

  private async isPortInUse(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const net = require('net');
      const server = net.createServer();
      
      server.listen(port, () => {
        server.once('close', () => resolve(false));
        server.close();
      });
      
      server.on('error', (err: any) => {
        if (err.code === 'EADDRINUSE') {
          resolve(true); // Port is in use
        } else {
          server.once('close', () => resolve(false));
          server.close();
        }
      });
      server.on('error', () => resolve(true));
    });
  }

  private async killProcessOnPort(port: number): Promise<void> {
    return new Promise((resolve) => {
      const { exec } = require('child_process');
      const isWindows = process.platform === 'win32';
      
      if (isWindows) {
        exec(`netstat -ano | findstr :${port}`, (error: any, stdout: string) => {
          if (stdout) {
            const lines = stdout.trim().split('\n');
            const pids = new Set<string>();
            
            lines.forEach(line => {
              const parts = line.trim().split(/\s+/);
              if (parts.length > 4) {
                const pid = parts[parts.length - 1];
                if (pid && pid !== '0' && /^\d+$/.test(pid)) {
                  pids.add(pid);
                }
              }
            });
            
            if (pids.size > 0) {
              wsServerLogger.info(`Found ${pids.size} process(es) using port ${port}: ${Array.from(pids).join(', ')}`);
              
              const pidArray = Array.from(pids);
              let killedCount = 0;
              
              pidArray.forEach(pid => {
                exec(`taskkill /F /PID ${pid}`, (killError: any) => {
                  if (!killError) {
                    wsServerLogger.info(`Successfully killed process ${pid} on port ${port}`);
                  } else {
                    wsServerLogger.warn(`Failed to kill process ${pid}:`, killError.message);
                  }
                  
                  killedCount++;
                  if (killedCount === pidArray.length) {
                    // Wait a bit for processes to fully terminate
                    setTimeout(resolve, 1500);
                  }
                });
              });
            } else {
              resolve();
            }
          } else {
            resolve();
          }
        });
      } else {
        // Linux/macOS
        exec(`lsof -ti:${port}`, (error: any, stdout: string) => {
          if (stdout) {
            const pids = stdout.trim().split('\n').filter(pid => pid && /^\d+$/.test(pid));
            
            if (pids.length > 0) {
              wsServerLogger.info(`Found ${pids.length} process(es) using port ${port}: ${pids.join(', ')}`);
              
              let killedCount = 0;
              pids.forEach(pid => {
                exec(`kill -9 ${pid}`, (killError: any) => {
                  if (!killError) {
                    wsServerLogger.info(`Successfully killed process ${pid} on port ${port}`);
                  } else {
                    wsServerLogger.warn(`Failed to kill process ${pid}:`, killError.message);
                  }
                  
                  killedCount++;
                  if (killedCount === pids.length) {
                    // Wait a bit for processes to fully terminate
                    setTimeout(resolve, 1500);
                  }
                });
              });
            } else {
              resolve();
            }
          } else {
            resolve();
          }
        });
      }
    });
  }
}