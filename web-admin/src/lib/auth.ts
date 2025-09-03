import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import fs from 'fs';

const JWT_SECRET = process.env.JWT_SECRET || 'displayops-secret-key-change-in-production';
const JWT_EXPIRES_IN = '7d';

export interface User {
  id: string;
  email: string;
  name: string;
  password: string;
  role: 'admin' | 'site-manager' | 'viewer';
  sites: string[]; // ["*"] for admin, ["rio", "nyc"] for site-manager
  createdAt: string;
  lastLogin: string | null;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
  sites: string[];
}

const USERS_FILE = process.cwd() + '/data/users.json';

export function loadUsers(): User[] {
  try {
    const data = fs.readFileSync(USERS_FILE, 'utf-8');
    const parsed = JSON.parse(data);
    return parsed.users || [];
  } catch (error) {
    console.error('Error loading users:', error);
    return [];
  }
}

export function saveUsers(users: User[]): void {
  try {
    const data = { users };
    fs.writeFileSync(USERS_FILE, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error saving users:', error);
    throw new Error('Failed to save users');
  }
}

export async function authenticateUser(email: string, password: string): Promise<AuthUser | null> {
  const users = loadUsers();
  const user = users.find(u => u.email === email);

  if (!user) {
    return null;
  }

  const isValid = await bcrypt.compare(password, user.password);
  if (!isValid) {
    return null;
  }

  // Update last login
  user.lastLogin = new Date().toISOString();
  saveUsers(users);

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    sites: user.sites
  };
}

export function generateToken(user: AuthUser): string {
  return jwt.sign(
    { 
      id: user.id, 
      email: user.email, 
      name: user.name, 
      role: user.role, 
      sites: user.sites 
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

export function verifyToken(token: string): AuthUser | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthUser;
    return decoded;
  } catch (error) {
    return null;
  }
}

export async function createUser(userData: {
  email: string;
  name: string;
  password: string;
  role: 'admin' | 'site-manager' | 'viewer';
  sites: string[];
}): Promise<AuthUser> {
  const users = loadUsers();
  
  // Check if user already exists
  if (users.find(u => u.email === userData.email)) {
    throw new Error('User already exists');
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(userData.password, 10);

  const newUser: User = {
    id: `user_${Date.now()}`,
    email: userData.email,
    name: userData.name,
    password: hashedPassword,
    role: userData.role,
    sites: userData.sites,
    createdAt: new Date().toISOString(),
    lastLogin: null
  };

  users.push(newUser);
  saveUsers(users);

  return {
    id: newUser.id,
    email: newUser.email,
    name: newUser.name,
    role: newUser.role,
    sites: newUser.sites
  };
}

export function checkUserPermission(user: AuthUser, siteId: string): boolean {
  // Admin has access to all sites
  if (user.role === 'admin' || user.sites.includes('*')) {
    return true;
  }

  // Check if user has access to specific site
  return user.sites.includes(siteId);
}

export function checkAdminPermission(user: AuthUser): boolean {
  return user.role === 'admin';
}