import { MiniPC, HostStatus } from '@/types/shared-types';
import axios from 'axios';

export type HostDiscoveredCallback = (host: MiniPC) => void;
export type HostRemovedCallback = (hostId: string) => void;

/**
 * Windows-friendly discovery service
 * Uses manual IP scanning instead of mDNS for better Windows compatibility
 */
export class WindowsDiscoveryService {
  private discoveredHosts: Map<string, MiniPC> = new Map();
  private onHostDiscoveredCallback: HostDiscoveredCallback | null = null;
  private onHostRemovedCallback: HostRemovedCallback | null = null;
  private isRunning: boolean = false;
  private scanInterval: NodeJS.Timeout | null = null;
  private lastScanTime: number = 0;

  // Default IPs to scan (can be configured)
  private ipRanges: string[] = [
    '127.0.0.1', // Only scan 127.0.0.1 to avoid duplicates
    // Add more IPs as needed: '192.168.1.100', '192.168.1.101', etc.
  ];

  public async startDiscovery(): Promise<void> {
    if (this.isRunning) {
      console.log('Windows discovery service already running');
      return;
    }

    try {
      console.log('Starting Windows-friendly discovery service...');
      console.log('Scanning IPs:', this.ipRanges.join(', '));
      
      this.isRunning = true;
      
      // Initial scan
      await this.scanForHosts();
      
      // Set up periodic scanning
      this.scanInterval = setInterval(() => {
        this.scanForHosts();
      }, 30000); // Scan every 30 seconds (optimized for faster discovery)
      
      console.log('Windows discovery service started successfully');
      
    } catch (error) {
      console.error('Failed to start Windows discovery service:', error);
      throw error;
    }
  }

  public stopDiscovery(): void {
    if (!this.isRunning) {
      return;
    }

    console.log('Stopping Windows discovery service...');
    
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
    }
    
    this.discoveredHosts.clear();
    this.isRunning = false;
    
    console.log('Windows discovery service stopped');
  }

  private async scanForHosts(): Promise<void> {
    // Throttle scanning - avoid scanning too frequently
    const now = Date.now();
    if (now - this.lastScanTime < 10000) { // Minimum 10 seconds between scans (reduced for debug)
      console.log('⏳ Skipping scan - too recent');
      return;
    }
    
    this.lastScanTime = now;
    console.log('🔍 Scanning for Office Display hosts...');
    
    const scanPromises = this.ipRanges.map(ip => this.checkHost(ip));
    const results = await Promise.allSettled(scanPromises);
    
    results.forEach((result, index) => {
      const ip = this.ipRanges[index];
      if (result.status === 'fulfilled' && result.value) {
        this.handleHostFound(ip, result.value);
      } else {
        this.handleHostLost(ip);
      }
    });
  }

  private async checkHost(ip: string, port: number = 8080): Promise<any | null> {
    try {
      console.log(`🔍 Checking host ${ip}:${port}...`);
      // Simple status check with aggressive timeout
      const response = await axios.get(`http://${ip}:${port}/api/status`, {
        timeout: 3000, // Reduced timeout
        validateStatus: (status) => status === 200,
        headers: {
          'User-Agent': 'Office-Display-Discovery/1.0'
        }
      });
      
      console.log(`✅ Host ${ip}:${port} responded with status ${response.status}`);

      if (response.data && response.data.success) {
        // Also fetch mDNS info
        let mdnsInfo = null;
        try {
          const mdnsResponse = await axios.get(`http://${ip}:${port}/api/mdns/info`, {
            timeout: 3000,
            validateStatus: (status) => status === 200
          });
          if (mdnsResponse.data && mdnsResponse.data.success) {
            mdnsInfo = mdnsResponse.data.data;
          }
        } catch (mdnsError) {
          // mDNS info is optional, don't fail if not available
          console.log(`📡 mDNS info not available for ${ip}: ${mdnsError instanceof Error ? mdnsError.message : 'Unknown error'}`);
        }

        return {
          ip,
          port,
          health: { success: true },
          status: response.data,
          mdnsInfo
        };
      }
    } catch (error) {
      // Host not available - expected during discovery
      console.log(`❌ Host ${ip}:${port} not reachable:`, error instanceof Error ? error.message : String(error));
    }
    
    return null;
  }

  private async handleHostFound(ip: string, hostData: any): Promise<void> {
    // Normalize IP to avoid duplicates (localhost -> 127.0.0.1)
    const normalizedIP = ip === 'localhost' ? '127.0.0.1' : ip;
    const hostId = `agent-${normalizedIP.replace(/\./g, '-')}-${hostData.port}`;
    
    const hostStatus: HostStatus = {
      online: true,
      cpuUsage: hostData.status?.data?.hostStatus?.cpuUsage || 0,
      memoryUsage: hostData.status?.data?.hostStatus?.memoryUsage || 0,
      browserProcesses: hostData.status?.data?.hostStatus?.browserProcesses || 0
    };

    // Build mDNS service info if available
    let mdnsService = undefined;
    if (hostData.mdnsInfo && hostData.mdnsInfo.serviceInfo) {
      const serviceInfo = hostData.mdnsInfo.serviceInfo;
      mdnsService = {
        serviceName: serviceInfo.type || '_officetv._tcp.local',
        instanceName: serviceInfo.name || 'N/A',
        txtRecord: serviceInfo.txt || {},
        addresses: serviceInfo.addresses || [normalizedIP],
        port: serviceInfo.port || hostData.port
      };
    }

    const host: MiniPC = {
      id: hostId,
      name: `Office Display Host`,
      hostname: normalizedIP,
      ipAddress: normalizedIP,
      port: hostData.port,
      status: hostStatus,
      lastHeartbeat: new Date(),
      lastDiscovered: new Date(),
      version: hostData.health?.data?.version || '1.0.0',
      tvs: [], // Legacy property
      displays: await this.getHostDisplays(normalizedIP, hostData.port) || ['display-1', 'display-2'], // Get real displays
      mdnsService
    };

    const existing = this.discoveredHosts.get(hostId);
    if (!existing) {
      console.log(`✅ Windows discovery: Found new host at ${ip}${mdnsService ? ' with mDNS service' : ''}`);
      this.discoveredHosts.set(hostId, host);
      
      if (this.onHostDiscoveredCallback) {
        this.onHostDiscoveredCallback(host);
      }
    } else {
      // Update existing host
      this.discoveredHosts.set(hostId, { ...existing, ...host, lastHeartbeat: new Date() });
      
      if (this.onHostDiscoveredCallback) {
        this.onHostDiscoveredCallback(host);
      }
    }
  }

  private handleHostLost(ip: string): void {
    const normalizedIP = ip === 'localhost' ? '127.0.0.1' : ip;
    const hostId = `agent-${normalizedIP.replace(/\./g, '-')}-8080`;
    
    if (this.discoveredHosts.has(hostId)) {
      console.log(`⬇️  Windows discovery: Host lost at ${ip}`);
      this.discoveredHosts.delete(hostId);
      
      if (this.onHostRemovedCallback) {
        this.onHostRemovedCallback(hostId);
      }
    }
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

  // Add manual host for testing
  public async addManualHost(host: Partial<MiniPC>): Promise<void> {
    const displays = await this.getHostDisplays(host.hostname || 'localhost', host.port || 8080) || host.displays || ['display-1', 'display-2'];
    
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
      tvs: [], // Legacy property
      displays: displays
    };

    this.discoveredHosts.set(fullHost.id, fullHost);
    
    if (this.onHostDiscoveredCallback) {
      this.onHostDiscoveredCallback(fullHost);
    }
  }

  // Get real displays from host
  private async getHostDisplays(hostname: string, port: number): Promise<string[] | null> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout

      const response = await fetch(`http://${hostname}:${port}/api/displays`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const result = await response.json();
        if (result.success && Array.isArray(result.data)) {
          const displayIds = result.data.map((display: any, index: number) => `display-${index + 1}`);
          console.log(`📺 Host ${hostname}: Detected ${displayIds.length} real displays`);
          return displayIds;
        }
      }
    } catch (error: any) {
      // Silently fail and use defaults - this is expected during host startup
      console.debug(`Could not get displays from ${hostname}:${port}:`, error.message);
    }
    
    return null;
  }

  // Configure IPs to scan
  public setIPRanges(ips: string[]): void {
    this.ipRanges = ips;
    console.log('Updated scan IPs:', this.ipRanges.join(', '));
  }
}
