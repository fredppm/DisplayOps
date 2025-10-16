import { db } from '@/lib/database';

export abstract class BasePostgresRepository<T> {
  protected abstract getTableName(): string;
  protected abstract mapDbRowToEntity(row: any): T;
  protected abstract mapEntityToDbRow(entity: T): any;
  
  protected initializationPromise: Promise<void> | null = null;

  /**
   * Override this method if your repository needs async initialization
   * Call it from the constructor with: this.initializationPromise = this.initialize()
   */
  protected async initialize(): Promise<void> {
    // Default: no initialization needed
  }

  /**
   * Ensures repository is initialized before any operation
   * This prevents race conditions during startup
   */
  protected async ensureInitialized(): Promise<void> {
    if (this.initializationPromise) {
      await this.initializationPromise;
    }
  }

  async getAll(): Promise<T[]> {
    await this.ensureInitialized();
    
    try {
      const result = await db.query(`SELECT * FROM ${this.getTableName()} ORDER BY created_at DESC`);
      return result.rows.map((row: any) => this.mapDbRowToEntity(row));
    } catch (error) {
      console.error(`Error getting all from ${this.getTableName()}:`, error);
      throw new Error(`Failed to load ${this.getTableName()}`);
    }
  }

  async getById(id: string): Promise<T | null> {
    await this.ensureInitialized();
    
    try {
      const result = await db.query(`SELECT * FROM ${this.getTableName()} WHERE id = $1`, [id]);
      return result.rows.length > 0 ? this.mapDbRowToEntity(result.rows[0]) : null;
    } catch (error) {
      console.error(`Error getting ${this.getTableName()} by id:`, error);
      throw new Error(`Failed to get ${this.getTableName()} by id`);
    }
  }

  async create(entity: T): Promise<T> {
    await this.ensureInitialized();
    
    try {
      const dbRow = this.mapEntityToDbRow(entity);
      const columns = Object.keys(dbRow).join(', ');
      const placeholders = Object.keys(dbRow).map((_, index) => `$${index + 1}`).join(', ');
      const values = Object.values(dbRow);

      const query = `
        INSERT INTO ${this.getTableName()} (${columns}, created_at, updated_at)
        VALUES (${placeholders}, NOW(), NOW())
        RETURNING *
      `;

      const result = await db.query(query, values);
      return this.mapDbRowToEntity(result.rows[0]);
    } catch (error) {
      console.error(`Error creating ${this.getTableName()}:`, error);
      throw new Error(`Failed to create ${this.getTableName()}`);
    }
  }

  async update(id: string, updates: Partial<T>): Promise<T | null> {
    await this.ensureInitialized();
    
    try {
      const existing = await this.getById(id);
      if (!existing) return null;

      const updatedEntity = { ...existing, ...updates };
      const dbRow = this.mapEntityToDbRow(updatedEntity);
      
      const setClause = Object.keys(dbRow)
        .map((key, index) => `${key} = $${index + 2}`)
        .join(', ');
      const values = [id, ...Object.values(dbRow)];

      const query = `
        UPDATE ${this.getTableName()} 
        SET ${setClause}, updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `;

      const result = await db.query(query, values);
      return result.rows.length > 0 ? this.mapDbRowToEntity(result.rows[0]) : null;
    } catch (error) {
      console.error(`Error updating ${this.getTableName()}:`, error);
      throw new Error(`Failed to update ${this.getTableName()}`);
    }
  }

  async delete(id: string): Promise<boolean> {
    await this.ensureInitialized();
    
    try {
      const result = await db.query(`DELETE FROM ${this.getTableName()} WHERE id = $1`, [id]);
      return result.rowCount > 0;
    } catch (error) {
      console.error(`Error deleting from ${this.getTableName()}:`, error);
      return false;
    }
  }
}