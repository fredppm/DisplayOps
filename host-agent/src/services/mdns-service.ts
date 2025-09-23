import mdns from 'multicast-dns';
import { ConfigManager } from '../managers/config-manager';
import { StateManager } from './state-manager';
import os from 'os';

interface MulticastDNS {
  query(packet: any): void;
  respond(answers: any[]): void;
  on(event: string, listener: (...args: any[]) => void): void;
  destroy(): void;
}

export class MDNSService {
  private mdnsInstance: MulticastDNS | null = null;
  private isAdvertising: boolean = false;
  private configManager: ConfigManager;
  private stateManager: StateManager;
  private updateInterval: NodeJS.Timeout | null = null;
  private serviceName: string = '';
  private serviceType: string = '_displayops._tcp.local';
  private servicePort: number = 8082;

  constructor(configManager: ConfigManager, stateManager: StateManager) {
    this.configManager = configManager;
    this.stateManager = stateManager;
  }

  public startAdvertising(): void {
    const config = this.configManager.getConfig();
    this.serviceName = `${config.hostname}-${config.agentId}`;
    
    console.log(`🚀 [MULTICAST-DNS] Starting mDNS advertising as: ${this.serviceName}`);

    try {
      // Stop existing service if any
      this.stopAdvertising();

      this.isAdvertising = true;
      
      // Create multicast-dns instance
      this.mdnsInstance = mdns();
      
      // Set up query listener to respond to service discovery
      this.mdnsInstance.on('query', (query: { questions?: Array<{ name: string; type: string; class: string }> }) => {
        this.handleQuery(query);
      });

      console.log('✅ [MULTICAST-DNS] mDNS service published successfully');
      console.log(`   Name: ${this.serviceName}`);
      console.log(`   Type: ${this.serviceType}`);
      console.log(`   Port: ${this.servicePort}`);

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
    
    if (this.mdnsInstance) {
      this.mdnsInstance.destroy();
      this.mdnsInstance = null;
    }
  }

  private handleQuery(query: { questions?: Array<{ name: string; type: string; class: string }> }): void {
    if (!this.isAdvertising || !this.mdnsInstance) return;

    const responses: Array<{
      name: string;
      type: string;
      class: string;
      ttl: number;
      data: any;
    }> = [];

    for (const question of query.questions || []) {
      const questionName = question.name.toLowerCase();
      
      // Respond to PTR queries for our service type
      if (question.type === 'PTR' && questionName === this.serviceType) {
        responses.push({
          name: this.serviceType,
          type: 'PTR',
          class: 'IN',
          ttl: 120,
          data: `${this.serviceName}.${this.serviceType}`
        });
      }
      
      // Respond to SRV queries for our specific service
      if (question.type === 'SRV' && questionName === `${this.serviceType}`) {
        responses.push({
          name: `${this.serviceName}.${this.serviceType}`,
          type: 'SRV',
          class: 'IN',
          ttl: 120,
          data: {
            priority: 0,
            weight: 0,
            port: this.servicePort,
            target: `${os.hostname()}.local`
          }
        });
      }
      
      // Respond to TXT queries for our specific service
      if (question.type === 'TXT' && questionName === `${this.serviceType}`) {
        const txtRecord = this.getTxtRecord();
        const txtData = Object.entries(txtRecord).map(([key, value]) => `${key}=${value}`);
        
        responses.push({
          name: `${this.serviceName}.${this.serviceType}`,
          type: 'TXT',
          class: 'IN',
          ttl: 120,
          data: txtData
        });
      }

      // Respond to A queries for our hostname
      if (question.type === 'A' && questionName === `${this.serviceType}`) {
        const addresses = this.getLocalAddresses();
        for (const address of addresses) {
          responses.push({
            name: `${os.hostname()}.local`,
            type: 'A',
            class: 'IN',
            ttl: 120,
            data: address
          });
        }
      }
    }

    if (responses.length > 0) {
      this.mdnsInstance.respond(responses);
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
    if (!this.isAdvertising || !this.mdnsInstance) {
      return;
    }

    try {
      console.log('🔄 Updating mDNS TXT record...');
      
      // With multicast-dns, we don't need to republish
      // The TXT record will be updated when the next query comes in
      // since getTxtRecord() is called dynamically in handleQuery
      
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
    if (!this.isAdvertising || !this.mdnsInstance) {
      return null;
    }
    
    return {
      name: this.serviceName,
      type: this.serviceType,
      port: this.servicePort,
      txt: this.getTxtRecord(),
      addresses: this.getLocalAddresses(),
      host: `${os.hostname()}.local`,
      fqdn: `${this.serviceName}.${this.serviceType}`
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
  }
}