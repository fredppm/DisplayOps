import { NextApiRequest, NextApiResponse } from 'next';
import { authenticateUser, generateToken } from '../../../lib/auth-postgres';

// Rate limiting for login attempts
const loginAttempts = new Map<string, { count: number; timestamp: number; lockUntil?: number }>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const LOCKOUT_MS = 30 * 60 * 1000; // 30 minutes lockout

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Rate limiting check
  const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || 
                   req.connection?.remoteAddress || 
                   'unknown';
  
  const now = Date.now();
  const attempts = loginAttempts.get(clientIp);
  
  // Check if currently locked out
  if (attempts?.lockUntil && now < attempts.lockUntil) {
    const remainingTime = Math.ceil((attempts.lockUntil - now) / 1000 / 60);
    return res.status(429).json({ 
      error: 'Account temporarily locked due to too many failed attempts',
      retryAfter: remainingTime,
      lockedUntil: new Date(attempts.lockUntil).toISOString()
    });
  }
  
  // Reset attempts if window expired or first attempt
  if (!attempts || now - attempts.timestamp > WINDOW_MS) {
    loginAttempts.set(clientIp, { count: 0, timestamp: now });
  }

  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await authenticateUser(email, password);
    
    if (!user) {
      // Increment failed attempt counter
      const currentAttempts = loginAttempts.get(clientIp) || { count: 0, timestamp: now };
      currentAttempts.count++;
      
      // Lock account if too many attempts
      if (currentAttempts.count >= MAX_ATTEMPTS) {
        currentAttempts.lockUntil = now + LOCKOUT_MS;
        loginAttempts.set(clientIp, currentAttempts);
        
        return res.status(429).json({ 
          error: 'Too many failed attempts. Account locked for 30 minutes.',
          retryAfter: 30 * 60 // seconds
        });
      } else {
        loginAttempts.set(clientIp, currentAttempts);
        const remaining = MAX_ATTEMPTS - currentAttempts.count;
        return res.status(401).json({ 
          error: 'Invalid credentials',
          attemptsRemaining: remaining
        });
      }
    }

    // Clear failed attempts on successful login
    loginAttempts.delete(clientIp);
    
    const token = generateToken(user);

    // Set HTTP-only cookie
    res.setHeader('Set-Cookie', [
      `auth-token=${token}; HttpOnly; Path=/; Max-Age=${7 * 24 * 60 * 60}; SameSite=Lax${
        process.env.NODE_ENV === 'production' ? '; Secure' : ''
      }`
    ]);

    res.status(200).json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        sites: user.sites
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}