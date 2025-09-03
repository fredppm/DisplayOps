import { NextApiRequest, NextApiResponse } from 'next';
import { verifyToken } from '../../../lib/auth';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Get token from cookie
  const token = req.cookies['auth-token'];
  
  if (!token) {
    return res.status(401).json({ error: 'No auth token found' });
  }

  // Verify token
  const user = verifyToken(token);
  
  if (!user) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  res.status(200).json({ user });
}