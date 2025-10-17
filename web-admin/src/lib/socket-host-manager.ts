import { Server as SocketIOServer, Socket } from 'socket.io';
import { createContextLogger } from '@/utils/logger';
import { hostsRepository } from './repositories/HostsRepository';
import { broadcastHostEvent } from '@/pages/api/hosts/events';

const socketLogger = createContextLogger('socket-host-manager');

interface ConnectedHost {
  socket: Socket;
  agentId: string;
  connectedAt: Date;
  lastSeen: Date;
}

interface CommandRequest {
  commandId: string;
  type: string;
  payload?: any;
  targetDisplay?: string;
  timeout?: number;
}

interface CommandResponse {
  commandId: string;
  success: boolean;
  data?: any;
  error?: string;
  timestamp: Date;
}

class SocketHostManager {
  private io: SocketIOServer | null = null;
  private connectedHosts: Map<string, ConnectedHost> = new Map();
  private pendingCommands: Map<string, {
    resolve: (value: CommandResponse) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }> = new Map();

  initialize(io: SocketIOServer) {
    if (this.io) {
      socketLogger.warn('Socket.IO already initialized');
      return;
    }

    this.io = io;
    socketLogger.info('🔌 SocketHostManager initialized');

    // Setup host namespace
    const hostNamespace = io.of('/host');
    
    hostNamespace.on('connection', (socket) => {
      this.handleHostConnection(socket);
    });
  }

  private handleHostConnection(socket: Socket) {
    const agentId = socket.handshake.query.agentId as string;
    
    if (!agentId) {
      socketLogger.error('❌ Host connection rejected: missing agentId');
      socket.disconnect();
      return;
    }

    socketLogger.info('🟢 Host connected', { 
      agentId,
      totalConnected: this.connectedHosts.size + 1
    });

    // Register host
    this.connectedHosts.set(agentId, {
      socket,
      agentId,
      connectedAt: new Date(),
      lastSeen: new Date()
    });

    // Setup event handlers
    this.setupHostEventHandlers(socket, agentId);

    // Notify host is online (don't await to avoid blocking connection)
    this.broadcastHostStatus(agentId, 'online').catch(err => 
      socketLogger.error('Failed to broadcast host online status', { agentId, error: err })
    );
  }

  private setupHostEventHandlers(socket: Socket, agentId: string) {
    // Heartbeat event
    socket.on('heartbeat', async (data) => {
      await this.handleHeartbeat(agentId, data);
    });

    // Command response
    socket.on('command:response', (response: CommandResponse) => {
      this.handleCommandResponse(response);
    });

    // Metrics update
    socket.on('metrics', (metrics) => {
      this.handleMetrics(agentId, metrics);
    });

    // Log stream
    socket.on('logs', (logData) => {
      this.handleLogs(agentId, logData);
    });

    // Disconnect
    socket.on('disconnect', () => {
      this.handleHostDisconnect(agentId);
    });

    // Error
    socket.on('error', (error) => {
      socketLogger.error('Socket error', { agentId, error });
    });
  }

  private async handleHeartbeat(agentId: string, data: any) {
    const host = this.connectedHosts.get(agentId);
    
    if (!host) {
      socketLogger.warn('⚠️ Heartbeat from unregistered host', { 
        agentId,
        registeredHosts: Array.from(this.connectedHosts.keys())
      });
      return;
    }

    host.lastSeen = new Date();

    try {
      // Check if host exists in database
      const existingHost = await hostsRepository.getByAgentId(agentId);
      
      if (!existingHost) {
        // Auto-register new host on first heartbeat
        socketLogger.info('🆕 Auto-registering new host', { agentId });
        
        const newHost = await hostsRepository.create({
          agentId: agentId,
          hostname: data.hostname || agentId,
          ipAddress: '0.0.0.0', // Not used with Socket.IO
          grpcPort: 0, // Not used anymore
          displays: data.displays || [],
          systemInfo: data.systemInfo || {},
          version: data.version || '1.0.0',
          status: 'online',
          lastSeen: new Date().toISOString()
        });
        
        socketLogger.info('✅ Host auto-registered', { agentId });
        
        // Broadcast new host registration
        broadcastHostEvent({
          type: 'host_registered',
          host: newHost
        });
      } else {
        // Update existing host
        await hostsRepository.update(agentId, {
          lastSeen: new Date().toISOString(),
          displays: data.displays,
          systemInfo: data.systemInfo,
          metrics: data.metrics,
          version: data.version,
          status: 'online',
          hostname: data.hostname || existingHost.hostname
        });
      }

      // Acknowledge heartbeat
      host.socket.emit('heartbeat:ack', { 
        timestamp: new Date().toISOString() 
      });

      // Broadcast update to web clients (SSE + Socket.IO)
      await this.broadcastHostUpdate(agentId);

    } catch (error) {
      socketLogger.error('Failed to process heartbeat', { agentId, error });
    }
  }

  private handleCommandResponse(response: CommandResponse) {
    const pending = this.pendingCommands.get(response.commandId);
    
    if (!pending) {
      socketLogger.warn('Received response for unknown command', { 
        commandId: response.commandId 
      });
      return;
    }

    clearTimeout(pending.timeout);
    this.pendingCommands.delete(response.commandId);

    if (response.success) {
      pending.resolve(response);
    } else {
      pending.reject(new Error(response.error || 'Command failed'));
    }
  }

  private handleMetrics(agentId: string, metrics: any) {
    // Broadcast to web clients (for real-time dashboard)
    if (this.io) {
      this.io.emit('host:metrics', {
        agentId,
        metrics,
        timestamp: new Date().toISOString()
      });
    }
  }

  private handleLogs(agentId: string, logData: any) {
    // Broadcast to web clients (for real-time log viewer)
    if (this.io && logData.logs?.length > 0) {
      this.io.emit('host:logs', {
        agentId,
        logs: logData.logs,
        timestamp: logData.timestamp
      });
    }
  }

  private async handleHostDisconnect(agentId: string) {
    socketLogger.info('🔴 Host disconnected', { agentId });
    
    this.connectedHosts.delete(agentId);
    await this.broadcastHostStatus(agentId, 'offline');
  }

  private async broadcastHostStatus(agentId: string, status: 'online' | 'offline') {
    try {
      // Update host status in database
      await hostsRepository.update(agentId, {
        status,
        lastSeen: new Date().toISOString()
      });
      
      // Get updated host data
      const updatedHost = await hostsRepository.getByAgentId(agentId);
      
      if (updatedHost) {
        // Broadcast via SSE
        broadcastHostEvent({
          type: status === 'online' ? 'host_connected' : 'host_disconnected',
          host: updatedHost
        });
      }
      
      // Also broadcast via Socket.IO
      if (this.io) {
        this.io.emit('host:status', {
          agentId,
          status,
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      socketLogger.error('Failed to broadcast host status', { agentId, status, error });
    }
  }

  private async broadcastHostUpdate(agentId: string) {
    try {
      socketLogger.info('📢 Broadcasting host update', { agentId });
      
      // Get updated host data from database
      const updatedHost = await hostsRepository.getByAgentId(agentId);
      
      if (updatedHost) {
        socketLogger.info('📡 Sending SSE broadcast', { 
          agentId, 
          type: 'host_updated',
          hasDisplays: updatedHost.displays?.length || 0
        });
        
        // Broadcast via SSE (for web UI)
        broadcastHostEvent({
          type: 'host_updated',
          host: updatedHost
        });
        
        socketLogger.info('✅ SSE broadcast sent');
      } else {
        socketLogger.warn('⚠️ Host not found in DB for broadcast', { agentId });
      }
      
      // Also broadcast via Socket.IO (for real-time components)
      if (this.io) {
        this.io.emit('host:updated', {
          agentId,
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      socketLogger.error('Failed to broadcast host update', { agentId, error });
    }
  }

  // Public API for sending commands
  async sendCommand(agentId: string, command: CommandRequest): Promise<CommandResponse> {
    const host = this.connectedHosts.get(agentId);
    
    if (!host) {
      throw new Error(`Host ${agentId} is not connected`);
    }

    const commandId = command.commandId || `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const timeout = command.timeout || 30000;

    socketLogger.info('📤 Sending command', {
      agentId,
      type: command.type
    });

    return new Promise((resolve, reject) => {
      // Setup timeout
      const timeoutHandle = setTimeout(() => {
        this.pendingCommands.delete(commandId);
        socketLogger.error('⏰ Command timeout', {
          agentId,
          type: command.type,
          timeoutMs: timeout
        });
        reject(new Error(`Command timeout after ${timeout}ms`));
      }, timeout);

      // Store pending command
      this.pendingCommands.set(commandId, {
        resolve,
        reject,
        timeout: timeoutHandle
      });

      // Send command to host
      host.socket.emit('command', {
        commandId,
        type: command.type,
        payload: command.payload,
        targetDisplay: command.targetDisplay,
        timestamp: new Date().toISOString()
      });
    });
  }

  // Check if host is connected
  isHostConnected(agentId: string): boolean {
    return this.connectedHosts.has(agentId);
  }

  // Get connected hosts list
  getConnectedHosts(): string[] {
    return Array.from(this.connectedHosts.keys());
  }

  // Get connection info
  getHostConnection(agentId: string): ConnectedHost | undefined {
    return this.connectedHosts.get(agentId);
  }
}

// Global singleton instance (survives HMR in development)
declare global {
  var __socketHostManagerSingleton: SocketHostManager | undefined;
}

// Singleton instance - reuse across HMR
export const socketHostManager = (() => {
  if (global.__socketHostManagerSingleton) {
    return global.__socketHostManagerSingleton;
  }
  
  const instance = new SocketHostManager();
  global.__socketHostManagerSingleton = instance;
  return instance;
})();

