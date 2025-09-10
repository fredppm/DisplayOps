import bonjour, { Bonjour, Browser, RemoteService } from 'bonjour';
import { createContextLogger } from '@/utils/logger';

export interface MDNSDiscoveredHost {
  name: string;
  host: string;
  port: number;
  addresses: string[];
  txt?: Record<string, string>;
  fqdn: string;
}

const mdnsLogger = createContextLogger('mdns-discovery');

export class MDNSDiscoveryService {
  private bonjourInstance: Bonjour;
  private browser: Browser | null = null;
  private isDiscovering: boolean = false;
  private discoveredServices: Map<string, MDNSDiscoveredHost> = new Map();
  private onHostDiscoveredCallback?: (host: MDNSDiscoveredHost) => void;
  private onHostRemovedCallback?: (hostId: string) => void;

  constructor() {
    this.bonjourInstance = bonjour();
  }

  public startDiscovery(): void {
    mdnsLogger.info('Starting mDNS discovery for DisplayOps hosts', { serviceType: '_displayops._tcp.local' });
    
    try {
      this.stopDiscovery();

      this.isDiscovering = true;
      
      // Create browser for DisplayOps services
      this.browser = this.bonjourInstance.find({ type: 'displayops' });

      // Set up event listeners
      this.browser.on('up', (service: RemoteService) => {
        this.handleServiceUp(service);
      });

      this.browser.on('down', (service: RemoteService) => {
        this.handleServiceDown(service);
      });

      mdnsLogger.info('mDNS discovery started successfully');

    } catch (error) {
      mdnsLogger.error('Failed to start mDNS discovery', { error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  public stopDiscovery(): void {
    mdnsLogger.info('Stopping mDNS discovery');
    
    this.isDiscovering = false;
    
    if (this.browser) {
      this.browser.stop();
      this.browser = null;
    }
    
    this.discoveredServices.clear();
  }

  private handleServiceUp(service: RemoteService): void {
    if (!this.isDiscovering) return;

    const agentId = service.txt?.agentId || service.name;
    const serviceKey = agentId;
    
    // Skip if already discovered
    if (this.discoveredServices.has(serviceKey)) {
      return;
    }
    
    mdnsLogger.info('mDNS DisplayOps service discovered', {
      name: service.name,
      host: service.host,
      port: service.port,
      txt: service.txt
    });
    
    mdnsLogger.debug('Total services discovered', { totalServices: this.discoveredServices.size + 1 });

    const discoveredHost: MDNSDiscoveredHost = {
      name: service.name,
      host: service.host || 'unknown',
      port: service.port || 8082,
      addresses: service.addresses || [],
      txt: service.txt || {},
      fqdn: service.fqdn || `${service.name}._displayops._tcp.local`
    };

    this.discoveredServices.set(serviceKey, discoveredHost);
    
    // Notify callback with discovered host
    if (this.onHostDiscoveredCallback) {
      this.onHostDiscoveredCallback(discoveredHost);
    }
  }

  private handleServiceDown(service: RemoteService): void {
    if (!this.isDiscovering) return;

    const agentId = service.txt?.agentId || service.name;
    const serviceKey = agentId;
    
    if (this.discoveredServices.has(serviceKey)) {
      mdnsLogger.info('mDNS DisplayOps service removed', { serviceName: service.name });
      
      this.discoveredServices.delete(serviceKey);
      
      // Notify callback
      if (this.onHostRemovedCallback) {
        this.onHostRemovedCallback(serviceKey);
      }
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
      } else if (service.host && service.host !== 'localhost' && service.host !== 'unknown') {
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
    if (this.bonjourInstance) {
      this.bonjourInstance.destroy();
    }
  }
}