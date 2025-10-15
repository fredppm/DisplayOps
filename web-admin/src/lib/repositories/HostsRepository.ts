import { createContextLogger } from '@/utils/logger';
import { DatabaseConnection } from '@/lib/database';
import fs from 'fs';
import path from 'path';

const hostsRepoLogger = createContextLogger('hosts-repository');

export interface Host {
  id: string; // Legacy field, kept for backward compatibility (will be same as agentId)
  agentId: string; // Primary identifier (e.g., "agent-vtex-b9lh6z3")
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
  metrics?: {
    cpuUsagePercent: number;
    memoryUsagePercent: number;
    memoryUsedGB: number;
    memoryTotalGB: number;
  };
  version: string;
  status: 'online' | 'offline' | 'error'; // Computed property (not stored in DB)
  lastSeen: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Calculate host status based on last seen timestamp
 * @param lastSeen - ISO timestamp string
 * @returns 'online' if seen < 2 minutes ago, 'offline' otherwise
 */
export function getHostStatus(lastSeen: string): 'online' | 'offline' {
  try {
    const lastSeenDate = new Date(lastSeen);
    const now = new Date();
    const diffMs = now.getTime() - lastSeenDate.getTime();
    const diffMinutes = diffMs / 1000 / 60;
    
    // Consider online if seen within last 2 minutes
    return diffMinutes < 2 ? 'online' : 'offline';
  } catch {
    return 'offline';
  }
}

// Global singleton instance for Next.js hot-reload compatibility
declare global {
  var __hostsRepositoryInstance: HostsRepository | undefined;
}

class HostsRepository {
  private usePostgres: boolean = false;
  private db: DatabaseConnection | null = null;
  private hosts: Map<string, Host> = new Map();
  private dataFile: string;
  private saveTimeout: NodeJS.Timeout | null = null;
  private isInitialized: boolean = false;

  constructor() {
    // Setup file-based storage as fallback
    const dataDir = process.env.DATA_DIR || path.join(process.cwd(), 'data');
    this.dataFile = path.join(dataDir, 'hosts.json');
    
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    hostsRepoLogger.debug('🏗️ HostsRepository instance created');

    // Try to initialize PostgreSQL
    this.initializeStorage();
  }

  private async initializeStorage(): Promise<void> {
    if (this.isInitialized) {
      hostsRepoLogger.debug('Storage already initialized, skipping');
      return;
    }

    // Check if PostgreSQL is configured
    const hasPostgres = process.env.POSTGRES_HOST || process.env.DATABASE_URL;
    
    if (hasPostgres) {
      try {
        this.db = DatabaseConnection.getInstance();
        // Test connection with a simple query
        await this.db.query('SELECT 1');
        this.usePostgres = true;
        this.isInitialized = true;
        hostsRepoLogger.info('🐘 Using PostgreSQL for hosts storage');
      } catch (error) {
        hostsRepoLogger.warn('⚠️ PostgreSQL not available, falling back to JSON', { 
          error: error instanceof Error ? error.message : String(error) 
        });
        this.usePostgres = false;
        this.loadFromFile();
        this.isInitialized = true;
      }
    } else {
      hostsRepoLogger.info('📄 Using JSON file for hosts storage (no PostgreSQL configured)');
      this.usePostgres = false;
      this.loadFromFile();
      this.isInitialized = true;
    }
  }

  // JSON file methods
  private loadFromFile(): void {
    try {
      if (fs.existsSync(this.dataFile)) {
        const data = fs.readFileSync(this.dataFile, 'utf-8');
        const hostsArray: Host[] = JSON.parse(data);
        this.hosts = new Map(hostsArray.map(host => [host.id, host]));
        hostsRepoLogger.info('📂 Loaded hosts from JSON', { count: this.hosts.size });
      }
    } catch (error) {
      hostsRepoLogger.error('❌ Failed to load hosts from JSON:', error);
      this.hosts = new Map();
    }
  }

  private saveToFile(): void {
    if (this.usePostgres) return; // Don't save to file if using PostgreSQL

    if (this.saveTimeout) clearTimeout(this.saveTimeout);
    
    this.saveTimeout = setTimeout(() => {
      try {
        const hostsArray = Array.from(this.hosts.values());
        fs.writeFileSync(this.dataFile, JSON.stringify(hostsArray, null, 2), 'utf-8');
        hostsRepoLogger.debug('💾 Saved hosts to JSON');
      } catch (error) {
        hostsRepoLogger.error('❌ Failed to save hosts to JSON:', error);
      }
    }, 500);
  }

  // PostgreSQL methods
  private mapRowToHost(row: any): Host {
    return {
      id: row.agent_id, // Use agent_id as the primary ID
      agentId: row.agent_id,
      hostname: row.hostname,
      ipAddress: row.ip_address,
      grpcPort: row.grpc_port,
      displays: row.displays || [],
      systemInfo: row.system_info || {},
      metrics: row.metrics || undefined,
      version: row.version,
      status: getHostStatus(row.last_seen), // Calculate status dynamically
      lastSeen: row.last_seen,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  async create(hostData: Omit<Host, 'id' | 'createdAt' | 'updatedAt'>): Promise<Host> {
    // Use agentId as the primary ID
    const id = hostData.agentId;
    const now = new Date().toISOString();
    
    const host: Host = {
      id,
      ...hostData,
      status: getHostStatus(hostData.lastSeen), // Calculate status dynamically
      createdAt: now,
      updatedAt: now
    };

    if (this.usePostgres && this.db) {
      try {
        const result = await this.db.query(
          `INSERT INTO hosts (id, agent_id, hostname, ip_address, grpc_port, displays, system_info, version, status, last_seen, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
           RETURNING *`,
          [
            host.id,
            host.agentId,
            host.hostname,
            host.ipAddress,
            host.grpcPort,
            JSON.stringify(host.displays),
            JSON.stringify(host.systemInfo),
            host.version,
            host.status,
            host.lastSeen,
            host.createdAt,
            host.updatedAt
          ]
        );
        
        hostsRepoLogger.info('✅ Host created in PostgreSQL', { hostId: id, agentId: hostData.agentId });
        return this.mapRowToHost(result.rows[0]);
      } catch (error) {
        hostsRepoLogger.error('❌ Failed to create host in PostgreSQL:', error);
        throw error;
      }
    } else {
      // JSON fallback
      this.hosts.set(id, host);
      this.saveToFile();
      hostsRepoLogger.info('✅ Host created in JSON', { hostId: id, agentId: hostData.agentId });
      return host;
    }
  }

  async getById(id: string): Promise<Host | null> {
    if (this.usePostgres && this.db) {
      try {
        // Search by agent_id (which is the primary identifier)
        const result = await this.db.query('SELECT * FROM hosts WHERE agent_id = $1', [id]);
        return result.rows.length > 0 ? this.mapRowToHost(result.rows[0]) : null;
      } catch (error) {
        hostsRepoLogger.error('❌ Failed to get host from PostgreSQL:', error);
        return null;
      }
    } else {
      const host = this.hosts.get(id);
      if (!host) return null;
      
      // Calculate status dynamically
      return {
        ...host,
        status: getHostStatus(host.lastSeen)
      };
    }
  }

  async getByAgentId(agentId: string): Promise<Host | null> {
    if (this.usePostgres && this.db) {
      try {
        const result = await this.db.query('SELECT * FROM hosts WHERE agent_id = $1', [agentId]);
        return result.rows.length > 0 ? this.mapRowToHost(result.rows[0]) : null;
      } catch (error) {
        hostsRepoLogger.error('❌ Failed to get host by agentId from PostgreSQL:', error);
        return null;
      }
    } else {
      for (const host of this.hosts.values()) {
        if (host.agentId === agentId) {
          // Calculate status dynamically
          return {
            ...host,
            status: getHostStatus(host.lastSeen)
          };
        }
      }
      return null;
    }
  }

  async getAll(): Promise<Host[]> {
    if (this.usePostgres && this.db) {
      try {
        const result = await this.db.query('SELECT * FROM hosts ORDER BY created_at DESC');
        return result.rows.map((row: any) => this.mapRowToHost(row));
      } catch (error) {
        hostsRepoLogger.error('❌ Failed to get all hosts from PostgreSQL:', error);
        return [];
      }
    } else {
      // For JSON storage, also calculate status dynamically
      return Array.from(this.hosts.values()).map(host => ({
        ...host,
        status: getHostStatus(host.lastSeen)
      }));
    }
  }

  async update(id: string, updateData: Partial<Host>): Promise<Host | null> {
    if (this.usePostgres && this.db) {
      try {
        const setClauses: string[] = [];
        const values: any[] = [];
        let paramCount = 1;

        if (updateData.hostname !== undefined) {
          setClauses.push(`hostname = $${paramCount++}`);
          values.push(updateData.hostname);
        }
        if (updateData.ipAddress !== undefined) {
          setClauses.push(`ip_address = $${paramCount++}`);
          values.push(updateData.ipAddress);
        }
        if (updateData.grpcPort !== undefined) {
          setClauses.push(`grpc_port = $${paramCount++}`);
          values.push(updateData.grpcPort);
        }
        if (updateData.displays !== undefined) {
          setClauses.push(`displays = $${paramCount++}`);
          values.push(JSON.stringify(updateData.displays));
        }
        if (updateData.systemInfo !== undefined) {
          setClauses.push(`system_info = $${paramCount++}`);
          values.push(JSON.stringify(updateData.systemInfo));
        }
        if (updateData.metrics !== undefined) {
          setClauses.push(`metrics = $${paramCount++}`);
          values.push(JSON.stringify(updateData.metrics));
        }
        if (updateData.version !== undefined) {
          setClauses.push(`version = $${paramCount++}`);
          values.push(updateData.version);
        }
        // Note: status is NOT saved - it's calculated from lastSeen
        if (updateData.lastSeen !== undefined) {
          setClauses.push(`last_seen = $${paramCount++}`);
          values.push(updateData.lastSeen);
        }

        setClauses.push(`updated_at = $${paramCount++}`);
        values.push(new Date().toISOString());
        values.push(id);

        // Update by agent_id (the primary identifier)
        const query = `UPDATE hosts SET ${setClauses.join(', ')} WHERE agent_id = $${paramCount} RETURNING *`;
        const result = await this.db.query(query, values);
        
        if (result.rows.length === 0) return null;

        const isSignificantUpdate = updateData.ipAddress || updateData.version;
        if (isSignificantUpdate) {
          hostsRepoLogger.info('🔄 Host updated in PostgreSQL (significant)', { hostId: id });
        }
        
        return this.mapRowToHost(result.rows[0]);
      } catch (error) {
        hostsRepoLogger.error('❌ Failed to update host in PostgreSQL:', error);
        return null;
      }
    } else {
      // JSON fallback
      const existingHost = this.hosts.get(id);
      if (!existingHost) return null;

      // Don't save status - it will be calculated dynamically
      const { status, ...updateDataWithoutStatus } = updateData;

      const updatedHost: Host = {
        ...existingHost,
        ...updateDataWithoutStatus,
        status: getHostStatus(updateData.lastSeen || existingHost.lastSeen), // Calculate dynamically
        updatedAt: new Date().toISOString()
      };

      this.hosts.set(id, updatedHost);
      this.saveToFile();

      const isSignificantUpdate = updateData.ipAddress || updateData.version;
      if (isSignificantUpdate) {
        hostsRepoLogger.info('🔄 Host updated in JSON (significant)', { hostId: id });
      }

      return updatedHost;
    }
  }

  async delete(id: string): Promise<boolean> {
    if (this.usePostgres && this.db) {
      try {
        // Delete by agent_id (the primary identifier)
        const result = await this.db.query('DELETE FROM hosts WHERE agent_id = $1', [id]);
        const deleted = result.rowCount > 0;
        if (deleted) {
          hostsRepoLogger.info('🗑️ Host deleted from PostgreSQL', { agentId: id });
        }
        return deleted;
      } catch (error) {
        hostsRepoLogger.error('❌ Failed to delete host from PostgreSQL:', error);
        return false;
      }
    } else {
      const deleted = this.hosts.delete(id);
      if (deleted) {
        this.saveToFile();
        hostsRepoLogger.info('🗑️ Host deleted from JSON', { agentId: id });
      }
      return deleted;
    }
  }

  async markOffline(agentId: string): Promise<void> {
    const host = await this.getByAgentId(agentId);
    if (host) {
      // Only update lastSeen - status will be calculated automatically
      await this.update(host.id, { 
        lastSeen: new Date(Date.now() - 5 * 60 * 1000).toISOString() // 5 minutes ago to ensure offline
      });
    }
  }

  async cleanupOfflineHosts(timeoutMinutes: number = 30): Promise<void> {
    const cutoffTime = new Date(Date.now() - timeoutMinutes * 60 * 1000);

    if (this.usePostgres && this.db) {
      try {
        // Delete hosts that haven't been seen for longer than timeout
        const result = await this.db.query(
          "DELETE FROM hosts WHERE last_seen < $1 RETURNING agent_id",
          [cutoffTime.toISOString()]
        );
        if (result.rowCount > 0) {
          hostsRepoLogger.info('🧹 Cleaned up offline hosts from PostgreSQL', { count: result.rowCount });
        }
      } catch (error) {
        hostsRepoLogger.error('❌ Failed to cleanup hosts in PostgreSQL:', error);
      }
    } else {
      const hostsToRemove: string[] = [];
      for (const [id, host] of this.hosts.entries()) {
        // Check if host hasn't been seen for longer than timeout
        if (new Date(host.lastSeen) < cutoffTime) {
          hostsToRemove.push(id);
        }
      }

      if (hostsToRemove.length > 0) {
        for (const id of hostsToRemove) {
          this.hosts.delete(id);
        }
        this.saveToFile();
        hostsRepoLogger.info('🧹 Cleaned up offline hosts from JSON', { count: hostsToRemove.length });
      }
    }
  }

  forceSave(): void {
    if (!this.usePostgres) {
      if (this.saveTimeout) {
        clearTimeout(this.saveTimeout);
        this.saveTimeout = null;
      }
      
      try {
        const hostsArray = Array.from(this.hosts.values());
        fs.writeFileSync(this.dataFile, JSON.stringify(hostsArray, null, 2), 'utf-8');
        hostsRepoLogger.info('💾 Force saved hosts to JSON', { count: hostsArray.length });
      } catch (error) {
        hostsRepoLogger.error('❌ Failed to force save hosts:', error);
      }
    }
  }
}

// Export singleton instance with Next.js hot-reload support
function getHostsRepository(): HostsRepository {
  if (!global.__hostsRepositoryInstance) {
    hostsRepoLogger.info('🌍 Creating GLOBAL singleton HostsRepository instance');
    global.__hostsRepositoryInstance = new HostsRepository();
    
    // Setup cleanup handlers
    process.on('SIGTERM', () => global.__hostsRepositoryInstance?.forceSave());
    process.on('SIGINT', () => global.__hostsRepositoryInstance?.forceSave());
  } else {
    hostsRepoLogger.debug('♻️ Reusing existing GLOBAL HostsRepository instance');
  }
  
  return global.__hostsRepositoryInstance;
}

export const hostsRepository = getHostsRepository();
