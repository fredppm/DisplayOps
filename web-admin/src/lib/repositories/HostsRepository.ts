import { createContextLogger } from '@/utils/logger';

const hostsRepoLogger = createContextLogger('hosts-repository');

export interface Host {
  id: string;
  agentId: string;
  hostname: string;
  ipAddress: string;
  grpcPort: number;
  displays: Array<{
    id: string;
    name: string;
    width: number;
    height: number;
    isPrimary: boolean;
  }>;
  systemInfo: {
    platform: string;
    arch: string;
    nodeVersion: string;
    electronVersion: string;
    totalMemoryGB: number;
    cpuCores: number;
    cpuModel: string;
    uptime: number;
  };
  version: string;
  status: 'online' | 'offline';
  lastSeen: string;
  createdAt: string;
  updatedAt: string;
}

class HostsRepository {
  private hosts: Map<string, Host> = new Map();

  async create(hostData: Omit<Host, 'id' | 'createdAt' | 'updatedAt'>): Promise<Host> {
    const id = `host_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();
    
    const host: Host = {
      id,
      ...hostData,
      createdAt: now,
      updatedAt: now
    };

    this.hosts.set(id, host);
    hostsRepoLogger.info('✅ Host created', { hostId: id, agentId: hostData.agentId });
    
    return host;
  }

  async getById(id: string): Promise<Host | null> {
    return this.hosts.get(id) || null;
  }

  async getByAgentId(agentId: string): Promise<Host | null> {
    for (const host of this.hosts.values()) {
      if (host.agentId === agentId) {
        return host;
      }
    }
    return null;
  }

  async getAll(): Promise<Host[]> {
    return Array.from(this.hosts.values());
  }

  async update(id: string, updateData: Partial<Host>): Promise<Host | null> {
    const existingHost = this.hosts.get(id);
    if (!existingHost) {
      return null;
    }

    const updatedHost: Host = {
      ...existingHost,
      ...updateData,
      updatedAt: new Date().toISOString()
    };

    this.hosts.set(id, updatedHost);
    hostsRepoLogger.info('🔄 Host updated', { hostId: id });
    
    return updatedHost;
  }

  async delete(id: string): Promise<boolean> {
    const deleted = this.hosts.delete(id);
    if (deleted) {
      hostsRepoLogger.info('🗑️ Host deleted', { hostId: id });
    }
    return deleted;
  }

  async markOffline(agentId: string): Promise<void> {
    const host = await this.getByAgentId(agentId);
    if (host) {
      await this.update(host.id, { 
        status: 'offline',
        lastSeen: new Date().toISOString()
      });
    }
  }

  async cleanupOfflineHosts(timeoutMinutes: number = 30): Promise<void> {
    const cutoffTime = new Date(Date.now() - timeoutMinutes * 60 * 1000);
    const hostsToRemove: string[] = [];

    for (const [id, host] of this.hosts.entries()) {
      if (host.status === 'offline' && new Date(host.lastSeen) < cutoffTime) {
        hostsToRemove.push(id);
      }
    }

    for (const id of hostsToRemove) {
      this.hosts.delete(id);
      hostsRepoLogger.info('🧹 Cleaned up offline host', { hostId: id });
    }
  }
}

export const hostsRepository = new HostsRepository();

