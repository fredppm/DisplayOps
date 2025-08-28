import BonjourService from 'bonjour-service';
import { MiniPC, MDNSServiceInfo, HostStatus } from '@/types/types';

export type HostDiscoveredCallback = (host: MiniPC) => void;
export type HostRemovedCallback = (hostId: string) => void;

export class DiscoveryService {
  private bonjour: BonjourService | null = null;
  private browser: any = null;
  private discoveredHosts: Map<string, MiniPC> = new Map();
  private onHostDiscoveredCallback: HostDiscoveredCallback | null = null;
  private onHostRemovedCallback: HostRemovedCallback | null = null;
  private isRunning: boolean = false;

  public async startDiscovery(): Promise<void> {
    if (this.isRunning) {
      console.log('Discovery service already running');
      return;
    }

    try {
      console.log('Starting mDNS discovery service...');
      
      // Initialize bonjour service
      this.bonjour = new BonjourService();
      
      // Start browsing for office TV services
      this.browser = this.bonjour.find({ type: 'officetv' });
      
      // Handle service up events
      this.browser.on('up', (service: any) => {
        console.log('Service discovered:', service);
        this.handleServiceUp(service);
      });
      
      // Handle service down events
      this.browser.on('down', (service: any) => {
        console.log('Service went down:', service);
        this.handleServiceDown(service);
      });

      this.isRunning = true;
      console.log('mDNS discovery service started successfully');
      
    } catch (error) {
      console.error('Failed to start discovery service:', error);
      throw error;
    }
  }

  public stopDiscovery(): void {
    if (!this.isRunning) {
      return;
    }

    console.log('Stopping mDNS discovery service...');
    
    if (this.browser) {
      this.browser.stop();
      this.browser = null;
    }
    
    if (this.bonjour) {
      this.bonjour.destroy();
      this.bonjour = null;
    }
    
    this.discoveredHosts.clear();
    this.isRunning = false;
    
    console.log('mDNS discovery service stopped');
  }

  private handleServiceUp(service: any): void {
    try {
      const mdnsInfo = this.parseServiceInfo(service);
      const host = this.createMiniPCFromService(mdnsInfo);
      
      this.discoveredHosts.set(host.id, host);
      
      if (this.onHostDiscoveredCallback) {
        this.onHostDiscoveredCallback(host);
      }
      
    } catch (error) {
      console.error('Error handling service up event:', error);
    }
  }

  private handleServiceDown(service: any): void {
    try {
      const hostId = this.extractHostIdFromService(service);
      
      if (hostId && this.discoveredHosts.has(hostId)) {
        this.discoveredHosts.delete(hostId);
        
        if (this.onHostRemovedCallback) {
          this.onHostRemovedCallback(hostId);
        }
      }
      
    } catch (error) {
      console.error('Error handling service down event:', error);
    }
  }

  private parseServiceInfo(service: any): MDNSServiceInfo {
    return {
      serviceName: '_officetv._tcp.local',
      instanceName: service.name,
      txtRecord: service.txt || {},
      addresses: service.addresses || [],
      port: service.port || 8080
    };
  }

  private createMiniPCFromService(mdnsInfo: MDNSServiceInfo): MiniPC {
    const txt = mdnsInfo.txtRecord;
    const hostId = txt.agentId || `agent-${mdnsInfo.instanceName}`;
    
    return {
      id: hostId,
      name: mdnsInfo.instanceName,
      hostname: txt.hostname || mdnsInfo.instanceName,
      ipAddress: mdnsInfo.addresses[0] || 'unknown',
      port: mdnsInfo.port,
      status: this.createHostStatus(txt),
      lastHeartbeat: new Date(),
      lastDiscovered: new Date(),
      version: txt.version || '1.0.0',
      tvs: this.parseTVIds(txt.displays),
      mdnsService: mdnsInfo
    };
  }

  private createHostStatus(txt: Record<string, string>): HostStatus {
    return {
      online: txt.status === 'online',
      cpuUsage: parseFloat(txt.cpuUsage) || 0,
      memoryUsage: parseFloat(txt.memoryUsage) || 0,
      browserProcesses: parseInt(txt.browserProcesses) || 0,
      lastError: txt.lastError
    };
  }

  private parseTVIds(displaysString?: string): string[] {
    if (!displaysString) {
      return ['display-1', 'display-2']; // Default
    }
    
    return displaysString.split(',').map(d => d.trim());
  }

  private extractHostIdFromService(service: any): string | null {
    return service.txt?.agentId || `agent-${service.name}`;
  }

  public onHostDiscovered(callback: HostDiscoveredCallback): void {
    this.onHostDiscoveredCallback = callback;
  }

  public onHostRemoved(callback: HostRemovedCallback): void {
    this.onHostRemovedCallback = callback;
  }

  public getDiscoveredHosts(): MiniPC[] {
    return Array.from(this.discoveredHosts.values());
  }

  public isDiscoveryRunning(): boolean {
    return this.isRunning;
  }

  // Manual host addition for testing or fallback
  public addManualHost(host: Partial<MiniPC>): void {
    const fullHost: MiniPC = {
      id: host.id || `manual-${Date.now()}`,
      name: host.name || 'Manual Host',
      hostname: host.hostname || 'localhost',
      ipAddress: host.ipAddress || '127.0.0.1',
      port: host.port || 8080,
      status: host.status || {
        online: false,
        cpuUsage: 0,
        memoryUsage: 0,
        browserProcesses: 0
      },
      lastHeartbeat: new Date(),
      lastDiscovered: new Date(),
      version: host.version || '1.0.0',
      tvs: host.tvs || ['display-1', 'display-2']
    };

    this.discoveredHosts.set(fullHost.id, fullHost);
    
    if (this.onHostDiscoveredCallback) {
      this.onHostDiscoveredCallback(fullHost);
    }
  }
}
