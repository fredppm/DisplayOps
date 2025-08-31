import BonjourService from 'bonjour-service';
import { MiniPC } from '@/types/shared-types';

export interface MDNSDiscoveredHost {
  name: string;
  host: string;
  port: number;
  addresses: string[];
  txt?: Record<string, string>;
  fqdn: string;
}

export class MDNSDiscoveryService {
  private bonjour: BonjourService;
  private browser: any = null;
  private discoveredServices: Map<string, MDNSDiscoveredHost> = new Map();
  private onHostDiscoveredCallback?: (host: MDNSDiscoveredHost) => void;
  private onHostRemovedCallback?: (hostId: string) => void;

  constructor() {
    this.bonjour = new BonjourService();
  }

  public startDiscovery(): void {
    console.log('🔍 Starting mDNS discovery for Office Display hosts...');
    console.log('📡 Looking for service type: _officedisplay._tcp.local');
    
    try {
      // Stop existing browser if any
      this.stopDiscovery();

      // Browse for Office Display services
      this.browser = this.bonjour.find({ type: '_officedisplay._tcp' }, (service: any) => {
        this.handleServiceUp(service);
      });

      this.browser.on('down', (service: any) => {
        this.handleServiceDown(service);
      });

      console.log('✅ mDNS browser started for _officedisplay._tcp.local services');

    } catch (error) {
      console.error('❌ Failed to start mDNS discovery:', error);
      throw error;
    }
  }

  public stopDiscovery(): void {
    if (this.browser) {
      console.log('🛑 Stopping mDNS discovery...');
      try {
        this.browser.stop();
      } catch (error) {
        console.error('Error stopping mDNS browser:', error);
      }
      this.browser = null;
    }
    this.discoveredServices.clear();
  }

  private handleServiceUp(service: any): void {
    // Use agentId as unique identifier, fallback to service name
    const agentId = service.txt?.agentId || service.name;
    const serviceKey = agentId;
    
    console.log('✅ mDNS Office Display service discovered:', {
      name: service.name,
      host: service.host,
      port: service.port,
      type: service.type,
      addresses: service.addresses,
      txt: service.txt,
      fqdn: service.fqdn
    });
    
    console.log(`📡 Total services discovered: ${this.discoveredServices.size + 1}`);

    const discoveredHost: MDNSDiscoveredHost = {
      name: service.name,
      host: service.host,
      port: service.port,
      addresses: service.addresses || [],
      txt: service.txt || {},
      fqdn: service.fqdn
    };

    this.discoveredServices.set(serviceKey, discoveredHost);
    
    // Notify callback with discovered host
    if (this.onHostDiscoveredCallback) {
      this.onHostDiscoveredCallback(discoveredHost);
    }
  }

  private handleServiceDown(service: any): void {
    // Use agentId as unique identifier, fallback to service name
    const agentId = service.txt?.agentId || service.name;
    const serviceKey = agentId;
    
    console.log('❌ mDNS Office Display service removed:', {
      name: service.name,
      host: service.host,
      port: service.port,
      type: service.type
    });
    
    console.log(`📡 Total services remaining: ${this.discoveredServices.size - 1}`);

    this.discoveredServices.delete(serviceKey);

    // Notify callback
    if (this.onHostRemovedCallback) {
      this.onHostRemovedCallback(serviceKey);
    }
  }

  public getDiscoveredIPs(): string[] {
    const ips: string[] = [];
    
    this.discoveredServices.forEach((service) => {
      // Prefer IPv4 addresses from addresses array
      const ipv4Addresses = service.addresses.filter(addr => {
        // Simple IPv4 check
        return /^\d+\.\d+\.\d+\.\d+$/.test(addr);
      });

      if (ipv4Addresses.length > 0) {
        ips.push(...ipv4Addresses);
      } else if (service.host && service.host !== 'localhost') {
        // Fallback to host if no IPv4 addresses
        ips.push(service.host);
      }
    });

    // Remove duplicates
    return [...new Set(ips)];
  }

  public getDiscoveredServices(): MDNSDiscoveredHost[] {
    return Array.from(this.discoveredServices.values());
  }

  public onHostDiscovered(callback: (host: MDNSDiscoveredHost) => void): void {
    this.onHostDiscoveredCallback = callback;
  }

  public onHostRemoved(callback: (hostId: string) => void): void {
    this.onHostRemovedCallback = callback;
  }

  public destroy(): void {
    this.stopDiscovery();
    if (this.bonjour) {
      this.bonjour.destroy();
    }
  }
}