import { BaseRepository } from './BaseRepository';

interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'site-manager' | 'viewer';
  sites: string[];
  createdAt: string;
  lastLogin: string | null;
  passwordHash?: string;
}

export class UsersRepository extends BaseRepository<User> {
  constructor() {
    super('users.json');
  }

  protected getDefaultData() {
    return { users: [] };
  }

  protected getCollectionKey(): string {
    return 'users';
  }

  // User-specific methods
  async findByEmail(email: string): Promise<User | null> {
    const users = await this.getAll();
    return users.find(user => user.email.toLowerCase() === email.toLowerCase()) || null;
  }

  async getUsersByRole(role: 'admin' | 'site-manager' | 'viewer'): Promise<User[]> {
    const users = await this.getAll();
    return users.filter(user => user.role === role);
  }

  async getUsersBySite(siteId: string): Promise<User[]> {
    const users = await this.getAll();
    return users.filter(user => 
      user.sites.includes('*') || user.sites.includes(siteId)
    );
  }

  async getUsersWithAccess(siteIds: string[]): Promise<User[]> {
    const users = await this.getAll();
    return users.filter(user => 
      user.sites.includes('*') || 
      siteIds.some(siteId => user.sites.includes(siteId))
    );
  }

  async getStatsCount(): Promise<{
    total: number;
    admins: number;
    siteManagers: number;
    viewers: number;
    active: number;
  }> {
    const users = await this.getAll();
    return {
      total: users.length,
      admins: users.filter(u => u.role === 'admin').length,
      siteManagers: users.filter(u => u.role === 'site-manager').length,
      viewers: users.filter(u => u.role === 'viewer').length,
      active: users.filter(u => u.lastLogin).length,
    };
  }

  async updateLastLogin(userId: string): Promise<User | null> {
    return this.update(userId, { 
      lastLogin: new Date().toISOString() 
    });
  }

  async createUser(userData: Omit<User, 'id' | 'createdAt' | 'lastLogin'>): Promise<User> {
    const newUser: User = {
      ...userData,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      lastLogin: null,
    };
    
    return this.create(newUser);
  }
}

// Singleton instance
export const usersRepository = new UsersRepository();