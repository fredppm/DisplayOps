import { NextApiRequest } from 'next';
import { createContextLogger } from '@/utils/logger';

const logger = createContextLogger('host-auth');

/**
 * Simple API key validation for host agents
 * 
 * For development: Accept any agentId that starts with "agent-"
 * For production: Use environment variable HOSTS_API_KEY or validate agentId format
 */
export function validateHostAuth(req: NextApiRequest): { valid: boolean; agentId?: string; error?: string } {
  // Get API key from header or agentId from body
  const apiKey = req.headers['x-api-key'] as string;
  const agentId = (req.body?.agentId || req.query?.agentId) as string;

  // For development: Accept any request with valid agentId format
  if (process.env.NODE_ENV === 'development') {
    if (!agentId) {
      return { valid: false, error: 'Missing agentId' };
    }

    if (!agentId.startsWith('agent-')) {
      return { valid: false, error: 'Invalid agentId format' };
    }

    return { valid: true, agentId };
  }

  // Production: Check API key or validate agentId
  const expectedApiKey = process.env.HOSTS_API_KEY || 'change-me-in-production';

  // Option 1: API key in header
  if (apiKey) {
    if (apiKey !== expectedApiKey) {
      logger.warn('Invalid API key', { ip: req.socket.remoteAddress });
      return { valid: false, error: 'Invalid API key' };
    }
    return { valid: true, agentId };
  }

  // Option 2: Validate agentId format (basic validation)
  if (!agentId || !agentId.startsWith('agent-')) {
    return { valid: false, error: 'Invalid or missing agentId' };
  }

  // In production without API key, at least validate the agentId format
  return { valid: true, agentId };
}

/**
 * Optional: Generate API key for host agents
 */
export function generateHostApiKey(): string {
  return `host_${Math.random().toString(36).substring(2, 15)}_${Date.now()}`;
}

