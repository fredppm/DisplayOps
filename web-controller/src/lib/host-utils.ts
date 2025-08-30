export function parseHostId(hostId: string): { ipAddress: string; port: number } | null {
  // Expected format: agent-127-0-0-1-8080 or similar
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