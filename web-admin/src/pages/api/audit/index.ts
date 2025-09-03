import { NextApiResponse } from 'next';
import fs from 'fs/promises';
import path from 'path';
import { ApiResponse } from '@/types/multi-site-types';
import { withPermission, ProtectedApiRequest } from '@/lib/api-protection';

const AUDIT_LOG_FILE = path.join(process.cwd(), 'data', 'audit-log.json');

interface AuditLogEntry {
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

interface AuditLogData {
  logs: AuditLogEntry[];
}

interface AuditQuery {
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

async function readAuditLog(): Promise<AuditLogData> {
  try {
    const data = await fs.readFile(AUDIT_LOG_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading audit log:', error);
    return { logs: [] };
  }
}

async function writeAuditLog(data: AuditLogData): Promise<void> {
  try {
    await fs.writeFile(AUDIT_LOG_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error writing audit log:', error);
    throw new Error('Failed to write audit log');
  }
}

export async function logAuditEvent(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): Promise<void> {
  try {
    const data = await readAuditLog();
    const auditEntry: AuditLogEntry = {
      id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      ...entry
    };
    
    data.logs.unshift(auditEntry); // Add to beginning for latest first
    
    // Keep only last 10000 entries to prevent file from growing too large
    if (data.logs.length > 10000) {
      data.logs = data.logs.slice(0, 10000);
    }
    
    await writeAuditLog(data);
  } catch (error) {
    console.error('Failed to log audit event:', error);
  }
}

function parseQuery(query: any): AuditQuery {
  const parsed: AuditQuery = {};
  
  if (query.action) parsed.action = query.action as string;
  if (query.resource) parsed.resource = query.resource as string;
  if (query.resourceId) parsed.resourceId = query.resourceId as string;
  if (query.user) parsed.user = query.user as string;
  if (query.success !== undefined) parsed.success = query.success === 'true';
  if (query.startDate) parsed.startDate = query.startDate as string;
  if (query.endDate) parsed.endDate = query.endDate as string;
  if (query.limit) parsed.limit = Math.min(parseInt(query.limit as string) || 100, 1000);
  if (query.offset) parsed.offset = parseInt(query.offset as string) || 0;
  
  return parsed;
}

function filterLogs(logs: AuditLogEntry[], query: AuditQuery): AuditLogEntry[] {
  let filteredLogs = logs;
  
  if (query.action) {
    filteredLogs = filteredLogs.filter(log => 
      log.action.toLowerCase().includes(query.action!.toLowerCase())
    );
  }
  
  if (query.resource) {
    filteredLogs = filteredLogs.filter(log => 
      log.resource.toLowerCase().includes(query.resource!.toLowerCase())
    );
  }
  
  if (query.resourceId) {
    filteredLogs = filteredLogs.filter(log => 
      log.resourceId === query.resourceId
    );
  }
  
  if (query.user) {
    filteredLogs = filteredLogs.filter(log => 
      log.user?.toLowerCase().includes(query.user!.toLowerCase())
    );
  }
  
  if (query.success !== undefined) {
    filteredLogs = filteredLogs.filter(log => 
      log.success === query.success
    );
  }
  
  if (query.startDate) {
    const startDate = new Date(query.startDate);
    filteredLogs = filteredLogs.filter(log => 
      new Date(log.timestamp) >= startDate
    );
  }
  
  if (query.endDate) {
    const endDate = new Date(query.endDate);
    filteredLogs = filteredLogs.filter(log => 
      new Date(log.timestamp) <= endDate
    );
  }
  
  return filteredLogs;
}

async function handler(
  req: ProtectedApiRequest,
  res: NextApiResponse<ApiResponse<AuditLogEntry[] | AuditLogEntry>>
) {
  if (req.method === 'GET') {
    try {
      const query = parseQuery(req.query);
      const data = await readAuditLog();
      
      // Filter logs based on query parameters
      let filteredLogs = filterLogs(data.logs, query);
      
      // Apply pagination
      const limit = query.limit || 100;
      const offset = query.offset || 0;
      const paginatedLogs = filteredLogs.slice(offset, offset + limit);
      
      // Add pagination info to response headers
      res.setHeader('X-Total-Count', filteredLogs.length.toString());
      res.setHeader('X-Limit', limit.toString());
      res.setHeader('X-Offset', offset.toString());
      
      res.status(200).json({
        success: true,
        data: paginatedLogs,
        timestamp: new Date().toISOString()
      });
      
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch audit logs',
        timestamp: new Date().toISOString()
      });
    }
  } else if (req.method === 'POST') {
    try {
      const { action, resource, resourceId, user, data: eventData, success, error } = req.body;
      
      if (!action || !resource) {
        return res.status(400).json({
          success: false,
          error: 'Action and resource are required',
          timestamp: new Date().toISOString()
        });
      }
      
      const userAgent = req.headers['user-agent'];
      const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || 
                 req.connection.remoteAddress || 
                 'unknown';
      
      await logAuditEvent({
        action,
        resource,
        resourceId,
        user: user || 'system',
        userAgent,
        ip,
        data: eventData,
        success: success !== undefined ? success : true,
        error
      });
      
      res.status(201).json({
        success: true,
        timestamp: new Date().toISOString()
      });
      
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to log audit event',
        timestamp: new Date().toISOString()
      });
    }
  } else {
    res.setHeader('Allow', ['GET', 'POST']);
    res.status(405).json({
      success: false,
      error: `Method ${req.method} not allowed`,
      timestamp: new Date().toISOString()
    });
  }
}

// Export with authentication and permission checking
// Requires 'audit:read' permission
export default withPermission('audit:read')(handler);