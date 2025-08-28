import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { app } from 'electron';
import os from 'os';

export interface AgentConfig {
  agentId: string;
  hostname: string;
  apiPort: number;
  controllerUrl?: string;
  version: string;
  displays: DisplayConfig[];
  settings: AgentSettings;
}

export interface DisplayConfig {
  id: string;
  name: string;
  monitorIndex: number;
  bounds?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface AgentSettings {
  maxWindows: number;
  healthCheckInterval: number;
  mdnsUpdateInterval: number;
  autoStart: boolean;
  debugMode: boolean;
}

const DEFAULT_CONFIG: AgentConfig = {
  agentId: `agent-${os.hostname().toLowerCase()}`,
  hostname: os.hostname(),
  apiPort: 8080,
  version: '1.0.0',
  displays: [
    {
      id: 'display-1',
      name: 'Primary Display',
      monitorIndex: 0
    },
    {
      id: 'display-2', 
      name: 'Secondary Display',
      monitorIndex: 1
    }
  ],
  settings: {
    maxWindows: 4,
    healthCheckInterval: 30000,
    mdnsUpdateInterval: 60000,
    autoStart: true,
    debugMode: false
  }
};

export class ConfigManager {
  private config: AgentConfig;
  private configPath: string;

  constructor() {
    this.configPath = this.getConfigPath();
    this.config = this.loadConfig();
  }

  private getConfigPath(): string {
    const userDataPath = app.getPath('userData');
    return join(userDataPath, 'agent-config.json');
  }

  private loadConfig(): AgentConfig {
    try {
      if (existsSync(this.configPath)) {
        const configData = readFileSync(this.configPath, 'utf-8');
        const loadedConfig = JSON.parse(configData);
        
        // Merge with defaults to ensure all properties exist
        return {
          ...DEFAULT_CONFIG,
          ...loadedConfig,
          settings: {
            ...DEFAULT_CONFIG.settings,
            ...loadedConfig.settings
          },
          displays: loadedConfig.displays || DEFAULT_CONFIG.displays
        };
      }
    } catch (error) {
      console.error('Error loading config:', error);
    }

    // Return default config and save it
    this.saveConfig(DEFAULT_CONFIG);
    return DEFAULT_CONFIG;
  }

  public saveConfig(config?: AgentConfig): void {
    try {
      const configToSave = config || this.config;
      writeFileSync(this.configPath, JSON.stringify(configToSave, null, 2));
      console.log('Configuration saved to:', this.configPath);
    } catch (error) {
      console.error('Error saving config:', error);
    }
  }

  public getConfig(): AgentConfig {
    return this.config;
  }

  public updateConfig(updates: Partial<AgentConfig>): void {
    this.config = {
      ...this.config,
      ...updates
    };
    this.saveConfig();
  }

  // Getter methods for commonly used config values
  public getAgentId(): string {
    return this.config.agentId;
  }

  public getHostname(): string {
    return this.config.hostname;
  }

  public getApiPort(): number {
    return this.config.apiPort;
  }

  public getVersion(): string {
    return this.config.version;
  }

  public getDisplays(): DisplayConfig[] {
    return this.config.displays;
  }

  public getSettings(): AgentSettings {
    return this.config.settings;
  }

  public getControllerUrl(): string | undefined {
    return this.config.controllerUrl;
  }

  public setControllerUrl(url: string): void {
    this.updateConfig({ controllerUrl: url });
  }

  // System information methods
  public getSystemInfo() {
    return {
      hostname: this.getHostname(),
      platform: os.platform(),
      arch: os.arch(),
      nodeVersion: process.version,
      electronVersion: process.versions.electron,
      agentVersion: this.getVersion(),
      uptime: process.uptime()
    };
  }
}
