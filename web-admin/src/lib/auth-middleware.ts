import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'displayops-secret-key-change-in-production';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
  sites: string[];
}

export function verifyTokenEdge(token: string): AuthUser | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthUser;
    return decoded;
  } catch (error) {
    return null;
  }
}