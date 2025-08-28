import { MiniPC, HostStatus } from '@/types/types';
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
      }, 5000); // Scan every 5 seconds (much faster for development)
      
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
    console.log('🔍 Scanning for Office TV hosts...');
    
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
      // Try to connect to the host agent
      const response = await axios.get(`http://${ip}:${port}/health`, {
        timeout: 2000, // Faster timeout
        validateStatus: (status) => status === 200
      });

      if (response.data && response.data.success) {
        // Get detailed status
        const statusResponse = await axios.get(`http://${ip}:${port}/api/status`, {
          timeout: 2000 // Faster timeout
        });
        
        return {
          ip,
          port,
          health: response.data,
          status: statusResponse.data
        };
      }
    } catch (error) {
      // Host not available
      return null;
    }
    
    return null;
  }

  private handleHostFound(ip: string, hostData: any): void {
    // Normalize IP to avoid duplicates (localhost -> 127.0.0.1)
    const normalizedIP = ip === 'localhost' ? '127.0.0.1' : ip;
    const hostId = `agent-${normalizedIP.replace(/\./g, '-')}-${hostData.port}`;
    
    const hostStatus: HostStatus = {
      online: true,
      cpuUsage: hostData.status?.data?.hostStatus?.cpuUsage || 0,
      memoryUsage: hostData.status?.data?.hostStatus?.memoryUsage || 0,
      browserProcesses: hostData.status?.data?.hostStatus?.browserProcesses || 0
    };

    const host: MiniPC = {
      id: hostId,
      name: `Office TV Host`,
      hostname: normalizedIP,
      ipAddress: normalizedIP,
      port: hostData.port,
      status: hostStatus,
      lastHeartbeat: new Date(),
      lastDiscovered: new Date(),
      version: hostData.health?.data?.version || '1.0.0',
      tvs: ['display-1', 'display-2'] // Default displays
    };

    const existing = this.discoveredHosts.get(hostId);
    if (!existing) {
      console.log(`✅ Windows discovery: Found new host at ${ip}`);
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

  // Configure IPs to scan
  public setIPRanges(ips: string[]): void {
    this.ipRanges = ips;
    console.log('Updated scan IPs:', this.ipRanges.join(', '));
  }
}
