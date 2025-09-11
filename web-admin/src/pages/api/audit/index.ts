import { NextApiResponse } from 'next';
import { ApiResponse } from '@/types/multi-site-types';
import { withPermission, ProtectedApiRequest } from '@/lib/api-protection';
import { auditRepository, AuditLogEntry, AuditQuery } from '@/lib/repositories/AuditRepository';

export async function logAuditEvent(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): Promise<void> {
  try {
    await auditRepository.logEvent(entry);
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


async function handler(
  req: ProtectedApiRequest,
  res: NextApiResponse<ApiResponse<AuditLogEntry[] | AuditLogEntry>>
) {
  if (req.method === 'GET') {
    try {
      const query = parseQuery(req.query);
      
      // Get filtered logs and total count
      const filteredLogs = await auditRepository.findWithFilters(query);
      const totalCount = await auditRepository.countWithFilters(query);
      
      // Add pagination info to response headers
      const limit = query.limit || 100;
      const offset = query.offset || 0;
      res.setHeader('X-Total-Count', totalCount.toString());
      res.setHeader('X-Limit', limit.toString());
      res.setHeader('X-Offset', offset.toString());
      
      res.status(200).json({
        success: true,
        data: filteredLogs,
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
      
      await auditRepository.logEvent({
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