import BonjourService, { Service } from 'bonjour-service';
import { ConfigManager } from '../managers/config-manager';
import os from 'os';

export class MDNSService {
  private bonjour: BonjourService;
  private service: Service | null = null;
  private configManager: ConfigManager;
  private updateInterval: NodeJS.Timeout | null = null;

  constructor(configManager: ConfigManager) {
    this.configManager = configManager;
    this.bonjour = new BonjourService();
  }

  public startAdvertising(): void {
    const config = this.configManager.getConfig();
    const serviceName = `${config.hostname}-${config.agentId}`;
    
    console.log(`Starting mDNS advertising as: ${serviceName}`);

    try {
      // Stop existing service if any
      this.stopAdvertising();

      // Publish the service
      this.service = this.bonjour.publish({
        name: serviceName,
        type: '_officedisplay._tcp',
        port: config.apiPort,
        txt: this.getTxtRecord()
      });

      console.log(`mDNS service published:`, {
        name: serviceName,
        type: '_officedisplay._tcp.local',
        port: config.apiPort
      });

      // Set up periodic updates
      this.startPeriodicUpdates();

    } catch (error) {
      console.error('Error starting mDNS advertising:', error);
    }
  }

  public stopAdvertising(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }

    if (this.service) {
      console.log('Stopping mDNS advertising...');
      try {
        if (this.service && typeof this.service.stop === 'function') {
          this.service.stop();
        }
      } catch (error) {
        console.error('Error stopping mDNS service:', error);
      }
      this.service = null;
    }
  }

  private getTxtRecord(): Record<string, string> {
    const config = this.configManager.getConfig();
    const systemInfo = this.configManager.getSystemInfo();
    
    return {
      version: config.version,
      agentId: config.agentId,
      hostname: config.hostname,
      displayCount: config.displays.length.toString(),
      displays: config.displays.map(d => d.id).join(','),
      platform: systemInfo.platform,
      arch: systemInfo.arch,
      // Round uptime to minutes to reduce unnecessary updates
      uptime: Math.floor(systemInfo.uptime / 60).toString(),
      nodeVersion: systemInfo.nodeVersion,
      electronVersion: systemInfo.electronVersion || 'unknown',
      status: 'online',
      // Add gRPC port information  
      grpcPort: '8082'
      // Remove timestamp to avoid constant updates
      // timestamp: new Date().toISOString()
    };
  }

  private startPeriodicUpdates(): void {
    const interval = this.configManager.getSettings().mdnsUpdateInterval;
    
    // Only start periodic updates if interval is reasonable (> 5 minutes)
    if (interval < 300000) { // 5 minutes
      console.log(`mDNS periodic updates disabled (interval too frequent: ${interval}ms)`);
      return;
    }
    
    this.updateInterval = setInterval(() => {
      this.updateTxtRecord();
    }, interval);

    console.log(`mDNS periodic updates started (interval: ${interval}ms)`);
  }

  private updateTxtRecord(): void {
    if (!this.service) {
      return;
    }

    try {
      // Check if TXT record actually changed before restarting
      const newTxtRecord = this.getTxtRecord();
      const currentTxtRecord = this.service.txt || {};
      
      // Compare TXT records to see if update is needed
      if (this.isTxtRecordChanged(currentTxtRecord, newTxtRecord)) {
        console.log('mDNS TXT record changed, updating service...');
        
        // Note: bonjour-service doesn't have a direct update method
        // We need to stop and restart the service with new TXT record
        this.stopAdvertising();
        this.startAdvertising();
      } else {
        // No changes needed, just log that we checked
        console.log('mDNS TXT record unchanged, skipping update');
      }
      
    } catch (error) {
      console.error('Error updating mDNS TXT record:', error);
    }
  }

  private isTxtRecordChanged(current: Record<string, string>, updated: Record<string, string>): boolean {
    // Get keys from both objects
    const currentKeys = Object.keys(current);
    const updatedKeys = Object.keys(updated);
    
    // Check if number of keys is different
    if (currentKeys.length !== updatedKeys.length) {
      return true;
    }
    
    // Check if any key-value pair is different
    for (const key of updatedKeys) {
      if (current[key] !== updated[key]) {
        return true;
      }
    }
    
    return false;
  }

  public isAdvertising(): boolean {
    return this.service !== null;
  }

  public forceUpdateTxtRecord(): void {
    console.log('Force updating mDNS TXT record...');
    this.updateTxtRecord();
  }

  public getServiceInfo() {
    if (!this.service) {
      return null;
    }

    const config = this.configManager.getConfig();
    
    return {
      name: `${config.hostname}-${config.agentId}`,
      type: '_officedisplay._tcp.local',
      port: config.apiPort,
      txt: this.getTxtRecord(),
      addresses: this.getLocalAddresses()
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
    if (this.bonjour) {
      this.bonjour.destroy();
    }
  }
}
