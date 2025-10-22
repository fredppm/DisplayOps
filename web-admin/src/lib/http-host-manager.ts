import { createContextLogger } from '@/utils/logger';
import { hostsRepository } from './repositories/HostsRepository';
import { enqueueCommand } from '@/pages/api/hosts/commands/pending';
import { waitForCommandResponse } from '@/pages/api/hosts/commands/response';

const logger = createContextLogger('http-host-manager');

interface CommandRequest {
  commandId?: string;
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
  timestamp: string;
}

/**
 * HTTP-based Host Manager
 * Replaces Socket.IO SocketHostManager
 * 
 * Hosts poll for commands via HTTP GET
 * Hosts send responses via HTTP POST
 */
class HttpHostManager {
  /**
   * Send command to a host
   * Command is enqueued and host will pick it up on next poll
   */
  async sendCommand(agentId: string, command: CommandRequest): Promise<CommandResponse> {
    // Check if host exists and is online
    const host = await hostsRepository.getByAgentId(agentId);
    
    if (!host) {
      throw new Error(`Host ${agentId} not found`);
    }

    if (host.status !== 'online') {
      throw new Error(`Host ${agentId} is offline`);
    }

    const commandId = command.commandId || `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const timeout = command.timeout || 10000; // Reduced default timeout from 30s to 10s

    logger.info('📤 Enqueuing command for host', {
      agentId,
      commandId,
      type: command.type,
      payload: command.payload,
      targetDisplay: command.targetDisplay
    });

    // Enqueue command (host will poll for it)
    const enqueuedCommand = {
      commandId,
      type: command.type,
      payload: command.payload,
      targetDisplay: command.targetDisplay,
      timestamp: new Date().toISOString()
    };
    
    logger.info('🔧 About to enqueue command', { enqueuedCommand });
    enqueueCommand(agentId, enqueuedCommand);
    logger.info('🔧 Command enqueued, waiting for response...');

    // Wait for response (with timeout)
    try {
      const response = await waitForCommandResponse(commandId, timeout);
      
      logger.info('✅ Command response received', {
        agentId,
        commandId,
        success: response.success
      });

      return response;
    } catch (error) {
      logger.error('❌ Command timeout or error', {
        agentId,
        commandId,
        error
      });
      throw error;
    }
  }

  /**
   * Check if host is online (based on last heartbeat)
   */
  async isHostConnected(agentId: string): Promise<boolean> {
    const host = await hostsRepository.getByAgentId(agentId);
    
    if (!host || host.status !== 'online') {
      return false;
    }

    // Check if last heartbeat was recent (within 2 minutes)
    const lastSeen = new Date(host.lastSeen);
    const now = new Date();
    const diffMs = now.getTime() - lastSeen.getTime();
    const diffMinutes = diffMs / (1000 * 60);

    return diffMinutes < 2;
  }

  /**
   * Get list of online hosts
   */
  async getConnectedHosts(): Promise<string[]> {
    const allHosts = await hostsRepository.getAll();
    const connectedHosts: string[] = [];

    for (const host of allHosts) {
      if (await this.isHostConnected(host.agentId)) {
        connectedHosts.push(host.agentId);
      }
    }

    return connectedHosts;
  }
}

// Global singleton instance
declare global {
  var __httpHostManagerSingleton: HttpHostManager | undefined;
}

export const httpHostManager = (() => {
  if (global.__httpHostManagerSingleton) {
    return global.__httpHostManagerSingleton;
  }
  
  const instance = new HttpHostManager();
  global.__httpHostManagerSingleton = instance;
  return instance;
})();

