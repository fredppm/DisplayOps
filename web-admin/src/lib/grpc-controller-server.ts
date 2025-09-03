import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { join } from 'path';
import { EventEmitter } from 'events';
import fs from 'fs/promises';
import path from 'path';
// Using proto-loader runtime types (no static TypeScript types)
import { Controller } from '@/types/multi-site-types';
import { logger } from '@/utils/logger';

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
  private server: grpc.Server;
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

      logger.info('gRPC ControllerAdminServer initialized', { port: this.port });
    } catch (error) {
      logger.error('Failed to setup gRPC server:', error);
      throw error;
    }
  }

  public async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      const serverCredentials = grpc.ServerCredentials.createInsecure();
      
      this.server.bindAsync(`0.0.0.0:${this.port}`, serverCredentials, (error, port) => {
        if (error) {
          logger.error('Failed to bind gRPC server:', error);
          reject(error);
          return;
        }

        this.server.start();
        logger.info(`gRPC ControllerAdminServer started on port ${port}`);
        
        // Start connection cleanup interval
        this.startConnectionCleanup();
        
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
          logger.warn('Error closing connection:', error);
        }
      });
      this.connections.clear();

      this.server.tryShutdown((error) => {
        if (error) {
          logger.error('Error during server shutdown:', error);
        } else {
          logger.info('gRPC ControllerAdminServer stopped');
        }
        resolve();
      });
    });
  }

  private handleHeartbeatStream(stream: grpc.ServerDuplexStream<any, any>): void {
    const connectionId = this.generateConnectionId();
    logger.info('New controller heartbeat stream connected', { connectionId });

    let controllerConnection: ControllerConnection | null = null;

    stream.on('data', async (heartbeat: ControllerHeartbeat) => {
      try {
        await this.processHeartbeat(heartbeat, stream, connectionId);
        
        // Update connection info
        if (controllerConnection) {
          controllerConnection.lastHeartbeat = new Date();
        }
      } catch (error) {
        logger.error('Error processing heartbeat:', error);
        this.sendErrorResponse(stream, heartbeat.controller_id, 'PROCESSING_ERROR', 
          `Error processing heartbeat: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    });

    stream.on('end', () => {
      logger.info('Controller heartbeat stream ended', { connectionId });
      this.removeConnection(connectionId);
    });

    stream.on('error', (error) => {
      logger.error('Controller heartbeat stream error:', { connectionId, error });
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
      logger.error('Connection not found for heartbeat', { connectionId });
      return;
    }

    // Update connection controller ID
    connection.controllerId = heartbeat.controller_id;

    if (heartbeat.type === 'REGISTRATION') {
      await this.handleRegistration(heartbeat, stream, connection);
    } else if (heartbeat.type === 'STATUS_UPDATE') {
      await this.handleStatusUpdate(heartbeat, stream, connection);
    } else {
      logger.warn('Unknown heartbeat type received', { 
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
      logger.error('Registration heartbeat missing registration data', { controller_id });
      this.sendErrorResponse(stream, controller_id, 'MISSING_DATA', 'Registration data is required');
      return;
    }

    logger.info('Processing controller registration', { 
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
      
      logger.info('Controller registration successful', { 
        controller_id: controller.id,
        name: controller.name,
        siteId: controller.siteId
      });

    } catch (error) {
      logger.error('Controller registration failed:', error);
      
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
      logger.warn('Status update from unregistered controller', { controller_id });
      this.sendErrorResponse(stream, controller_id, 'NOT_REGISTERED', 
        'Controller must complete registration first');
      return;
    }

    if (!statusData) {
      logger.error('Status heartbeat missing status data', { controller_id });
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

    } catch (error) {
      logger.error('Failed to update controller status:', error);
      this.sendErrorResponse(stream, controller_id, 'UPDATE_ERROR', 
        `Failed to update status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async registerController(controllerId: string, registrationData: any): Promise<Controller> {
    const CONTROLLERS_FILE = path.join(process.cwd(), 'data', 'controllers.json');
    const SITES_FILE = path.join(process.cwd(), 'data', 'sites.json');
    const AUTO_DISCOVERED_SITE_ID = 'auto-discovered';

    // Read existing data
    const controllersData = await this.readControllersData(CONTROLLERS_FILE);
    const sitesData = await this.readSitesData(SITES_FILE);

    // Ensure auto-discovered site exists
    await this.ensureAutoDiscoveredSite(sitesData, SITES_FILE);
    
    // Determine target site ID
    let targetSiteId = registrationData.site_id || AUTO_DISCOVERED_SITE_ID;
    const site = sitesData.sites.find((s: any) => s.id === targetSiteId);
    if (!site) {
      targetSiteId = AUTO_DISCOVERED_SITE_ID;
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

    // Update site's controllers list
    const targetSite = sitesData.sites.find((s: any) => s.id === targetSiteId);
    if (targetSite) {
      if (!targetSite.controllers.includes(controllerId)) {
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

  private handleAdminCommandStream(stream: grpc.ServerDuplexStream<any, any>): void {
    // Future implementation for admin commands
    logger.info('Admin command stream connected (placeholder)');
    
    stream.on('data', (command) => {
      logger.info('Received admin command (placeholder):', command);
      // TODO: Implement admin command handling
    });

    stream.on('end', () => {
      logger.info('Admin command stream ended');
    });

    stream.on('error', (error) => {
      logger.error('Admin command stream error:', error);
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
      logger.error('Failed to send error response:', error);
    }
  }

  private generateConnectionId(): string {
    return `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private removeConnection(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (connection) {
      this.emit('controller_disconnected', connection.controllerId);
      this.connections.delete(connectionId);
    }
  }

  private startConnectionCleanup(): void {
    this.heartbeatInterval = setInterval(() => {
      const now = new Date();
      const timeoutMs = 60000; // 1 minute timeout

      for (const [connectionId, connection] of this.connections.entries()) {
        if (now.getTime() - connection.lastHeartbeat.getTime() > timeoutMs) {
          logger.warn('Cleaning up stale connection', { 
            connectionId, 
            controllerId: connection.controllerId 
          });
          
          try {
            connection.stream.end();
          } catch (error) {
            logger.warn('Error ending stale connection:', error);
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

  private async ensureAutoDiscoveredSite(sitesData: { sites: any[] }, filePath: string): Promise<void> {
    const AUTO_DISCOVERED_SITE_ID = 'auto-discovered';
    const autoSite = sitesData.sites.find(s => s.id === AUTO_DISCOVERED_SITE_ID);
    
    if (!autoSite) {
      sitesData.sites.push({
        id: AUTO_DISCOVERED_SITE_ID,
        name: 'Auto-Discovered Controllers',
        location: 'Various Locations',
        timezone: 'America/Sao_Paulo',
        controllers: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      await this.writeSitesData(filePath, sitesData);
    }
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
}