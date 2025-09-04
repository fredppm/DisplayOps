import { createContextLogger } from '@/utils/logger';

const hostUtilsLogger = createContextLogger('host-utils');

// Simple in-memory cache for host mappings
let hostCache: Map<string, { ipAddress: string; port: number }> = new Map();

export function parseHostId(hostId: string): { ipAddress: string; port: number } | null {
  hostUtilsLogger.debug('Parsing hostId', { hostId });
  
  // First try the gRPC-compatible format: agent-*-*-*-*-PORT format
  const parts = hostId.split('-');
  hostUtilsLogger.debug('Split hostId parts', { parts });
  
  // Look for agent at the beginning, then IP parts at the end
  const agentIndex = parts.indexOf('agent');
  if (agentIndex !== -1 && parts.length >= agentIndex + 6) {
    // Format could be: VTEX-B9LH6Z3-agent-192-168-1-100-8080
    // We need the last 5 parts after 'agent': IP (4 parts) + PORT (1 part)
    const relevantParts = parts.slice(agentIndex + 1);
    hostUtilsLogger.debug('Relevant parts after agent', { relevantParts });
    
    if (relevantParts.length >= 5) {
      const port = parseInt(relevantParts[relevantParts.length - 1]);
      const ipParts = relevantParts.slice(-5, -1); // Last 5 parts minus the port = 4 IP parts
      
      hostUtilsLogger.debug('Parsed port and IP parts', { port, ipParts });
      
      if (ipParts.length === 4 && !isNaN(port)) {
        const ipAddress = ipParts.join('.');
        hostUtilsLogger.debug('Constructed IP address', { ipAddress });
        
        // Basic IP validation
        if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ipAddress)) {
          hostUtilsLogger.debug('Successfully parsed hostId', { ipAddress, port });
          return { ipAddress, port };
        }
      }
    }
  }
  
  // If not gRPC format, try discovery service for new format hostIds
  hostUtilsLogger.debug('Not gRPC format, trying discovery service', { hostId });
  
  // Try cache first
  if (hostCache.has(hostId)) {
    const cached = hostCache.get(hostId)!;
    hostUtilsLogger.debug('Found in cache', { hostId, cached });
    return cached;
  }
  
  // Try discovery service
  try {
    if (typeof window === 'undefined') {
      const { getDiscoveryService } = require('./discovery-singleton');
      const discoveryService = getDiscoveryService();
      const hosts = discoveryService.getDiscoveredHosts();
      
      const host = hosts.find((h: any) => h.id === hostId);
      
      if (host) {
        const hostInfo = {
          ipAddress: host.ipAddress,
          port: host.port
        };
        hostUtilsLogger.debug('Found in discovery service', { hostId, hostInfo });
        // Cache for future use
        hostCache.set(hostId, hostInfo);
        return hostInfo;
      }
    }
  } catch (error: any) {
    hostUtilsLogger.debug('Could not get host from discovery service', { error: error?.message || 'unknown error' });
  }
  
  hostUtilsLogger.warn('Could not parse hostId', { hostId });
  return null;
}

export async function proxyToHost(
  hostId: string, 
  endpoint: string, 
  options: RequestInit = {}
): Promise<Response> {
  const hostInfo = parseHostId(hostId);
  
  if (!hostInfo) {
    throw new Error('Invalid host ID format');
  }

  const url = `http://${hostInfo.ipAddress}:${hostInfo.port}${endpoint}`;
  
  return fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    signal: options.signal || AbortSignal.timeout(10000) // 10 second timeout
  });
}

// Utility function to populate cache with discovered hosts
export function updateHostCache(hostId: string, ipAddress: string, port: number): void {
  hostCache.set(hostId, { ipAddress, port });
}

// Utility function to clear cache
export function clearHostCache(): void {
  hostCache.clear();
}