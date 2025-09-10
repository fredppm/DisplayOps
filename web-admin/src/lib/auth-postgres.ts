import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from './database';

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

const JWT_SECRET = process.env.JWT_SECRET || 'displayops-secret-key-change-in-production';
const JWT_EXPIRES_IN = '7d';

export async function loadUsersFromDB(): Promise<User[]> {
  try {
    const result = await db.query(`
      SELECT id, email, name, password, role, sites, 
             created_at as "createdAt", updated_at as "updatedAt", 
             last_login as "lastLogin"
      FROM users 
      ORDER BY created_at ASC
    `);
    
    return result.rows.map((row: any) => ({
      ...row,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt?.toISOString(),
      lastLogin: row.lastLogin?.toISOString() || null
    }));
  } catch (error) {
    console.error('Error loading users from database:', error);
    throw new Error('Failed to load users');
  }
}

export async function saveUserToDB(user: User): Promise<void> {
  try {
    const existingUser = await db.query('SELECT id FROM users WHERE id = $1', [user.id]);
    
    if (existingUser.rows.length > 0) {
      // Update existing user
      await db.query(`
        UPDATE users 
        SET email = $2, name = $3, password = $4, role = $5, sites = $6, 
            updated_at = NOW(), last_login = $7
        WHERE id = $1
      `, [
        user.id, user.email, user.name, user.password, user.role, 
        user.sites, user.lastLogin ? new Date(user.lastLogin) : null
      ]);
    } else {
      // Insert new user
      await db.query(`
        INSERT INTO users (id, email, name, password, role, sites, created_at, last_login)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        user.id, user.email, user.name, user.password, user.role, 
        user.sites, new Date(user.createdAt), 
        user.lastLogin ? new Date(user.lastLogin) : null
      ]);
    }
  } catch (error) {
    console.error('Error saving user to database:', error);
    throw new Error('Failed to save user');
  }
}

export async function authenticateUserFromDB(email: string, password: string): Promise<AuthUser | null> {
  try {
    const result = await db.query(
      'SELECT id, email, name, password, role, sites FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const user = result.rows[0];
    const isValid = await bcrypt.compare(password, user.password);
    
    if (!isValid) {
      return null;
    }

    // Update last login
    await db.query(
      'UPDATE users SET last_login = NOW() WHERE id = $1',
      [user.id]
    );

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      sites: user.sites
    };
  } catch (error) {
    console.error('Error authenticating user:', error);
    return null;
  }
}

export async function createUserInDB(userData: {
  email: string;
  name: string;
  password: string;
  role: 'admin' | 'site-manager' | 'viewer';
  sites: string[];
}): Promise<AuthUser> {
  try {
    // Check if user already exists
    const existing = await db.query('SELECT id FROM users WHERE email = $1', [userData.email]);
    if (existing.rows.length > 0) {
      throw new Error('User already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(userData.password, 10);

    const userId = `user_${Date.now()}`;
    
    // Insert new user
    await db.query(`
      INSERT INTO users (id, email, name, password, role, sites, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
    `, [
      userId, userData.email, userData.name, hashedPassword, 
      userData.role, userData.sites
    ]);

    return {
      id: userId,
      email: userData.email,
      name: userData.name,
      role: userData.role,
      sites: userData.sites
    };
  } catch (error) {
    console.error('Error creating user in database:', error);
    throw error;
  }
}

export async function getUserByIdFromDB(userId: string): Promise<AuthUser | null> {
  try {
    const result = await db.query(
      'SELECT id, email, name, role, sites FROM users WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0];
  } catch (error) {
    console.error('Error getting user by ID:', error);
    return null;
  }
}

export async function deleteUserFromDB(userId: string): Promise<boolean> {
  try {
    const result = await db.query('DELETE FROM users WHERE id = $1', [userId]);
    return result.rowCount > 0;
  } catch (error) {
    console.error('Error deleting user:', error);
    return false;
  }
}

// Export the same interface as the original auth module
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

// Export the same function names as the original auth module for compatibility
export const authenticateUser = authenticateUserFromDB;
export const createUser = createUserInDB;
export const loadUsers = loadUsersFromDB;
export const saveUsers = async (users: User[]): Promise<void> => {
  // In PostgreSQL, we save users individually, not as an array
  for (const user of users) {
    await saveUserToDB(user);
  }
};