import { BasePostgresRepository } from './BasePostgresRepository';
import { db } from '@/lib/database';

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  action: string;
  resource: string;
  resourceId?: string;
  user?: string;
  userAgent?: string;
  ip?: string;
  data?: any;
  success: boolean;
  error?: string;
}

export interface AuditQuery {
  action?: string;
  resource?: string;
  resourceId?: string;
  user?: string;
  success?: boolean;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

export class AuditRepository extends BasePostgresRepository<AuditLogEntry> {
  protected getTableName(): string {
    return 'audit_logs';
  }

  protected mapDbRowToEntity(row: any): AuditLogEntry {
    return {
      id: row.id,
      timestamp: row.timestamp,
      action: row.action,
      resource: row.resource,
      resourceId: row.resource_id,
      user: row.user_name,
      userAgent: row.user_agent,
      ip: row.ip,
      data: row.data,
      success: row.success,
      error: row.error
    };
  }

  protected mapEntityToDbRow(entity: AuditLogEntry): any {
    return {
      id: entity.id,
      timestamp: entity.timestamp,
      action: entity.action,
      resource: entity.resource,
      resource_id: entity.resourceId,
      user_name: entity.user,
      user_agent: entity.userAgent,
      ip: entity.ip,
      data: entity.data ? JSON.stringify(entity.data) : null,
      success: entity.success,
      error: entity.error
    };
  }

  generateId(): string {
    return `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async logEvent(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): Promise<void> {
    const auditEntry: AuditLogEntry = {
      id: this.generateId(),
      timestamp: new Date().toISOString(),
      ...entry
    };
    
    await this.create(auditEntry);
    
    // Keep only last 10000 entries to prevent table from growing too large
    await this.cleanup();
  }

  private async cleanup(): Promise<void> {
    try {
      const query = `
        DELETE FROM ${this.getTableName()} 
        WHERE id NOT IN (
          SELECT id FROM ${this.getTableName()} 
          ORDER BY timestamp DESC 
          LIMIT 10000
        )
      `;
      await db.query(query);
    } catch (error) {
      console.error('Failed to cleanup old audit logs:', error);
    }
  }

  async findWithFilters(query: AuditQuery): Promise<AuditLogEntry[]> {
    let sql = `SELECT * FROM ${this.getTableName()} WHERE 1=1`;
    const params: any[] = [];
    let paramIndex = 1;

    if (query.action) {
      sql += ` AND action ILIKE $${paramIndex}`;
      params.push(`%${query.action}%`);
      paramIndex++;
    }

    if (query.resource) {
      sql += ` AND resource ILIKE $${paramIndex}`;
      params.push(`%${query.resource}%`);
      paramIndex++;
    }

    if (query.resourceId) {
      sql += ` AND resource_id = $${paramIndex}`;
      params.push(query.resourceId);
      paramIndex++;
    }

    if (query.user) {
      sql += ` AND user_name ILIKE $${paramIndex}`;
      params.push(`%${query.user}%`);
      paramIndex++;
    }

    if (query.success !== undefined) {
      sql += ` AND success = $${paramIndex}`;
      params.push(query.success);
      paramIndex++;
    }

    if (query.startDate) {
      sql += ` AND timestamp >= $${paramIndex}`;
      params.push(query.startDate);
      paramIndex++;
    }

    if (query.endDate) {
      sql += ` AND timestamp <= $${paramIndex}`;
      params.push(query.endDate);
      paramIndex++;
    }

    sql += ' ORDER BY timestamp DESC';

    if (query.limit) {
      sql += ` LIMIT $${paramIndex}`;
      params.push(query.limit);
      paramIndex++;
    }

    if (query.offset) {
      sql += ` OFFSET $${paramIndex}`;
      params.push(query.offset);
      paramIndex++;
    }

    const result = await db.query(sql, params);
    return result.rows.map((row: any) => this.mapDbRowToEntity(row));
  }

  async countWithFilters(query: Omit<AuditQuery, 'limit' | 'offset'>): Promise<number> {
    let sql = `SELECT COUNT(*) FROM ${this.getTableName()} WHERE 1=1`;
    const params: any[] = [];
    let paramIndex = 1;

    if (query.action) {
      sql += ` AND action ILIKE $${paramIndex}`;
      params.push(`%${query.action}%`);
      paramIndex++;
    }

    if (query.resource) {
      sql += ` AND resource ILIKE $${paramIndex}`;
      params.push(`%${query.resource}%`);
      paramIndex++;
    }

    if (query.resourceId) {
      sql += ` AND resource_id = $${paramIndex}`;
      params.push(query.resourceId);
      paramIndex++;
    }

    if (query.user) {
      sql += ` AND user_name ILIKE $${paramIndex}`;
      params.push(`%${query.user}%`);
      paramIndex++;
    }

    if (query.success !== undefined) {
      sql += ` AND success = $${paramIndex}`;
      params.push(query.success);
      paramIndex++;
    }

    if (query.startDate) {
      sql += ` AND timestamp >= $${paramIndex}`;
      params.push(query.startDate);
      paramIndex++;
    }

    if (query.endDate) {
      sql += ` AND timestamp <= $${paramIndex}`;
      params.push(query.endDate);
      paramIndex++;
    }

    const result = await db.query(sql, params);
    return parseInt(result.rows[0].count);
  }
}

// Singleton instance
export const auditRepository = new AuditRepository();