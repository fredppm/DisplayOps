// Simple in-memory cache for host mappings
let hostCache: Map<string, { ipAddress: string; port: number }> = new Map();

export function parseHostId(hostId: string): { ipAddress: string; port: number } | null {
  // Check if this is the new agentId format (no IP in the ID)
  const isNewFormat = !hostId.match(/agent-\d+-\d+-\d+-\d+-\d+/);
  
  if (isNewFormat) {
    // New agentId format - must use discovery service
    
    // Try cache first
    if (hostCache.has(hostId)) {
      const cached = hostCache.get(hostId)!;
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
          // Cache for future use
          hostCache.set(hostId, hostInfo);
          return hostInfo;
        }
      }
    } catch (error: any) {
      console.debug('Could not get host from discovery service:', error?.message || 'unknown error');
    }
    
    // For new format, if not found in discovery service, return null
    return null;
  }
  
  // Legacy IP-based format: agent-127-0-0-1-8080
  const parts = hostId.split('-');
  
  if (parts.length < 6 || parts[0] !== 'agent') {
    return null;
  }
  
  // Extract IP and port from the end
  const port = parseInt(parts[parts.length - 1]);
  const ipParts = parts.slice(-5, -1); // Get the 4 IP parts before the port
  
  if (ipParts.length !== 4 || isNaN(port)) {
    return null;
  }
  
  const ipAddress = ipParts.join('.');
  
  // Basic IP validation
  if (!/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ipAddress)) {
    return null;
  }
  
  return { ipAddress, port };
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