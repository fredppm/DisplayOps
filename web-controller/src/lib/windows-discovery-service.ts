import { MiniPC, HostMetrics, DisplayState } from '@/types/shared-types';
import { MDNSDiscoveryService } from './mdns-discovery-service';
import { GrpcClientService } from './server/grpc-client-service';
import { createContextLogger } from '@/utils/logger';

const windowsDiscoveryLogger = createContextLogger('windows-discovery');

export type HostDiscoveredCallback = (host: MiniPC) => void;
export type HostRemovedCallback = (hostId: string) => void;

/**
 * 🚀 Modern gRPC-enabled discovery service for DisplayOps hosts
 * 
 * NEW Features:
 * - Real-time gRPC streaming events (NO MORE POLLING!)
 * - Automatic host discovery via mDNS (_displayops._tcp.local)
 * - Instant display change notifications via gRPC streams
 * - Automatic reconnection handling
 * 
 * REMOVED:
 * - HTTP polling (replaced with gRPC streaming)
 * - Fixed IP ranges (now purely mDNS-based)
 * - Scan intervals (events are real-time)
 */
export class WindowsDiscoveryService {
  private discoveredHosts: Map<string, MiniPC> = new Map();
  private onHostDiscoveredCallback: HostDiscoveredCallback | null = null;
  private onHostRemovedCallback: HostRemovedCallback | null = null;
  private isRunning: boolean = false;
  private mdnsService: MDNSDiscoveryService;
  private grpcService: GrpcClientService | null = null;

  constructor() {
    this.mdnsService = new MDNSDiscoveryService();
    
    try {
      this.grpcService = GrpcClientService.getInstance();
      this.setupGrpcEventHandlers();
    } catch (error) {
      windowsDiscoveryLogger.warn('gRPC service not available, continuing with mDNS only', { error: error instanceof Error ? error.message : String(error) });
      // gRPC service will be null, we'll handle this in other methods
    }
  }

  public async startDiscovery(): Promise<void> {
    if (this.isRunning) {
      windowsDiscoveryLogger.info('gRPC Discovery service already running');
      return;
    }

    try {
      windowsDiscoveryLogger.info('Starting modern gRPC-enabled discovery service');
      
      this.isRunning = true;
      
      // Start mDNS discovery for host detection
      this.startMDNSDiscovery();
      
      windowsDiscoveryLogger.info('gRPC Discovery service started - no more polling!');
      
    } catch (error) {
      windowsDiscoveryLogger.error('Failed to start gRPC discovery service', { error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  public stopDiscovery(): void {
    if (!this.isRunning) {
      return;
    }

    windowsDiscoveryLogger.info('Stopping gRPC discovery service');
    
    // Stop gRPC service if available
    if (this.grpcService) {
      this.grpcService.stop();
    }

    // Stop mDNS discovery
    if (this.mdnsService) {
      this.mdnsService.stopDiscovery();
    }
    
    this.discoveredHosts.clear();
    this.isRunning = false;
    
    windowsDiscoveryLogger.info('gRPC Discovery service stopped');
  }

  private startMDNSDiscovery(): void {
    windowsDiscoveryLogger.info('Starting mDNS discovery for gRPC hosts');
    
    try {
      // Set up mDNS callbacks - now connects gRPC instead of HTTP polling
      this.mdnsService.onHostDiscovered((discoveredHost) => {
        windowsDiscoveryLogger.info('mDNS discovered host', { agentId: discoveredHost.txt?.agentId || discoveredHost.name });
        this.connectToDiscoveredHost(discoveredHost);
      });

      this.mdnsService.onHostRemoved((hostId: string) => {
        windowsDiscoveryLogger.info('mDNS host removed', { hostId });
        // Note: gRPC service will handle disconnections automatically
        // via heartbeat timeouts, so no immediate action needed here
      });

      // Start mDNS discovery
      this.mdnsService.startDiscovery();
      
    } catch (error) {
      windowsDiscoveryLogger.error('Failed to start mDNS discovery', { error: error instanceof Error ? error.message : String(error) });
      // Continue with fallback localhost if enabled
      if (process.env.OFFICE_DISPLAY_INCLUDE_LOCALHOST === 'true') {
        windowsDiscoveryLogger.info('Fallback: Attempting localhost connection');
        const localhostHost = {
          name: 'localhost-agent',
          host: 'localhost',
          port: 8082, // gRPC port
          addresses: ['127.0.0.1'],
          txt: { agentId: 'localhost-agent' },
          fqdn: 'localhost._displayops._tcp.local'
        };
        this.connectToDiscoveredHost(localhostHost);
      }
    }
  }

  // Connect to discovered host via gRPC using agentId as unique identifier
  private async connectToDiscoveredHost(discoveredHost: any): Promise<void> {
    try {
      // Use agentId as unique identifier
      const agentId = discoveredHost.txt?.agentId || discoveredHost.name;
      const hostId = agentId;
      
      // Select primary IP (prefer non link-local, non-docker IPs)
      const primaryIP = this.selectPrimaryIP(discoveredHost.addresses);
      
      windowsDiscoveryLogger.info('Connecting to host', {
        hostId,
        primaryIP,
        totalIPs: discoveredHost.addresses.length
      });
      
      const host: MiniPC = {
        id: hostId,
        name: discoveredHost.host, // Use hostname as name
        hostname: discoveredHost.host, // DNS name (e.g., 'VTEX-B9LH6Z3')
        ipAddress: primaryIP, // IP address (e.g., '192.168.1.227')
        port: discoveredHost.port,
        metrics: {
          online: false, // Will be updated via gRPC events
          cpuUsage: 0,
          memoryUsage: 0,
          browserProcesses: 0
        },
        debugEnabled: false, // Will be updated via gRPC events
        lastHeartbeat: new Date(),
        lastDiscovered: new Date(),
        version: discoveredHost.txt?.version || 'unknown',
        displays: discoveredHost.txt?.displays?.split(',') || [],
        mdnsService: {
          serviceName: '_displayops._tcp.local',
          instanceName: discoveredHost.name,
          txtRecord: discoveredHost.txt,
          addresses: discoveredHost.addresses,
          port: discoveredHost.port
        }
      };

      // Attempt gRPC connection
      if (this.grpcService) {
        await this.grpcService.connectToHost(host);
      } else {
        // Fallback: mark host as discovered but without gRPC connection
        this.discoveredHosts.set(host.id, host);
        if (this.onHostDiscoveredCallback) {
          this.onHostDiscoveredCallback(host);
        }
      }
      
    } catch (error) {
      windowsDiscoveryLogger.error('Failed to connect to host', { hostId: discoveredHost.txt?.agentId || discoveredHost.name, error: error instanceof Error ? error.message : String(error) });
    }
  }
  
  // Helper method to select the best IP address for connection
  private selectPrimaryIP(addresses: string[]): string {
    if (!addresses || addresses.length === 0) {
      return 'localhost';
    }
    
    // Filter out IPv6 addresses for now
    const ipv4Addresses = addresses.filter(addr => 
      !addr.includes(':') && // Not IPv6
      addr !== '127.0.0.1' && // Not localhost
      addr !== '0.0.0.0' // Not wildcard
    );
    
    if (ipv4Addresses.length === 0) {
      return addresses[0]; // Fallback to first address
    }
    
    // Prefer addresses that are not link-local (169.254.x.x) or Docker (172.x.x.x)
    const preferredAddresses = ipv4Addresses.filter(addr => 
      !addr.startsWith('169.254.') && // Not link-local
      !addr.startsWith('172.') // Not Docker (this might be too broad, adjust if needed)
    );
    
    return preferredAddresses.length > 0 ? preferredAddresses[0] : ipv4Addresses[0];
  }

  // 🚀 NEW: Setup gRPC event handlers for real-time updates
  private setupGrpcEventHandlers(): void {
    windowsDiscoveryLogger.info('WindowsDiscoveryService: Configurando event handlers para gRPC');
    if (!this.grpcService) {
      windowsDiscoveryLogger.warn('WindowsDiscoveryService: gRPC service é null, não configurando handlers');
      return;
    }
    windowsDiscoveryLogger.info('WindowsDiscoveryService: gRPC service disponível, configurando handlers');
    
    // Handle when gRPC successfully connects to a host
    this.grpcService.on('host-connected', ({ hostId, host }) => {
      windowsDiscoveryLogger.info('Connected to host', { hostId });
      this.handleHostConnected(host);
    });

    // Handle when gRPC disconnects from a host
    this.grpcService.on('host-disconnected', ({ hostId, host, reason }) => {
      windowsDiscoveryLogger.info('Disconnected from host', { hostId, reason });
      this.handleHostDisconnected(hostId);
    });

    // Handle real-time display changes from gRPC stream
    this.grpcService.on('displays-changed', ({ hostId, host, displays, changeType, changedDisplay }) => {
      windowsDiscoveryLogger.info('Host displays changed', { hostId, changeType });
      this.handleHostDisplaysChanged(hostId, displays, changeType);
    });

    // Handle host metrics changes
    this.grpcService.on('host-status-changed', ({ hostId, host, status }) => {
      windowsDiscoveryLogger.info('Host metrics changed', { hostId });
      this.handleHostMetricsChanged(hostId, status);
    });
    
    // Handle heartbeats to update host status
    this.grpcService.on('host-event', (hostEvent) => {
      if (hostEvent.type === 'HEARTBEAT') {
        // 🔍 DEBUG: Log the complete structure to identify correct field names
        const instanceId = (this as any).__instanceId;
        windowsDiscoveryLogger.debug('HEARTBEAT: Recebido evento', {
          eventId: hostEvent.eventId || 'N/A',
          hostId: hostEvent.hostId,
          instanceId,
          payloadComplete: JSON.stringify(hostEvent.payload, null, 2)
        });
        
        // Try both field name variations (snake_case vs camelCase)
        const hostStatus = hostEvent.payload?.hostStatus || hostEvent.payload?.host_status;
        const displayStatuses = hostEvent.payload?.displayStatuses || hostEvent.payload?.display_statuses;
        
        windowsDiscoveryLogger.debug('HEARTBEAT: Campos encontrados', {
          hostStatusFound: !!hostEvent.payload?.hostStatus,
          host_statusFound: !!hostEvent.payload?.host_status,
          displayStatusesFound: !!hostEvent.payload?.displayStatuses,
          display_statusesFound: !!hostEvent.payload?.display_statuses
        });
        
        if (hostStatus) {
          const hostBefore = this.discoveredHosts.get(hostEvent.hostId);
          windowsDiscoveryLogger.debug('HEARTBEAT: Estado ANTES de processar', {
            hostId: hostEvent.hostId,
            isConnectedBefore: hostBefore?.metrics?.online || 'N/A'
          });
          
          windowsDiscoveryLogger.debug('Received heartbeat', {
            hostId: hostEvent.hostId,
            cpu: hostStatus.cpu_usage_percent,
            memory: hostStatus.memory_usage_percent,
            online: hostStatus.online
          });
          this.updateHostMetricsFromHeartbeat(hostEvent.hostId, hostStatus);
          
          const updatedHost = this.discoveredHosts.get(hostEvent.hostId);
          windowsDiscoveryLogger.debug('HEARTBEAT: Estado APÓS processar evento', {
            hostId: hostEvent.hostId,
            isConnectedAfter: updatedHost?.metrics?.online,
            lastHeartbeatUpdated: updatedHost?.lastHeartbeat
          });
        } else {
          windowsDiscoveryLogger.warn('HEARTBEAT: Nenhum hostStatus encontrado no payload', { hostId: hostEvent.hostId });
        }
        
        // Process display states from heartbeat
        if (displayStatuses && displayStatuses.length > 0) {
          windowsDiscoveryLogger.debug('Processing display states from heartbeat', {
            hostId: hostEvent.hostId,
            displayCount: displayStatuses.length
          });
          this.updateHostDisplaysFromHeartbeat(hostEvent.hostId, displayStatuses);
        }
      }
    });
  }

  // ❌ REMOVED: verifyHostReachable method - no longer needed with pure gRPC approach

  // 🚀 NEW: Handle gRPC host connection events
  private handleHostConnected(host: MiniPC): void {
    const existing = this.discoveredHosts.get(host.id);
    if (!existing) {
      windowsDiscoveryLogger.info('gRPC Discovery: New host connected', { hostId: host.id });
      this.discoveredHosts.set(host.id, host);
      
      if (this.onHostDiscoveredCallback) {
        this.onHostDiscoveredCallback(host);
      }
    } else {
      // Update existing host
      this.discoveredHosts.set(host.id, { ...existing, ...host, lastHeartbeat: new Date() });
      windowsDiscoveryLogger.debug('gRPC Discovery: Host connection refreshed', { hostId: host.id });
    }
  }

  private handleHostDisconnected(hostId: string): void {
    if (this.discoveredHosts.has(hostId)) {
      windowsDiscoveryLogger.info('gRPC Discovery: Host disconnected', { hostId });
      this.discoveredHosts.delete(hostId);
      
      if (this.onHostRemovedCallback) {
        this.onHostRemovedCallback(hostId);
      }
    }
  }

  private handleHostDisplaysChanged(hostId: string, grpcDisplays: any[], changeType: string): void {
    const host = this.discoveredHosts.get(hostId);
    if (!host) return;

    // Convert gRPC display format to our format
    const displays = grpcDisplays.map(d => d.display_id || `display-${d.electron_id}`);
    
    const updatedHost = {
      ...host,
      displays,
      lastHeartbeat: new Date()
    };

    windowsDiscoveryLogger.info('gRPC Discovery: Host displays changed', {
      hostId,
      changeType,
      displayCount: displays.length
    });

    this.discoveredHosts.set(hostId, updatedHost);
    
    // Notify as significant change since displays actually changed
    if (this.onHostDiscoveredCallback) {
      this.onHostDiscoveredCallback(updatedHost);
    }
  }

  private updateHostMetricsFromHeartbeat(hostId: string, hostMetrics: any): void {
    const host = this.discoveredHosts.get(hostId);
    if (!host) return;

    // 🔍 DEBUG: Log the raw hostMetrics structure
    windowsDiscoveryLogger.debug('updateHostMetricsFromHeartbeat: Raw hostMetrics', {
      hostId,
      hostMetrics
    });

    // Convert gRPC metrics format to our internal format
    // If we're receiving a heartbeat, the host is online by definition
    const updatedMetrics = {
      online: hostMetrics.online !== false, // ✅ Simple: online unless explicitly false
      cpuUsage: parseFloat(hostMetrics.cpu_usage_percent) || 0,
      memoryUsage: parseFloat(hostMetrics.memory_usage_percent) || 0,
      browserProcesses: parseInt(hostMetrics.browser_processes) || 0,
      lastError: hostMetrics.last_error || undefined
    };

    windowsDiscoveryLogger.debug('updateHostMetricsFromHeartbeat: Final status', {
      hostId,
      originalOnline: hostMetrics.online,
      finalOnline: updatedMetrics.online
    });

    const updatedHost = {
      ...host,
      metrics: updatedMetrics,
      debugEnabled: hostMetrics.debug_enabled || false,
      lastHeartbeat: new Date()
    };

    this.discoveredHosts.set(hostId, updatedHost);
    
    // Notify callback about status update
    if (this.onHostDiscoveredCallback) {
      this.onHostDiscoveredCallback(updatedHost);
    }
  }

  // Update host display states from heartbeat
  private updateHostDisplaysFromHeartbeat(hostId: string, displayStatuses: any[]): void {
    const host = this.discoveredHosts.get(hostId);
    if (!host) return;

    // 🔍 DEBUG: Log raw display statuses structure
    windowsDiscoveryLogger.debug('updateHostDisplaysFromHeartbeat: Raw displayStatuses', {
      hostId,
      displayStatuses
    });

    // Convert gRPC display statuses to our internal format
    const displays = displayStatuses.map((display, index) => {
      // Try both field name variations for display fields
      const displayId = display.display_id || display.displayId || `display-${index + 1}`;
      const isActive = display.active !== undefined ? display.active : (display.isActive || false);
      const assignedDashboard = display.assigned_dashboard || display.assignedDashboard;
      
      return {
        id: displayId,
        isActive: isActive, // Now comes from StateManager - should be true for active displays
        assignedDashboard: assignedDashboard ? {
          dashboardId: assignedDashboard.dashboard_id || assignedDashboard.dashboardId,
          url: assignedDashboard.url
        } : null
      };
    });

    const updatedHost = {
      ...host,
      displays: displays.map(d => d.id), // Keep backward compatibility with string array
      displayStates: displays, // Add detailed display states
      lastHeartbeat: new Date()
    };

    windowsDiscoveryLogger.info('gRPC: Updated host displays', {
      hostId,
      displayCount: displays.length,
      displays: displays.map(d => ({
        id: d.id,
        dashboard: d.assignedDashboard?.dashboardId || 'none'
      }))
    });

    this.discoveredHosts.set(hostId, updatedHost);
    
    // Notify callback about display update
    if (this.onHostDiscoveredCallback) {
      this.onHostDiscoveredCallback(updatedHost);
    }
  }

  private handleHostMetricsChanged(hostId: string, status: any): void {
    const host = this.discoveredHosts.get(hostId);
    if (!host) return;

    const updatedHost = {
      ...host,
      metrics: {
        ...host.metrics,
        ...status
      },
      debugEnabled: status.debug_enabled !== undefined ? status.debug_enabled : host.debugEnabled,
      lastHeartbeat: new Date()
    };

    this.discoveredHosts.set(hostId, updatedHost);
    windowsDiscoveryLogger.debug(`gRPC Discovery: Host ${hostId} metrics updated`);
  }

  // ❌ REMOVED: All HTTP polling methods replaced with gRPC streaming
  // - checkHost: replaced with verifyHostReachable + gRPC connection
  // - handleHostFound: replaced with handleHostConnected
  // - handleHostLost: replaced with handleHostDisconnected

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

  // 🚀 NEW: Add manual host for testing (updated for gRPC)
  public async addManualHost(host: Partial<MiniPC>): Promise<void> {
    const fullHost: MiniPC = {
      id: host.id || `manual-${Date.now()}`,
      name: host.name || 'Manual Host',
      hostname: host.hostname || 'localhost',
      ipAddress: host.ipAddress || '127.0.0.1',
      port: host.port || 8082, // gRPC port
      metrics: host.metrics || {
        online: true,
        cpuUsage: 0,
        memoryUsage: 0,
        browserProcesses: 0
      },
      debugEnabled: host.debugEnabled || false,
      lastHeartbeat: new Date(),
      lastDiscovered: new Date(),
      version: host.version || '1.0.0',
      displays: host.displays || [] // Will be populated by gRPC events
    };

    // Add to discovered hosts and connect gRPC
    this.discoveredHosts.set(fullHost.id, fullHost);
    
    // Try to connect gRPC stream if available
    if (this.grpcService) {
      try {
        await this.grpcService.connectToHost(fullHost);
      } catch (error) {
        windowsDiscoveryLogger.warn('Manual host added but gRPC connection failed', { hostId: fullHost.id, error });
      }
    } else {
      windowsDiscoveryLogger.info('Manual host added (gRPC not available)', { hostId: fullHost.id });
    }

    if (this.onHostDiscoveredCallback) {
      this.onHostDiscoveredCallback(fullHost);
    }
  }

  // ❌ REMOVED: getHostDisplays - displays now come via gRPC events
  // ❌ REMOVED: setIPRanges - no more fixed IPs, purely mDNS
  // ❌ REMOVED: hasSignificantChanges - handled by gRPC event handlers

  // 🚀 NEW: Get gRPC service for command execution
  public getGrpcService(): GrpcClientService | null {
    return this.grpcService;
  }
}
