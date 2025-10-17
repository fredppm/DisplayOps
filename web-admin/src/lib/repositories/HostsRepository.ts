import { createContextLogger } from '@/utils/logger';
import { DatabaseConnection } from '@/lib/database';

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
    assignedDashboard?: {
      id: string;
      url: string;
      refreshInterval?: number;
      lastNavigation?: string;
      isResponsive?: boolean;
    } | null;
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
    cpu?: {
      usage: number;
      count: number;
    };
    memory?: {
      total: number;
      used: number;
      free: number;
      usagePercent: number;
    };
    uptime?: number;
    timestamp?: string;
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
  private db: DatabaseConnection;
  private isInitialized: boolean = false;
  private initializationPromise: Promise<void> | null = null;

  constructor() {
    this.db = DatabaseConnection.getInstance();
    hostsRepoLogger.debug('🏗️ HostsRepository instance created');

    // Start initialization (will be awaited by all operations)
    this.initializationPromise = this.initializeStorage();
  }

  private async initializeStorage(): Promise<void> {
    if (this.isInitialized) {
      hostsRepoLogger.debug('Storage already initialized, skipping');
      return;
    }

    hostsRepoLogger.debug('🔄 Starting HostsRepository initialization...');

    try {
      // Test PostgreSQL connection
      await this.db.query('SELECT 1');
      this.isInitialized = true;
      hostsRepoLogger.info('✅ HostsRepository initialized with PostgreSQL');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      hostsRepoLogger.error('❌ PostgreSQL connection failed:', { error: errorMsg });
      
      throw new Error(
        `PostgreSQL connection failed: ${errorMsg}. ` +
        `Please ensure DATABASE_URL or POSTGRES_* environment variables are configured correctly. ` +
        `See web-admin/ENV_VARIABLES.md for setup instructions.`
      );
    }
  }

  /**
   * Ensures repository is initialized before any operation
   * This prevents race conditions during startup
   */
  private async ensureInitialized(): Promise<void> {
    if (this.initializationPromise) {
      await this.initializationPromise;
    }
  }

  // Helper methods
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
    await this.ensureInitialized();
    
    try {
      const result = await this.db.query(
        `INSERT INTO hosts (agent_id, hostname, ip_address, grpc_port, displays, system_info, version, last_seen, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [
          hostData.agentId,
          hostData.hostname,
          hostData.ipAddress,
          hostData.grpcPort,
          JSON.stringify(hostData.displays),
          JSON.stringify(hostData.systemInfo),
          hostData.version,
          hostData.lastSeen,
          new Date().toISOString(),
          new Date().toISOString()
        ]
      );
      
      hostsRepoLogger.info('✅ Host created', { agentId: hostData.agentId });
      return this.mapRowToHost(result.rows[0]);
    } catch (error) {
      hostsRepoLogger.error('❌ Failed to create host:', error);
      throw error;
    }
  }

  async getById(id: string): Promise<Host | null> {
    await this.ensureInitialized();
    
    try {
      const result = await this.db.query('SELECT * FROM hosts WHERE agent_id = $1', [id]);
      return result.rows.length > 0 ? this.mapRowToHost(result.rows[0]) : null;
    } catch (error) {
      hostsRepoLogger.error('❌ Failed to get host:', error);
      return null;
    }
  }

  async getByAgentId(agentId: string): Promise<Host | null> {
    await this.ensureInitialized();
    
    try {
      const result = await this.db.query('SELECT * FROM hosts WHERE agent_id = $1', [agentId]);
      return result.rows.length > 0 ? this.mapRowToHost(result.rows[0]) : null;
    } catch (error) {
      hostsRepoLogger.error('❌ Failed to get host by agentId:', error);
      return null;
    }
  }

  async getAll(): Promise<Host[]> {
    await this.ensureInitialized();
    
    try {
      const result = await this.db.query('SELECT * FROM hosts ORDER BY created_at DESC');
      return result.rows.map((row: any) => this.mapRowToHost(row));
    } catch (error) {
      hostsRepoLogger.error('❌ Failed to get all hosts:', error);
      return [];
    }
  }

  async update(id: string, updateData: Partial<Host>): Promise<Host | null> {
    await this.ensureInitialized();
    
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

      const query = `UPDATE hosts SET ${setClauses.join(', ')} WHERE agent_id = $${paramCount} RETURNING *`;
      const result = await this.db.query(query, values);
      
      if (result.rows.length === 0) return null;

      const isSignificantUpdate = updateData.ipAddress || updateData.version;
      if (isSignificantUpdate) {
        hostsRepoLogger.info('🔄 Host updated (significant change)', { hostId: id });
      }
      
      return this.mapRowToHost(result.rows[0]);
    } catch (error) {
      hostsRepoLogger.error('❌ Failed to update host:', error);
      return null;
    }
  }

  async delete(id: string): Promise<boolean> {
    await this.ensureInitialized();
    
    try {
      const result = await this.db.query('DELETE FROM hosts WHERE agent_id = $1', [id]);
      const deleted = result.rowCount > 0;
      if (deleted) {
        hostsRepoLogger.info('🗑️ Host deleted', { agentId: id });
      }
      return deleted;
    } catch (error) {
      hostsRepoLogger.error('❌ Failed to delete host:', error);
      return false;
    }
  }

  async markOffline(agentId: string): Promise<void> {
    await this.ensureInitialized();
    
    const host = await this.getByAgentId(agentId);
    if (host) {
      // Only update lastSeen - status will be calculated automatically
      await this.update(host.id, { 
        lastSeen: new Date(Date.now() - 5 * 60 * 1000).toISOString() // 5 minutes ago to ensure offline
      });
    }
  }

  async cleanupOfflineHosts(timeoutMinutes: number = 30): Promise<void> {
    await this.ensureInitialized();
    
    const cutoffTime = new Date(Date.now() - timeoutMinutes * 60 * 1000);

    try {
      const result = await this.db.query(
        "DELETE FROM hosts WHERE last_seen < $1 RETURNING agent_id",
        [cutoffTime.toISOString()]
      );
      if (result.rowCount > 0) {
        hostsRepoLogger.info('🧹 Cleaned up offline hosts', { count: result.rowCount });
      }
    } catch (error) {
      hostsRepoLogger.error('❌ Failed to cleanup hosts:', error);
    }
  }
}

// Export singleton instance with Next.js hot-reload support
function getHostsRepository(): HostsRepository {
  if (!global.__hostsRepositoryInstance) {
    hostsRepoLogger.info('🌍 Creating GLOBAL singleton HostsRepository instance');
    global.__hostsRepositoryInstance = new HostsRepository();
  } else {
    hostsRepoLogger.debug('♻️ Reusing existing GLOBAL HostsRepository instance');
  }
  
  return global.__hostsRepositoryInstance;
}

export const hostsRepository = getHostsRepository();
