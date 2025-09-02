const bonjour = require('bonjour');
import { ConfigManager } from '../managers/config-manager';
import { StateManager } from './state-manager';
import os from 'os';

export class MDNSService {
  private bonjourInstance: any;
  private publishedService: any | null = null;
  private isAdvertising: boolean = false;
  private configManager: ConfigManager;
  private stateManager: StateManager;
  private updateInterval: NodeJS.Timeout | null = null;

  constructor(configManager: ConfigManager, stateManager: StateManager) {
    this.configManager = configManager;
    this.stateManager = stateManager;
    this.bonjourInstance = bonjour();
  }

  public startAdvertising(): void {
    const config = this.configManager.getConfig();
    const serviceName = `${config.hostname}-${config.agentId}`;
    
    console.log(`🚀 Starting mDNS advertising as: ${serviceName}`);

    try {
      // Stop existing service if any
      this.stopAdvertising();

      this.isAdvertising = true;
      
      // Publish the service using bonjour
      this.publishedService = this.bonjourInstance.publish({
        name: serviceName,
        type: 'displayops',
        port: 8082, // gRPC port
        txt: this.getTxtRecord()
      });

      // Set up event listeners
      this.publishedService.on('up', () => {
        console.log('✅ mDNS service published successfully');
        console.log(`   Name: ${this.publishedService?.name}`);
        console.log(`   Type: _${this.publishedService?.type}._tcp.local`);
        console.log(`   Port: ${this.publishedService?.port}`);
        console.log(`   Host: ${this.publishedService?.host}`);
      });

      this.publishedService.on('error', (error: any) => {
        console.error('❌ mDNS service error:', error);
      });

      // Set up periodic TXT record updates
      this.startPeriodicUpdates();

    } catch (error) {
      console.error('❌ Error starting mDNS advertising:', error);
    }
  }

  public stopAdvertising(): void {
    console.log('🛑 Stopping mDNS advertising...');
    
    this.isAdvertising = false;
    
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    
    if (this.publishedService) {
      this.publishedService.stop();
      this.publishedService = null;
    }
  }

  private getTxtRecord(): Record<string, string> {
    const config = this.configManager.getConfig();
    const systemInfo = this.configManager.getSystemInfo();
    
    // Get display state to include dashboard information
    const displayStates = this.stateManager.getAllDisplayStates();
    const activeDashboards: string[] = [];
    const displayDashboardMap: string[] = [];
    
    for (const [displayId, display] of Object.entries(displayStates)) {
      if (display.assignedDashboard) {
        activeDashboards.push(display.assignedDashboard.dashboardId);
        displayDashboardMap.push(`${displayId}:${display.assignedDashboard.dashboardId}`);
      }
    }
    
    return {
      version: config.version,
      agentId: config.agentId,
      hostname: config.hostname,
      displayCount: config.displays.length.toString(),
      displays: config.displays.map(d => d.id).join(','),
      platform: systemInfo.platform,
      arch: systemInfo.arch,
      uptime: Math.floor(systemInfo.uptime / 60).toString(),
      nodeVersion: systemInfo.nodeVersion,
      electronVersion: systemInfo.electronVersion || 'unknown',
      status: 'online',
      grpcPort: '8082',
      activeDashboards: activeDashboards.join(','),
      displayDashboards: displayDashboardMap.join(','),
      dashboardCount: activeDashboards.length.toString()
    };
  }

  private startPeriodicUpdates(): void {
    const interval = this.configManager.getSettings().mdnsUpdateInterval;
    
    // Only start periodic updates if interval is reasonable (> 5 minutes)
    if (interval < 300000) { // 5 minutes
      console.log(`⚠️ mDNS periodic updates disabled (interval too frequent: ${interval}ms)`);
      return;
    }
    
    this.updateInterval = setInterval(() => {
      this.updateTxtRecord();
    }, interval);

    console.log(`⏰ mDNS periodic updates started (interval: ${interval}ms)`);
  }

  private updateTxtRecord(): void {
    if (!this.isAdvertising || !this.publishedService) {
      return;
    }

    try {
      console.log('🔄 Updating mDNS TXT record...');
      
      // Stop and republish with new TXT record
      const config = this.configManager.getConfig();
      const serviceName = `${config.hostname}-${config.agentId}`;
      
      this.publishedService.stop();
      
      this.publishedService = this.bonjourInstance.publish({
        name: serviceName,
        type: 'displayops',
        port: 8082,
        txt: this.getTxtRecord()
      });
      
    } catch (error) {
      console.error('❌ Error updating mDNS TXT record:', error);
    }
  }

  public isAdvertisingActive(): boolean {
    return this.isAdvertising;
  }

  public forceUpdateTxtRecord(): void {
    console.log('🔄 Force updating mDNS TXT record...');
    this.updateTxtRecord();
  }

  public getServiceInfo() {
    if (!this.isAdvertising || !this.publishedService) {
      return null;
    }

    const config = this.configManager.getConfig();
    
    return {
      name: `${config.hostname}-${config.agentId}`,
      type: '_displayops._tcp.local',
      port: 8082, // gRPC port
      txt: this.getTxtRecord(),
      addresses: this.getLocalAddresses(),
      host: this.publishedService.host,
      fqdn: this.publishedService.fqdn
    };
  }

  private getLocalAddresses(): string[] {
    const interfaces = os.networkInterfaces();
    const addresses: string[] = [];

    for (const interfaceName in interfaces) {
      const networkInterface = interfaces[interfaceName];
      if (networkInterface) {
        for (const net of networkInterface) {
          // Skip internal and non-IPv4 addresses
          if (!net.internal && net.family === 'IPv4') {
            addresses.push(net.address);
          }
        }
      }
    }

    return addresses;
  }

  public destroy(): void {
    this.stopAdvertising();
    if (this.bonjourInstance) {
      this.bonjourInstance.destroy();
    }
  }
}