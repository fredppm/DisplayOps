import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import log from 'electron-log';

export interface AppConfig {
  serverPort: number;
  hostname: string;
  autoStart: boolean;
  firstRun: boolean;
  lastUpdateCheck: string;
}

export class ConfigManager {
  private configPath: string;
  private defaultConfig: AppConfig = {
    serverPort: 3000,
    hostname: '0.0.0.0',
    autoStart: false,
    firstRun: true,
    lastUpdateCheck: new Date().toISOString()
  };

  constructor() {
    const userDataPath = app.getPath('userData');
    this.configPath = path.join(userDataPath, 'config.json');
    this.ensureConfigExists();
  }

  private ensureConfigExists(): void {
    if (!fs.existsSync(this.configPath)) {
      this.saveConfig(this.defaultConfig);
      log.info('Created default configuration file');
    }
  }

  public loadConfig(): AppConfig {
    try {
      const configData = fs.readFileSync(this.configPath, 'utf8');
      const config = JSON.parse(configData);
      
      // Merge with defaults to handle new config keys
      const mergedConfig = { ...this.defaultConfig, ...config };
      
      log.info('Configuration loaded:', mergedConfig);
      return mergedConfig;
    } catch (error) {
      log.error('Failed to load configuration:', error);
      return this.defaultConfig;
    }
  }

  public saveConfig(config: AppConfig): void {
    try {
      const configData = JSON.stringify(config, null, 2);
      fs.writeFileSync(this.configPath, configData, 'utf8');
      log.info('Configuration saved:', config);
    } catch (error) {
      log.error('Failed to save configuration:', error);
    }
  }

  public updateConfig(updates: Partial<AppConfig>): AppConfig {
    const currentConfig = this.loadConfig();
    const updatedConfig = { ...currentConfig, ...updates };
    this.saveConfig(updatedConfig);
    return updatedConfig;
  }

  public isFirstRun(): boolean {
    const config = this.loadConfig();
    return config.firstRun;
  }

  public markFirstRunComplete(): void {
    this.updateConfig({ firstRun: false });
  }

  public getServerPort(): number {
    const config = this.loadConfig();
    return config.serverPort;
  }

  public setServerPort(port: number): void {
    this.updateConfig({ serverPort: port });
  }

  public getHostname(): string {
    const config = this.loadConfig();
    return config.hostname;
  }

  public isAutoStartEnabled(): boolean {
    const config = this.loadConfig();
    return config.autoStart;
  }

  public setAutoStart(enabled: boolean): void {
    this.updateConfig({ autoStart: enabled });
  }

  // Validate port number
  public static isValidPort(port: number): boolean {
    return Number.isInteger(port) && port >= 1024 && port <= 65535;
  }

  // Check if port is available
  public async isPortAvailable(port: number): Promise<boolean> {
    const net = require('net');
    
    return new Promise((resolve) => {
      const server = net.createServer();
      
      server.listen(port, '0.0.0.0', () => {
        server.close(() => {
          resolve(true);
        });
      });
      
      server.on('error', () => {
        resolve(false);
      });
    });
  }

  // Find next available port starting from preferred port
  public async findAvailablePort(preferredPort: number): Promise<number> {
    let port = preferredPort;
    
    while (port <= 65535) {
      if (await this.isPortAvailable(port)) {
        return port;
      }
      port++;
    }
    
    throw new Error('No available port found');
  }

  public getConfigPath(): string {
    return this.configPath;
  }

  public resetToDefaults(): void {
    this.saveConfig(this.defaultConfig);
    log.info('Configuration reset to defaults');
  }
}