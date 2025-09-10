import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { join } from 'path';
import { EventEmitter } from 'events';
import fs from 'fs/promises';
import path from 'path';
// Using proto-loader runtime types (no static TypeScript types)
import { Controller } from '@/types/multi-site-types';
import { createContextLogger } from '@/utils/logger';

const grpcServerLogger = createContextLogger('grpc-server');

// Load protobuf definition
const PROTO_PATH = join(process.cwd(), '..', 'shared', 'proto', 'controller-admin.proto');

interface ControllerConnection {
  controllerId: string;
  stream: grpc.ServerWritableStream<any, any> | grpc.ServerDuplexStream<any, any>;
  lastHeartbeat: Date;
  isRegistered: boolean;
  metadata?: any;
}

// gRPC message creation helpers
function createTimestamp(): any {
  const now = Date.now();
  return {
    seconds: Math.floor(now / 1000),
    nanos: (now % 1000) * 1000000
  };
}

function createRegistrationResponse(controllerId: string, success: boolean, message?: string, assignedControllerId?: string, assignedSiteId?: string): any {
  return {
    controller_id: controllerId,
    type: success ? 'REGISTRATION_SUCCESS' : 'REGISTRATION_ERROR',
    timestamp: createTimestamp(),
    registration_response: {
      success,
      message,
      assigned_controller_id: assignedControllerId,
      assigned_site_id: assignedSiteId
    }
  };
}

function createStatusAck(controllerId: string): any {
  return {
    controller_id: controllerId,
    type: 'STATUS_ACKNOWLEDGED',
    timestamp: createTimestamp(),
    status_ack: {
      received: true,
      server_time: createTimestamp()
    }
  };
}

function createErrorResponse(controllerId: string, errorCode: string, errorMessage: string, retrySuggested: boolean = false): any {
  return {
    controller_id: controllerId,
    type: 'ERROR',
    timestamp: createTimestamp(),
    error: {
      error_code: errorCode,
      error_message: errorMessage,
      retry_suggested: retrySuggested
    }
  };
}

export class ControllerAdminGrpcServer extends EventEmitter {
  private server!: grpc.Server;
  private connections: Map<string, ControllerConnection> = new Map();
  private packageDefinition: any;
  private protoDescriptor: any;
  private port: number;
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor(port: number = 50051) {
    super();
    this.port = port;
    this.setupServer();
  }

  private setupServer(): void {
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
      
      // Create server
      this.server = new grpc.Server();
      
      // Add service implementation
      this.server.addService(this.protoDescriptor.displayops.ControllerAdminService.service, {
        HeartbeatStream: this.handleHeartbeatStream.bind(this),
        AdminCommandStream: this.handleAdminCommandStream.bind(this)
      });

      grpcServerLogger.info('gRPC ControllerAdminServer initialized', { port: this.port });
    } catch (error) {
      grpcServerLogger.error('Failed to setup gRPC server:', error);
      throw error;
    }
  }

  private async isPortInUse(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const server = require('net').createServer();
      server.listen(port, (err: any) => {
        if (err) {
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
                pids.add(parts[parts.length - 1]);
              }
            });
            
            if (pids.size > 0) {
              grpcServerLogger.info(`Found ${pids.size} processes using port ${port}, killing them...`);
              const killPromises = Array.from(pids).map(pid => {
                return new Promise<void>((resolveKill) => {
                  // Skip system processes
                  if (pid === '0' || pid === '4') {
                    resolveKill();
                    return;
                  }
                  
                  // Try graceful termination first, then force kill
                  exec(`taskkill /PID ${pid}`, (killError: any) => {
                    if (killError) {
                      // If graceful fails, force kill
                      exec(`taskkill /F /PID ${pid}`, (forceKillError: any) => {
                        if (forceKillError) {
                          grpcServerLogger.warn(`Failed to force kill process ${pid}:`, forceKillError.message);
                        } else {
                          grpcServerLogger.info(`Force killed process ${pid}`);
                        }
                        resolveKill();
                      });
                    } else {
                      grpcServerLogger.info(`Gracefully killed process ${pid}`);
                      resolveKill();
                    }
                  });
                });
              });
              
              Promise.all(killPromises).then(() => {
                // Wait longer for Windows processes to fully terminate
                setTimeout(resolve, 2000);
              });
            } else {
              resolve();
            }
          } else {
            resolve();
          }
        });
      } else {
        exec(`lsof -ti:${port}`, (error: any, stdout: string) => {
          if (stdout) {
            const pids = stdout.trim().split('\n').filter(pid => pid);
            if (pids.length > 0) {
              grpcServerLogger.info(`Found ${pids.length} processes using port ${port}, killing them...`);
              const killPromises = pids.map(pid => {
                return new Promise<void>((resolveKill) => {
                  exec(`kill -TERM ${pid}`, (killError: any) => {
                    if (killError) {
                      // If SIGTERM fails, try SIGKILL
                      exec(`kill -9 ${pid}`, (forceKillError: any) => {
                        if (forceKillError) {
                          grpcServerLogger.warn(`Failed to kill process ${pid}:`, forceKillError.message);
                        } else {
                          grpcServerLogger.info(`Force killed process ${pid}`);
                        }
                        resolveKill();
                      });
                    } else {
                      grpcServerLogger.info(`Gracefully killed process ${pid}`);
                      resolveKill();
                    }
                  });
                });
              });
              
              Promise.all(killPromises).then(() => {
                setTimeout(resolve, 1500);
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

  public async start(): Promise<void> {
    return new Promise(async (resolve, reject) => {
      // Enhanced port cleanup with retry logic
      let retryCount = 0;
      const maxRetries = 3;
      
      while (retryCount < maxRetries) {
        const portInUse = await this.isPortInUse(this.port);
        if (!portInUse) {
          break; // Port is free, proceed
        }
        
        grpcServerLogger.warn(`Port ${this.port} is in use (attempt ${retryCount + 1}/${maxRetries}), attempting to free it...`);
        await this.killProcessOnPort(this.port);
        
        // Progressive delay: 2s, 3s, 5s
        const delay = 2000 + (retryCount * 1000);
        await new Promise(r => setTimeout(r, delay));
        
        const stillInUse = await this.isPortInUse(this.port);
        if (!stillInUse) {
          grpcServerLogger.info(`Port ${this.port} successfully freed after cleanup attempt ${retryCount + 1}`);
          break;
        }
        
        retryCount++;
        if (retryCount >= maxRetries) {
          grpcServerLogger.error(`Port ${this.port} is still in use after ${maxRetries} cleanup attempts`);
          reject(new Error(`Port ${this.port} is still in use after multiple cleanup attempts`));
          return;
        }
      }

      const serverCredentials = grpc.ServerCredentials.createInsecure();
      
      this.server.bindAsync(`0.0.0.0:${this.port}`, serverCredentials, (error, port) => {
        if (error) {
          grpcServerLogger.error('Failed to bind gRPC server:', error);
          reject(error);
          return;
        }

        this.server.start();
        grpcServerLogger.info(`gRPC ControllerAdminServer started on port ${port}`);
        
        // Start connection cleanup interval
        this.startConnectionCleanup();
        
        // Emit event for health status updates
        this.emit('grpc-server-started', { port: this.port });
        
        resolve();
      });
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
          conn.stream.end();
        } catch (error) {
          grpcServerLogger.warn('Error closing connection:', error);
        }
      });
      this.connections.clear();

      // First try graceful shutdown
      this.server.tryShutdown((error) => {
        if (error) {
          grpcServerLogger.warn('Graceful shutdown failed, forcing shutdown:', error);
          // Force shutdown if graceful fails (important for hotreload scenarios)
          this.server.forceShutdown();
          grpcServerLogger.info('gRPC ControllerAdminServer force stopped');
        } else {
          grpcServerLogger.info('gRPC ControllerAdminServer stopped gracefully');
        }
        
        // Emit event for health status updates
        this.emit('grpc-server-stopped');
        
        resolve();
      });
    });
  }

  public forceStop(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    // Close all connections immediately
    this.connections.forEach((conn) => {
      try {
        conn.stream.destroy();
      } catch (error) {
        grpcServerLogger.warn('Error destroying connection:', error);
      }
    });
    this.connections.clear();

    // Force shutdown immediately (for hotreload scenarios)
    this.server.forceShutdown();
    grpcServerLogger.info('gRPC ControllerAdminServer force stopped immediately');
    
    // Emit event for health status updates
    this.emit('grpc-server-stopped');
  }

  private handleHeartbeatStream(stream: grpc.ServerDuplexStream<any, any>): void {
    const connectionId = this.generateConnectionId();
    grpcServerLogger.info('New controller heartbeat stream connected', { connectionId });

    let controllerConnection: ControllerConnection | null = null;

    stream.on('data', async (heartbeat: any) => {
      try {
        await this.processHeartbeat(heartbeat, stream, connectionId);
        
        // Update connection info
        if (controllerConnection) {
          controllerConnection.lastHeartbeat = new Date();
        }
      } catch (error) {
        grpcServerLogger.error('Error processing heartbeat:', error);
        this.sendErrorResponse(stream, heartbeat.controller_id, 'PROCESSING_ERROR', 
          `Error processing heartbeat: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    });

    stream.on('end', () => {
      grpcServerLogger.info('Controller heartbeat stream ended', { connectionId });
      this.removeConnection(connectionId);
    });

    stream.on('error', (error) => {
      grpcServerLogger.error('Controller heartbeat stream error:', { connectionId, error });
      this.removeConnection(connectionId);
    });

    // Initialize connection tracking
    controllerConnection = {
      controllerId: '', // Will be set when first heartbeat arrives
      stream,
      lastHeartbeat: new Date(),
      isRegistered: false
    };
    
    this.connections.set(connectionId, controllerConnection);
  }

  private async processHeartbeat(
    heartbeat: any, 
    stream: grpc.ServerDuplexStream<any, any>,
    connectionId: string
  ): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      grpcServerLogger.error('Connection not found for heartbeat', { connectionId });
      return;
    }

    // Update connection controller ID
    connection.controllerId = heartbeat.controller_id;

    if (heartbeat.type === 'REGISTRATION') {
      await this.handleRegistration(heartbeat, stream, connection);
    } else if (heartbeat.type === 'STATUS_UPDATE') {
      await this.handleStatusUpdate(heartbeat, stream, connection);
    } else {
      grpcServerLogger.warn('Unknown heartbeat type received', { 
        type: heartbeat.type, 
        controllerId: heartbeat.controller_id 
      });
    }
  }

  private async handleRegistration(
    heartbeat: any, 
    stream: grpc.ServerDuplexStream<any, any>,
    connection: ControllerConnection
  ): Promise<void> {
    const { controller_id } = heartbeat;
    const registrationData = heartbeat.registration;

    if (!registrationData) {
      grpcServerLogger.error('Registration heartbeat missing registration data', { controller_id });
      this.sendErrorResponse(stream, controller_id, 'MISSING_DATA', 'Registration data is required');
      return;
    }

    grpcServerLogger.info('Processing controller registration', { 
      controller_id,
      hostname: registrationData.hostname,
      location: registrationData.location 
    });

    try {
      // Create or update controller in the database
      const controller = await this.registerController(controller_id, registrationData);
      
      connection.isRegistered = true;
      
      // Send success response
      const response = createRegistrationResponse(
        controller_id,
        true,
        `Controller registered successfully as ${controller.name}`,
        controller.id,
        controller.siteId
      );
      
      stream.write(response);
      
      // Emit event for other parts of the application
      this.emit('controller_registered', controller);
      
      // Emit event for health status updates
      this.emit('controller-registered', controller);
      
      // Process pending dashboard syncs for this controller
      await this.processPendingSyncs(controller.id);
      
      // Process pending cookie syncs for this controller
      await this.processPendingCookieSyncs(controller.id);
      
      grpcServerLogger.info('Controller registration successful', { 
        controller_id: controller.id,
        name: controller.name,
        siteId: controller.siteId
      });

    } catch (error) {
      grpcServerLogger.error('Controller registration failed:', error);
      
      const response = createRegistrationResponse(
        controller_id,
        false,
        `Registration failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      
      stream.write(response);
    }
  }

  private async handleStatusUpdate(
    heartbeat: any, 
    stream: grpc.ServerDuplexStream<any, any>,
    connection: ControllerConnection
  ): Promise<void> {
    const { controller_id } = heartbeat;
    const statusData = heartbeat.status;

    if (!connection.isRegistered) {
      grpcServerLogger.warn('Status update from unregistered controller', { controller_id });
      this.sendErrorResponse(stream, controller_id, 'NOT_REGISTERED', 
        'Controller must complete registration first');
      return;
    }

    if (!statusData) {
      grpcServerLogger.error('Status heartbeat missing status data', { controller_id });
      this.sendErrorResponse(stream, controller_id, 'MISSING_DATA', 'Status data is required');
      return;
    }

    try {
      // Update controller status in the database
      await this.updateControllerStatus(controller_id, statusData);
      
      // Send acknowledgment
      const response = createStatusAck(controller_id);
      stream.write(response);
      
      // Emit event for monitoring systems
      this.emit('controller_status_update', {
        controller_id,
        status: statusData,
        timestamp: new Date()
      });
      
      // Emit event for health status updates
      this.emit('controller-status-updated', {
        controllerId: controller_id,
        status: statusData,
        timestamp: new Date()
      });

    } catch (error) {
      grpcServerLogger.error('Failed to update controller status:', error);
      this.sendErrorResponse(stream, controller_id, 'UPDATE_ERROR', 
        `Failed to update status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async registerController(controllerId: string, registrationData: any): Promise<Controller> {
    const CONTROLLERS_FILE = path.join(process.cwd(), 'data', 'controllers.json');
    const SITES_FILE = path.join(process.cwd(), 'data', 'sites.json');

    // Read existing data
    const controllersData = await this.readControllersData(CONTROLLERS_FILE);
    const sitesData = await this.readSitesData(SITES_FILE);
    
    // Determine target site ID (pode ser undefined/null)
    let targetSiteId = registrationData.site_id || undefined;
    if (targetSiteId) {
      const site = sitesData.sites.find((s: any) => s.id === targetSiteId);
      if (!site) {
        targetSiteId = undefined; // Site não existe, deixar sem site
      }
    }

    // Check if controller already exists
    const existingController = controllersData.controllers.find(
      (c: Controller) => c.id === controllerId
    );

    if (existingController) {
      // Update existing controller
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

    // Create new controller
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

    // Add to controllers array
    controllersData.controllers.push(newController);
    await this.writeControllersData(CONTROLLERS_FILE, controllersData);

    // Update site's controllers list (somente se tiver site)
    if (targetSiteId) {
      const targetSite = sitesData.sites.find((s: any) => s.id === targetSiteId);
      if (targetSite) {
        if (!targetSite.controllers.includes(controllerId)) {
          targetSite.controllers.push(controllerId);
          targetSite.updatedAt = new Date().toISOString();
          await this.writeSitesData(SITES_FILE, sitesData);
        }
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

  private handleAdminCommandStream(stream: grpc.ServerDuplexStream<any, any>): void {
    // Future implementation for admin commands
    grpcServerLogger.info('Admin command stream connected (placeholder)');
    
    stream.on('data', (command) => {
      grpcServerLogger.info('Received admin command (placeholder):', command);
      // TODO: Implement admin command handling
    });

    stream.on('end', () => {
      grpcServerLogger.info('Admin command stream ended');
    });

    stream.on('error', (error) => {
      grpcServerLogger.error('Admin command stream error:', error);
    });
  }

  private sendErrorResponse(
    stream: grpc.ServerDuplexStream<any, any>, 
    controllerId: string, 
    errorCode: string, 
    errorMessage: string
  ): void {
    const response = createErrorResponse(
      controllerId, 
      errorCode, 
      errorMessage, 
      true
    );
    
    try {
      stream.write(response);
    } catch (error) {
      grpcServerLogger.error('Failed to send error response:', error);
    }
  }

  private generateConnectionId(): string {
    return `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private removeConnection(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (connection) {
      this.emit('controller_disconnected', connection.controllerId);
      
      // Emit event for health status updates
      this.emit('controller-disconnected', connection.controllerId);
      
      this.connections.delete(connectionId);
    }
  }

  private startConnectionCleanup(): void {
    this.heartbeatInterval = setInterval(() => {
      const now = new Date();
      const timeoutMs = 60000; // 1 minute timeout

      for (const [connectionId, connection] of this.connections.entries()) {
        if (now.getTime() - connection.lastHeartbeat.getTime() > timeoutMs) {
          grpcServerLogger.warn('Cleaning up stale connection', { 
            connectionId, 
            controllerId: connection.controllerId 
          });
          
          try {
            connection.stream.end();
          } catch (error) {
            grpcServerLogger.warn('Error ending stale connection:', error);
          }
          
          this.removeConnection(connectionId);
        }
      }
    }, 30000); // Check every 30 seconds
  }

  // File I/O helpers (similar to the existing REST endpoint)
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


  // Public methods for external access
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

  // ================================
  // Dashboard Sync Functions
  // ================================

  /**
   * Marca todos os controllers como pendentes de sync de dashboard
   */
  public async markAllControllersForSync(): Promise<void> {
    const CONTROLLERS_FILE = path.join(process.cwd(), 'data', 'controllers.json');
    const controllersData = await this.readControllersData(CONTROLLERS_FILE);
    const syncTimestamp = new Date().toISOString();

    // Marcar todos os controllers como pending
    controllersData.controllers.forEach((controller: any) => {
      controller.pendingDashboardSync = true;
      controller.dashboardSyncTimestamp = syncTimestamp;
    });

    await this.writeControllersData(CONTROLLERS_FILE, controllersData);
    
    grpcServerLogger.info('All controllers marked for dashboard sync', {
      controllersCount: controllersData.controllers.length,
      syncTimestamp
    });
  }

  /**
   * Faz broadcast de dashboard sync para todos os controllers conectados
   */
  public async broadcastDashboardSync(): Promise<void> {
    const dashboards = await this.loadDashboards();
    const syncTimestamp = new Date().toISOString();

    const dashboardSyncCommand = {
      command_id: this.generateConnectionId(),
      controller_id: 'broadcast',
      type: 'DASHBOARD_SYNC',
      timestamp: createTimestamp(),
      dashboard_sync: {
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

    let successCount = 0;
    let errorCount = 0;

    for (const [connectionId, connection] of this.connections.entries()) {
      if (connection.isRegistered) {
        try {
          // Personalizar comando para o controller específico
          const personalizedCommand = {
            ...dashboardSyncCommand,
            controller_id: connection.controllerId
          };

          connection.stream.write(personalizedCommand);
          
          // Marcar controller como não tendo pending sync
          await this.clearSyncFlag(connection.controllerId);
          successCount++;
          
          grpcServerLogger.debug('Dashboard sync sent to controller', {
            controllerId: connection.controllerId,
            dashboardsCount: dashboards.length
          });
        } catch (error) {
          errorCount++;
          grpcServerLogger.error('Failed to send dashboard sync to controller', {
            controllerId: connection.controllerId,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }
    }

    grpcServerLogger.info('Dashboard sync broadcast completed', {
      successCount,
      errorCount,
      totalDashboards: dashboards.length,
      syncTimestamp
    });
  }

  /**
   * Processa syncs pendentes para um controller específico quando ele reconecta
   */
  public async processPendingSyncs(controllerId: string): Promise<void> {
    const CONTROLLERS_FILE = path.join(process.cwd(), 'data', 'controllers.json');
    const controllersData = await this.readControllersData(CONTROLLERS_FILE);
    
    const controller: any = controllersData.controllers.find(c => c.id === controllerId);
    if (!controller || !controller.pendingDashboardSync) {
      return; // Nenhum sync pendente
    }

    grpcServerLogger.info('Processing pending dashboard sync', {
      controllerId,
      pendingSince: controller.dashboardSyncTimestamp
    });

    // Enviar dashboard sync para este controller específico
    const connection = Array.from(this.connections.values())
      .find(conn => conn.controllerId === controllerId && conn.isRegistered);
    
    if (connection) {
      const dashboards = await this.loadDashboards();
      const syncTimestamp = new Date().toISOString();

      const dashboardSyncCommand = {
        command_id: this.generateConnectionId(),
        controller_id: controllerId,
        type: 'DASHBOARD_SYNC',
        timestamp: createTimestamp(),
        dashboard_sync: {
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
        connection.stream.write(dashboardSyncCommand);
        await this.clearSyncFlag(controllerId);
        
        grpcServerLogger.info('Pending dashboard sync sent successfully', {
          controllerId,
          dashboardsCount: dashboards.length
        });
      } catch (error) {
        grpcServerLogger.error('Failed to send pending dashboard sync', {
          controllerId,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
  }

  /**
   * Remove a flag de pending sync de um controller específico
   */
  public async clearSyncFlag(controllerId: string): Promise<void> {
    const CONTROLLERS_FILE = path.join(process.cwd(), 'data', 'controllers.json');
    const controllersData = await this.readControllersData(CONTROLLERS_FILE);
    
    const controller: any = controllersData.controllers.find(c => c.id === controllerId);
    if (controller) {
      controller.pendingDashboardSync = false;
      controller.dashboardSyncTimestamp = null;
      await this.writeControllersData(CONTROLLERS_FILE, controllersData);
      
      grpcServerLogger.debug('Dashboard sync flag cleared', { controllerId });
    }
  }

  /**
   * Carrega dashboards do arquivo
   */
  private async loadDashboards(): Promise<any[]> {
    const DASHBOARDS_FILE = path.join(process.cwd(), 'data', 'dashboards.json');
    try {
      const data = await fs.readFile(DASHBOARDS_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      return Array.isArray(parsed) ? parsed : parsed.dashboards || [];
    } catch (error) {
      grpcServerLogger.error('Error loading dashboards for sync', { error });
      return [];
    }
  }

  // ================================
  // Cookie Sync Functions
  // ================================

  /**
   * Marca todos os controllers como pendentes de sync de cookies
   */
  public async markAllControllersForCookieSync(): Promise<void> {
    const CONTROLLERS_FILE = path.join(process.cwd(), 'data', 'controllers.json');
    const controllersData = await this.readControllersData(CONTROLLERS_FILE);
    const syncTimestamp = new Date().toISOString();

    // Marcar todos os controllers como pending cookie sync
    controllersData.controllers.forEach((controller: any) => {
      controller.pendingCookieSync = true;
      controller.cookieSyncTimestamp = syncTimestamp;
    });

    await this.writeControllersData(CONTROLLERS_FILE, controllersData);
    
    grpcServerLogger.info('All controllers marked for cookie sync', {
      controllersCount: controllersData.controllers.length,
      syncTimestamp
    });
  }

  /**
   * Faz broadcast de cookie sync para todos os controllers conectados
   */
  public async broadcastCookieSync(): Promise<void> {
    const cookiesData = await this.loadCookies();
    const syncTimestamp = new Date().toISOString();

    // Convert cookies data to gRPC format
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
      last_updated: createTimestamp()
    }));

    const cookieSyncCommand = {
      command_id: this.generateConnectionId(),
      controller_id: 'broadcast',
      type: 'COOKIE_SYNC',
      timestamp: createTimestamp(),
      cookie_sync: {
        cookie_domains: cookieDomains,
        sync_timestamp: syncTimestamp,
        sync_type: 'full'
      }
    };

    let successCount = 0;
    let errorCount = 0;

    for (const [connectionId, connection] of this.connections.entries()) {
      if (connection.isRegistered) {
        try {
          // Personalizar comando para o controller específico
          const personalizedCommand = {
            ...cookieSyncCommand,
            controller_id: connection.controllerId
          };

          connection.stream.write(personalizedCommand);
          
          // Marcar controller como não tendo pending cookie sync
          await this.clearCookieSyncFlag(connection.controllerId);
          successCount++;
          
          grpcServerLogger.debug('Cookie sync sent to controller', {
            controllerId: connection.controllerId,
            domainsCount: cookieDomains.length
          });
        } catch (error) {
          errorCount++;
          grpcServerLogger.error('Failed to send cookie sync to controller', {
            controllerId: connection.controllerId,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }
    }

    grpcServerLogger.info('Cookie sync broadcast completed', {
      successCount,
      errorCount,
      totalDomains: cookieDomains.length,
      syncTimestamp
    });
  }

  /**
   * Processa syncs pendentes de cookies para um controller específico quando ele reconecta
   */
  public async processPendingCookieSyncs(controllerId: string): Promise<void> {
    const CONTROLLERS_FILE = path.join(process.cwd(), 'data', 'controllers.json');
    const controllersData = await this.readControllersData(CONTROLLERS_FILE);
    
    const controller: any = controllersData.controllers.find(c => c.id === controllerId);
    if (!controller || !controller.pendingCookieSync) {
      return; // Nenhum sync pendente
    }

    grpcServerLogger.info('Processing pending cookie sync', {
      controllerId,
      pendingSince: controller.cookieSyncTimestamp
    });

    // Enviar cookie sync para este controller específico
    const connection = Array.from(this.connections.values())
      .find(conn => conn.controllerId === controllerId && conn.isRegistered);
    
    if (connection) {
      const cookiesData = await this.loadCookies();
      const syncTimestamp = new Date().toISOString();

      // Convert cookies data to gRPC format
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
        last_updated: createTimestamp()
      }));

      const cookieSyncCommand = {
        command_id: this.generateConnectionId(),
        controller_id: controllerId,
        type: 'COOKIE_SYNC',
        timestamp: createTimestamp(),
        cookie_sync: {
          cookie_domains: cookieDomains,
          sync_timestamp: syncTimestamp,
          sync_type: 'full'
        }
      };

      try {
        connection.stream.write(cookieSyncCommand);
        await this.clearCookieSyncFlag(controllerId);
        
        grpcServerLogger.info('Pending cookie sync sent successfully', {
          controllerId,
          domainsCount: cookieDomains.length
        });
      } catch (error) {
        grpcServerLogger.error('Failed to send pending cookie sync', {
          controllerId,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
  }

  /**
   * Remove a flag de pending cookie sync de um controller específico
   */
  public async clearCookieSyncFlag(controllerId: string): Promise<void> {
    const CONTROLLERS_FILE = path.join(process.cwd(), 'data', 'controllers.json');
    const controllersData = await this.readControllersData(CONTROLLERS_FILE);
    
    const controller: any = controllersData.controllers.find(c => c.id === controllerId);
    if (controller) {
      controller.pendingCookieSync = false;
      controller.cookieSyncTimestamp = null;
      await this.writeControllersData(CONTROLLERS_FILE, controllersData);
      
      grpcServerLogger.debug('Cookie sync flag cleared', { controllerId });
    }
  }

  /**
   * Carrega cookies do arquivo
   */
  private async loadCookies(): Promise<any> {
    const COOKIES_FILE = path.join(process.cwd(), 'data', 'cookies.json');
    try {
      const data = await fs.readFile(COOKIES_FILE, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      grpcServerLogger.error('Error loading cookies for sync', { error });
      return { domains: {}, lastUpdated: new Date().toISOString() };
    }
  }
}