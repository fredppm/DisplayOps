import { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs/promises';
import path from 'path';
import { ApiResponse } from '@/types/multi-site-types';

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

interface AuditStats {
  totalEvents: number;
  successfulEvents: number;
  failedEvents: number;
  successRate: number;
  eventsLast24h: number;
  eventsLast7d: number;
  topActions: Array<{ action: string; count: number }>;
  topResources: Array<{ resource: string; count: number }>;
  topUsers: Array<{ user: string; count: number }>;
  hourlyDistribution: Array<{ hour: number; count: number }>;
  recentErrors: Array<{
    timestamp: string;
    action: string;
    resource: string;
    error: string;
  }>;
  generatedAt: string;
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

function calculateStats(logs: AuditLogEntry[]): AuditStats {
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  
  // Basic counts
  const totalEvents = logs.length;
  const successfulEvents = logs.filter(log => log.success).length;
  const failedEvents = totalEvents - successfulEvents;
  const successRate = totalEvents > 0 ? (successfulEvents / totalEvents) * 100 : 100;
  
  // Time-based counts
  const eventsLast24h = logs.filter(log => 
    new Date(log.timestamp) > oneDayAgo
  ).length;
  
  const eventsLast7d = logs.filter(log => 
    new Date(log.timestamp) > sevenDaysAgo
  ).length;
  
  // Top actions
  const actionCounts = logs.reduce((acc, log) => {
    acc[log.action] = (acc[log.action] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  const topActions = Object.entries(actionCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([action, count]) => ({ action, count }));
  
  // Top resources
  const resourceCounts = logs.reduce((acc, log) => {
    acc[log.resource] = (acc[log.resource] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  const topResources = Object.entries(resourceCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([resource, count]) => ({ resource, count }));
  
  // Top users
  const userCounts = logs.reduce((acc, log) => {
    const user = log.user || 'unknown';
    acc[user] = (acc[user] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  const topUsers = Object.entries(userCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([user, count]) => ({ user, count }));
  
  // Hourly distribution (last 24 hours)
  const hourlyDistribution = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    count: 0
  }));
  
  logs.filter(log => new Date(log.timestamp) > oneDayAgo)
    .forEach(log => {
      const hour = new Date(log.timestamp).getHours();
      hourlyDistribution[hour].count++;
    });
  
  // Recent errors
  const recentErrors = logs
    .filter(log => !log.success && log.error)
    .slice(0, 20)
    .map(log => ({
      timestamp: log.timestamp,
      action: log.action,
      resource: log.resource,
      error: log.error!
    }));
  
  return {
    totalEvents,
    successfulEvents,
    failedEvents,
    successRate: Math.round(successRate * 100) / 100,
    eventsLast24h,
    eventsLast7d,
    topActions,
    topResources,
    topUsers,
    hourlyDistribution,
    recentErrors,
    generatedAt: new Date().toISOString()
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<AuditStats>>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed',
      timestamp: new Date().toISOString()
    });
  }

  try {
    const data = await readAuditLog();
    const stats = calculateStats(data.logs);
    
    console.log('Audit statistics generated:', {
      totalEvents: stats.totalEvents,
      successRate: stats.successRate,
      last24h: stats.eventsLast24h,
      timestamp: stats.generatedAt
    });
    
    res.status(200).json({
      success: true,
      data: stats,
      timestamp: stats.generatedAt
    });
    
  } catch (error: any) {
    console.error('Failed to generate audit statistics:', error);
    
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate audit statistics',
      timestamp: new Date().toISOString()
    });
  }
}