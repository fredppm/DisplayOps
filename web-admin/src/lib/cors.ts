import { NextApiRequest, NextApiResponse } from 'next';

/**
 * CORS configuration interface
 */
export interface CorsOptions {
  origin?: string | string[] | boolean;
  methods?: string[];
  allowedHeaders?: string[];
  credentials?: boolean;
  maxAge?: number;
}

/**
 * CORS middleware for API routes
 */
export function withCors(options: CorsOptions = {}) {
  const defaultOptions: CorsOptions = {
    origin: process.env.NODE_ENV === 'production' ? ['http://localhost:3000', 'http://localhost:3001'] : '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'X-Forwarded-For'],
    credentials: true,
    maxAge: 86400 // 24 hours
  };
  
  const corsOptions = { ...defaultOptions, ...options };
  
  return function<T = any>(handler: (req: NextApiRequest, res: NextApiResponse<T>) => Promise<void> | void) {
    return async (req: NextApiRequest, res: NextApiResponse<T>) => {
      const origin = req.headers.origin;
      
      // Handle origin
      if (corsOptions.origin === true) {
        res.setHeader('Access-Control-Allow-Origin', origin || '*');
      } else if (corsOptions.origin === false) {
        // No CORS headers
      } else if (typeof corsOptions.origin === 'string') {
        res.setHeader('Access-Control-Allow-Origin', corsOptions.origin);
      } else if (Array.isArray(corsOptions.origin)) {
        if (origin && corsOptions.origin.includes(origin)) {
          res.setHeader('Access-Control-Allow-Origin', origin);
        }
      } else {
        res.setHeader('Access-Control-Allow-Origin', '*');
      }
      
      // Handle other CORS headers
      if (corsOptions.credentials) {
        res.setHeader('Access-Control-Allow-Credentials', 'true');
      }
      
      res.setHeader('Access-Control-Allow-Methods', corsOptions.methods!.join(', '));
      res.setHeader('Access-Control-Allow-Headers', corsOptions.allowedHeaders!.join(', '));
      
      if (corsOptions.maxAge) {
        res.setHeader('Access-Control-Max-Age', corsOptions.maxAge.toString());
      }
      
      // Add security headers
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('X-XSS-Protection', '1; mode=block');
      res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
      
      // Handle preflight requests
      if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
      }
      
      return handler(req, res);
    };
  };
}

/**
 * Apply CORS headers to a response (for use in individual endpoints)
 */
export function applyCors(req: NextApiRequest, res: NextApiResponse, options: CorsOptions = {}) {
  const corsMiddleware = withCors(options);
  return corsMiddleware(() => {})(req, res);
}