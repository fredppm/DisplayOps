import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { app } from 'electron';
import os from 'os';

export interface AgentConfig {
  agentId: string;
  hostname: string;
  controllerUrl?: string;
  version: string;
  displays: DisplayConfig[];
  settings: AgentSettings;
}

export interface DisplayConfig {
  id: string;
  name: string;
  monitorIndex: number;
  electronDisplayId?: number;
  bounds?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  dashboard?: {
    url: string;
    refreshInterval: number;
  };
}

export interface AgentSettings {
  maxWindows: number;
  healthCheckInterval: number;
  mdnsUpdateInterval: number;
  autoStart: boolean;
  debugMode: boolean;
}

// Function to get real display configuration
function getRealDisplaysConfig(): DisplayConfig[] {
  try {
    const { screen } = require('electron');
    const displays = screen.getAllDisplays();
    
    return displays.map((display: any, index: number) => ({
      id: `display-${index + 1}`,
      name: `Display ${index + 1}${display === screen.getPrimaryDisplay() ? ' (Primary)' : ''}`,
      monitorIndex: index,
      electronDisplayId: display.id,
      bounds: display.bounds
    }));
  } catch (error) {
    // Fallback if Electron is not available yet
    console.warn('Electron not available, using default display config');
    return [
      { id: 'display-1', name: 'Primary Display', monitorIndex: 0 },
      { id: 'display-2', name: 'Secondary Display', monitorIndex: 1 }
    ];
  }
}

const DEFAULT_CONFIG: AgentConfig = {
  agentId: `agent-${os.hostname().toLowerCase()}`,
  hostname: os.hostname(),
  version: '1.0.0',
  displays: getRealDisplaysConfig(),
  settings: {
    maxWindows: 4,
    healthCheckInterval: 120000, // 2 minutes instead of 30 seconds
    mdnsUpdateInterval: 1800000, // 30 minutes - reduce frequent restarts
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
        const mergedConfig = {
          ...DEFAULT_CONFIG,
          ...loadedConfig,
          settings: {
            ...DEFAULT_CONFIG.settings,
            ...loadedConfig.settings,
            // Force update mDNS interval to new default if still at old value
            mdnsUpdateInterval: loadedConfig.settings?.mdnsUpdateInterval === 300000 ? 
              DEFAULT_CONFIG.settings.mdnsUpdateInterval : 
              (loadedConfig.settings?.mdnsUpdateInterval || DEFAULT_CONFIG.settings.mdnsUpdateInterval)
          },
          displays: loadedConfig.displays || DEFAULT_CONFIG.displays
        };
        
        // Save the updated config with new defaults
        this.saveConfig(mergedConfig);
        return mergedConfig;
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


  public getVersion(): string {
    return this.config.version;
  }

  public getDisplays(): DisplayConfig[] {
    return this.config.displays;
  }

  public updateDisplaysFromSystem(): void {
    try {
      const { screen } = require('electron');
      const displays = screen.getAllDisplays();
      
      // Update display configuration with real system displays
      this.config.displays = displays.map((display: any, index: number) => {
        const existingConfig = this.config.displays.find(d => d.electronDisplayId === display.id);
        
        return {
          id: existingConfig?.id || `display-${index + 1}`,
          name: existingConfig?.name || `Display ${index + 1}${display === screen.getPrimaryDisplay() ? ' (Primary)' : ''}`,
          monitorIndex: index,
          electronDisplayId: display.id,
          bounds: display.bounds,
          dashboard: existingConfig?.dashboard
        } as DisplayConfig;
      });
      
      // Save updated config
      this.saveConfig();
      
      console.log(`🔄 Updated display configuration: ${this.config.displays.length} displays detected`);
      
    } catch (error) {
      console.error('Error updating displays from system:', error);
    }
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
