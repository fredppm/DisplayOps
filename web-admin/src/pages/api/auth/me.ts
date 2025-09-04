import { NextApiRequest, NextApiResponse } from 'next';
import { verifyToken } from '../../../lib/auth';
import { createContextLogger } from '../../../utils/logger';

const authLogger = createContextLogger('auth');

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  authLogger.debug('Auth check requested');
  
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Get token from cookie
  const token = req.cookies['auth-token'];
  
  if (!token) {
    authLogger.warn('Auth check failed - no token found');
    return res.status(401).json({ error: 'No auth token found' });
  }

  // Verify token
  const user = verifyToken(token);
  
  if (!user) {
    authLogger.warn('Auth check failed - invalid token');
    return res.status(401).json({ error: 'Invalid token' });
  }

  authLogger.info('Auth check successful', { username: user.username });
  res.status(200).json({ user });
}