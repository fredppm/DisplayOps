import { MiniPC, HostMetrics, DisplayState } from '@/types/shared-types';
import { createContextLogger } from '@/utils/logger';

const directDiscoveryLogger = createContextLogger('direct-discovery');

export type HostDiscoveredCallback = (host: MiniPC) => void;
export type HostRemovedCallback = (hostId: string) => void;

/**
 * 🚀 Direct Host Discovery Service - Web-Admin Integration
 * 
 * NEW Features:
 * - Direct connection to Web-Admin API
 * - Real-time host discovery via HTTP polling
 * - Automatic host status updates
 * - No mDNS dependency
 * 
 * REMOVED:
 * - mDNS discovery (replaced with direct API calls)
 * - Complex network scanning
 * - Multicast dependencies
 */
export class DirectHostDiscoveryService {
  private discoveredHosts: Map<string, MiniPC> = new Map();
  private onHostDiscoveredCallback: HostDiscoveredCallback | null = null;
  private onHostRemovedCallback: HostRemovedCallback | null = null;
  private isRunning: boolean = false;
  private webAdminUrl: string;
  private pollingInterval: NodeJS.Timeout | null = null;
  private pollingIntervalMs: number = 10000; // 10 seconds

  constructor(webAdminUrl: string = 'http://localhost:3000') {
    this.webAdminUrl = webAdminUrl;
  }

  public async startDiscovery(): Promise<void> {
    if (this.isRunning) {
      directDiscoveryLogger.info('Direct discovery service already running');
      return;
    }

    directDiscoveryLogger.info('🚀 Starting direct host discovery', {
      webAdminUrl: this.webAdminUrl
    });

    this.isRunning = true;

    // Start polling for hosts
    this.startPolling();

    directDiscoveryLogger.info('✅ Direct discovery service started');
  }

  public stopDiscovery(): void {
    if (!this.isRunning) {
      return;
    }

    directDiscoveryLogger.info('🛑 Stopping direct discovery service');

    this.isRunning = false;

    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }

    this.discoveredHosts.clear();
    directDiscoveryLogger.info('✅ Direct discovery service stopped');
  }

  private startPolling(): void {
    // Initial fetch
    this.fetchHostsFromWebAdmin();

    // Set up periodic polling
    this.pollingInterval = setInterval(() => {
      this.fetchHostsFromWebAdmin();
    }, this.pollingIntervalMs);
  }

  private async fetchHostsFromWebAdmin(): Promise<void> {
    try {
      const response = await fetch(`${this.webAdminUrl}/api/hosts`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch hosts');
      }

      const hosts = result.data || [];
      directDiscoveryLogger.debug('📋 Fetched hosts from Web-Admin', { count: hosts.length });

      // Process discovered hosts
      this.processDiscoveredHosts(hosts);

    } catch (error) {
      directDiscoveryLogger.error('❌ Failed to fetch hosts from Web-Admin:', error);
    }
  }

  private processDiscoveredHosts(hosts: any[]): void {
    const currentHostIds = new Set(this.discoveredHosts.keys());
    const newHostIds = new Set<string>();

    // Process each host from Web-Admin
    for (const hostData of hosts) {
      const hostId = hostData.agentId;
      newHostIds.add(hostId);

      // Convert Web-Admin host data to MiniPC format
      const miniPC: MiniPC = {
        id: hostId,
        hostname: hostData.hostname,
        ipAddress: hostData.ipAddress,
        port: hostData.grpcPort,
        status: hostData.status === 'online' ? 'online' : 'offline',
        lastSeen: new Date(hostData.lastSeen),
        version: hostData.version,
        systemInfo: {
          platform: hostData.systemInfo.platform,
          arch: hostData.systemInfo.arch,
          nodeVersion: hostData.systemInfo.nodeVersion,
          electronVersion: hostData.systemInfo.electronVersion,
          totalMemoryGB: hostData.systemInfo.totalMemoryGB,
          cpuCores: hostData.systemInfo.cpuCores,
          cpuModel: hostData.systemInfo.cpuModel,
          uptime: hostData.systemInfo.uptime
        },
        displays: hostData.displays.map((display: any) => ({
          id: display.id,
          name: display.name,
          width: display.width,
          height: display.height,
          isPrimary: display.isPrimary,
          isActive: false, // Will be updated via gRPC
          assignedDashboard: null // Will be updated via gRPC
        })),
        displayStates: hostData.displays.map((display: any) => ({
          id: display.id,
          name: display.name,
          width: display.width,
          height: display.height,
          isPrimary: display.isPrimary,
          isActive: false,
          assignedDashboard: null
        }))
      };

      // Check if this is a new host
      const existingHost = this.discoveredHosts.get(hostId);
      if (!existingHost) {
        // New host discovered
        this.discoveredHosts.set(hostId, miniPC);
        
        directDiscoveryLogger.info('🆕 New host discovered', {
          hostId,
          hostname: miniPC.hostname,
          ipAddress: miniPC.ipAddress
        });

        if (this.onHostDiscoveredCallback) {
          this.onHostDiscoveredCallback(miniPC);
        }
      } else {
        // Update existing host
        this.discoveredHosts.set(hostId, miniPC);
        
        directDiscoveryLogger.debug('🔄 Host updated', {
          hostId,
          status: miniPC.status
        });
      }
    }

    // Check for removed hosts
    for (const hostId of currentHostIds) {
      if (!newHostIds.has(hostId)) {
        const removedHost = this.discoveredHosts.get(hostId);
        this.discoveredHosts.delete(hostId);
        
        directDiscoveryLogger.info('🗑️ Host removed', { hostId });

        if (this.onHostRemovedCallback && removedHost) {
          this.onHostRemovedCallback(hostId);
        }
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

  public getHostById(hostId: string): MiniPC | null {
    return this.discoveredHosts.get(hostId) || null;
  }

  public isDiscoveryRunning(): boolean {
    return this.isRunning;
  }

  public async forceRefresh(): Promise<void> {
    if (this.isRunning) {
      await this.fetchHostsFromWebAdmin();
    }
  }
}

