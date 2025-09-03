import fs from 'fs/promises';
import path from 'path';

export abstract class BaseRepository<T> {
  protected filePath: string;

  constructor(fileName: string) {
    this.filePath = path.join(process.cwd(), 'data', fileName);
  }

  protected async readData(): Promise<{ [key: string]: T[] }> {
    try {
      const data = await fs.readFile(this.filePath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      console.error(`Error reading ${this.filePath}:`, error);
      return this.getDefaultData();
    }
  }

  protected async writeData(data: { [key: string]: T[] }): Promise<void> {
    try {
      await fs.writeFile(this.filePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (error) {
      console.error(`Error writing ${this.filePath}:`, error);
      throw new Error(`Failed to write data to ${this.filePath}`);
    }
  }

  protected abstract getDefaultData(): { [key: string]: T[] };
  protected abstract getCollectionKey(): string;

  async getAll(): Promise<T[]> {
    const data = await this.readData();
    return data[this.getCollectionKey()] || [];
  }

  async getById(id: string): Promise<T | null> {
    const items = await this.getAll();
    return items.find((item: any) => item.id === id) || null;
  }

  async create(item: T): Promise<T> {
    const data = await this.readData();
    const collection = data[this.getCollectionKey()] || [];
    
    collection.push(item);
    data[this.getCollectionKey()] = collection;
    
    await this.writeData(data);
    return item;
  }

  async update(id: string, updates: Partial<T>): Promise<T | null> {
    const data = await this.readData();
    const collection = data[this.getCollectionKey()] || [];
    
    const index = collection.findIndex((item: any) => item.id === id);
    if (index === -1) return null;

    const updatedItem = { ...collection[index], ...updates, updatedAt: new Date().toISOString() };
    collection[index] = updatedItem;
    data[this.getCollectionKey()] = collection;
    
    await this.writeData(data);
    return updatedItem as T;
  }

  async delete(id: string): Promise<boolean> {
    const data = await this.readData();
    const collection = data[this.getCollectionKey()] || [];
    
    const initialLength = collection.length;
    const filtered = collection.filter((item: any) => item.id !== id);
    
    if (filtered.length === initialLength) return false;

    data[this.getCollectionKey()] = filtered;
    await this.writeData(data);
    return true;
  }
}