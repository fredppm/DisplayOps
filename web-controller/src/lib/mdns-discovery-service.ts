import mdns from 'multicast-dns';
import { createContextLogger } from '@/utils/logger';
import { cwd } from 'process';

export interface MDNSDiscoveredHost {
  name: string;
  host: string;
  port: number;
  addresses: string[];
  txt?: Record<string, string>;
  fqdn: string;
  lastSeen?: number; // Timestamp of last mDNS response
  ttl?: number; // Time to live from mDNS response
}

interface MulticastDNS {
  query(packet: any): void;
  on(event: string, listener: (...args: any[]) => void): void;
  destroy(): void;
}

interface MDNSAnswer {
  name: string;
  type: string;
  data: any;
  ttl?: number;
}

const mdnsLogger = createContextLogger('mdns-discovery');

export class MDNSDiscoveryService {
  private mdnsInstance: MulticastDNS | null = null;
  private isDiscovering: boolean = false;
  private discoveredServices: Map<string, MDNSDiscoveredHost> = new Map();
  private onHostDiscoveredCallback?: (host: MDNSDiscoveredHost) => void;
  private onHostRemovedCallback?: (hostId: string) => void;
  private queryInterval: NodeJS.Timeout | null = null;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private serviceType: string = '_displayops._tcp.local';
  private readonly HOST_TIMEOUT_MS = 30000; // 30 seconds timeout for hosts

  constructor() {
    // Constructor is now empty, mdns instance will be created on demand
  }

  public startDiscovery(): void {
    mdnsLogger.info('🚀 Starting mDNS discovery for DisplayOps hosts', { serviceType: this.serviceType });

    try {
      this.stopDiscovery();

      this.isDiscovering = true;

      // Create multicast-dns instance
      this.mdnsInstance = mdns();

      // Set up response listener
      this.mdnsInstance.on('response', (response: { answers?: Array<MDNSAnswer> }) => {
        this.handleResponse(response);
      });

      // Start periodic querying
      this.startPeriodicQueries();

      // Start periodic cleanup of stale hosts
      this.startPeriodicCleanup();

      mdnsLogger.info('✅ mDNS discovery started successfully');

    } catch (error) {
      mdnsLogger.error('Failed to start mDNS discovery', { error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  public stopDiscovery(): void {
    mdnsLogger.info('Stopping mDNS discovery');

    this.isDiscovering = false;

    if (this.queryInterval) {
      clearInterval(this.queryInterval);
      this.queryInterval = null;
    }

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    if (this.mdnsInstance) {
      this.mdnsInstance.destroy();
      this.mdnsInstance = null;
    }

    this.discoveredServices.clear();
  }

  private startPeriodicQueries(): void {
    // Send initial query
    this.sendQuery();

    // Set up periodic queries every 5 seconds
    this.queryInterval = setInterval(() => {
      this.sendQuery();
    }, 5000);
  }

  private startPeriodicCleanup(): void {
    // Clean up stale hosts every 10 seconds
    this.cleanupInterval = setInterval(() => {
      this.cleanupStaleHosts();
    }, 10000);
  }

  private cleanupStaleHosts(): void {
    if (!this.isDiscovering) return;

    const now = Date.now();
    const hostsToRemove: string[] = [];

    this.discoveredServices.forEach((host, serviceKey) => {
      if (host.lastSeen) {
        const timeSinceLastSeen = now - host.lastSeen;
        const timeoutThreshold = host.ttl ? host.ttl * 1000 : this.HOST_TIMEOUT_MS;
        
        if (timeSinceLastSeen > timeoutThreshold) {
          mdnsLogger.info('Host timed out, removing from discovered services', {
            serviceKey,
            name: host.name,
            lastSeen: new Date(host.lastSeen).toISOString(),
            timeSinceLastSeen: `${timeSinceLastSeen}ms`,
            threshold: `${timeoutThreshold}ms`
          });
          hostsToRemove.push(serviceKey);
        }
      }
    });

    // Remove stale hosts and notify callback
    hostsToRemove.forEach(serviceKey => {
      this.discoveredServices.delete(serviceKey);
      if (this.onHostRemovedCallback) {
        this.onHostRemovedCallback(serviceKey);
      }
    });
  }

  private sendQuery(): void {
    if (!this.mdnsInstance || !this.isDiscovering) return;

    mdnsLogger.debug('📡 Sending mDNS query for DisplayOps services');
    this.mdnsInstance.query({
      questions: [
        {
          name: this.serviceType,
          type: 'TXT'
        },
        {
          name: this.serviceType,
          type: 'PTR'
        },
        {
          name: this.serviceType,
          type: 'SRV'
        },
        {
          name: this.serviceType,
          type: 'A'
        }
      ]
    });
  }

  private handleResponse(response: { answers?: Array<MDNSAnswer> }): void {
    if (!this.isDiscovering) return;

    const now = Date.now();
    const services = new Map<string, Partial<MDNSDiscoveredHost>>();
    
    // Check for goodbye packets (TTL = 0) first
    for (const answer of response.answers || []) {
      if (answer.ttl === 0 && answer.name === this.serviceType) {
        this.handleGoodbyePacket(answer);
        continue;
      }
    }

    // Primeiro, procure por PTR com name == this.serviceType
    let foundPtr: MDNSAnswer | null = null;
    let serviceFqdn = '';
    let serviceName = '';
    let serviceTtl = 0;
    
    for (const answer of response.answers || []) {
      if (answer.type === 'PTR' && answer.name === this.serviceType && answer.ttl !== 0) {
        foundPtr = answer;
        serviceFqdn = answer.data as string;
        serviceName = this.extractServiceName(serviceFqdn) || '';
        serviceTtl = answer.ttl || 120; // Default TTL of 120 seconds
        break;
      }
    }

    if (foundPtr && serviceName) {
      let service: Partial<MDNSDiscoveredHost> = { 
        name: serviceName, 
        fqdn: serviceFqdn,
        lastSeen: now,
        ttl: serviceTtl
      };

      // To handle unordered answers, we first collect SRV, TXT, and all A records, then process them after.
      let srvAnswer: MDNSAnswer | null = null;
      let txtAnswer: MDNSAnswer | null = null;
      const aAnswers: MDNSAnswer[] = [];

      for (const answer of response.answers || []) {
        if (answer.ttl === 0) continue; // Skip goodbye packets in this loop

        if (answer.type === 'SRV' && answer.name === serviceFqdn) {
          srvAnswer = answer;
        }
        if (answer.type === 'TXT' && answer.name === serviceFqdn) {
          txtAnswer = answer;
        }
        if (answer.type === 'A') {
          aAnswers.push(answer);
        }
      }

      // Process SRV first to get host and port
      if (srvAnswer) {
        const srvData = srvAnswer.data as { port: number; target: string };
        service.port = srvData.port;
        service.host = srvData.target.replace(/\.local$/, '.local');
        // Update TTL if SRV has a lower TTL
        if (srvAnswer.ttl && (!service.ttl || srvAnswer.ttl < service.ttl)) {
          service.ttl = srvAnswer.ttl;
        }
      }

      // Process TXT
      if (txtAnswer) {
        service.txt = this.parseTxtRecord(txtAnswer.data as string[]);
        // Update TTL if TXT has a lower TTL
        if (txtAnswer.ttl && (!service.ttl || txtAnswer.ttl < service.ttl)) {
          service.ttl = txtAnswer.ttl;
        }
      }

      // Process A records, but only add addresses if we know the host
      if (service.host) {
        for (const aAnswer of aAnswers) {
          if (aAnswer.name === service.host) {
            service.addresses = service.addresses || [];
            if (!service.addresses.includes(aAnswer.data as string)) {
              service.addresses.push(aAnswer.data as string);
            }
            // Update TTL if A record has a lower TTL
            if (aAnswer.ttl && (!service.ttl || aAnswer.ttl < service.ttl)) {
              service.ttl = aAnswer.ttl;
            }
          }
        }
      }

      services.set(serviceName, service);
    }

    // Process discovered services
    services.forEach((service, serviceName) => {
      if (service.host && service.port) {
        this.processDiscoveredService(serviceName, service);
      }
    });
  }

  private handleGoodbyePacket(answer: MDNSAnswer): void {
    mdnsLogger.info('Received goodbye packet (TTL=0)', { 
      name: answer.name, 
      type: answer.type 
    });

    // Check if this goodbye packet is for our service type
    if (answer.type === 'PTR' && answer.name === this.serviceType) {
      const serviceFqdn = answer.data as string;
      const serviceName = this.extractServiceName(serviceFqdn);
      
      if (serviceName) {
        const agentId = serviceName; // Could also check txt records for agentId
        const serviceKey = agentId;
        
        if (this.discoveredServices.has(serviceKey)) {
          mdnsLogger.info('Host sent goodbye packet, removing immediately', {
            serviceKey,
            serviceName,
            serviceFqdn
          });
          
          this.discoveredServices.delete(serviceKey);
          
          if (this.onHostRemovedCallback) {
            this.onHostRemovedCallback(serviceKey);
          }
        }
      }
    }
  }

  private extractServiceName(fqdn: string): string | null {
    const match = fqdn.match(/^(.+?)\._displayops\._tcp\.local$/);
    return match ? match[1] : null;
  }

  private parseTxtRecord(txtData: string[] | Buffer | any): Record<string, string> {
    const result: Record<string, string> = {};
    
    let entries: string[] = [];
    
    if (Array.isArray(txtData)) {
      // Array can contain strings or Buffers
      entries = txtData.map(entry => {
        if (Buffer.isBuffer(entry)) {
          return entry.toString('utf8');
        } else if (typeof entry === 'string') {
          return entry;
        } else {
          return String(entry);
        }
      });
    } else if (Buffer.isBuffer(txtData)) {
      // Single buffer - parse as null-terminated string entries
      const str = txtData.toString('utf8');
      entries = str.split('\0').filter(entry => entry.length > 0);
    } else if (typeof txtData === 'string') {
      entries = [txtData];
    } else {
      mdnsLogger.warn('Unknown TXT data format', { type: typeof txtData, data: txtData });
      return result;
    }
    
    for (const entry of entries) {
      if (typeof entry === 'string' && entry.length > 0) {
        const equalIndex = entry.indexOf('=');
        if (equalIndex > 0) {
          const key = entry.substring(0, equalIndex);
          const value = entry.substring(equalIndex + 1);
          result[key] = value;
        } else if (equalIndex === -1) {
          // Key without value (boolean flag)
          result[entry] = 'true';
        }
      }
    }
    
    return result;
  }

  private processDiscoveredService(serviceName: string, serviceData: Partial<MDNSDiscoveredHost>): void {
    const agentId = serviceData.txt?.agentId || serviceName;
    const serviceKey = agentId;

    // Check if already discovered
    const existingHost = this.discoveredServices.get(serviceKey);
    if (existingHost) {
      // Update lastSeen timestamp and TTL for existing host
      existingHost.lastSeen = serviceData.lastSeen || Date.now();
      if (serviceData.ttl) {
        existingHost.ttl = serviceData.ttl;
      }
      mdnsLogger.debug('Updated existing host lastSeen timestamp', {
        serviceKey,
        lastSeen: new Date(existingHost.lastSeen).toISOString(),
        ttl: existingHost.ttl
      });
      return;
    }

    const discoveredHost: MDNSDiscoveredHost = {
      name: serviceName,
      host: serviceData.host || 'unknown',
      port: serviceData.port || 8082,
      addresses: serviceData.addresses || [],
      txt: serviceData.txt || {},
      fqdn: serviceData.fqdn || `${serviceName}.${this.serviceType}`,
      lastSeen: serviceData.lastSeen || Date.now(),
      ttl: serviceData.ttl || 120
    };

    mdnsLogger.info('mDNS DisplayOps service discovered', {
      name: discoveredHost.name,
      host: discoveredHost.host,
      addresses: discoveredHost.addresses,
      port: discoveredHost.port,
      txt: discoveredHost.txt,
      ttl: discoveredHost.ttl
    });

    this.discoveredServices.set(serviceKey, discoveredHost);

    // Notify callback with discovered host
    if (this.onHostDiscoveredCallback) {
      this.onHostDiscoveredCallback(discoveredHost);
    }
  }

  public onHostDiscovered(callback: (host: MDNSDiscoveredHost) => void): void {
    this.onHostDiscoveredCallback = callback;
  }

  public onHostRemoved(callback: (hostId: string) => void): void {
    this.onHostRemovedCallback = callback;
  }

  public destroy(): void {
    this.stopDiscovery();
  }
}