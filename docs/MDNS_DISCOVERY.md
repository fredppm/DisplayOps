# mDNS Service Discovery - Implementation Guide

## Overview

The ScreenFleet Management System uses mDNS (Multicast DNS) for automatic discovery of host agents across the local network. This eliminates the need for manual IP configuration and enables dynamic network topologies.

## Service Specification

### Service Type
- **Service Name**: `_screenfleet._tcp.local`
- **Protocol**: TCP
- **Domain**: `.local` (mDNS standard)

### Service Instance Naming
- **Pattern**: `{hostname}-{agent-id}._screenfleet._tcp.local`
- **Example**: `OFFICE-PC-01-agent-001._screenfleet._tcp.local`

### TXT Record Metadata
Each service advertises metadata via TXT records:

```
version=1.0.0
agentId=mini-pc-01
hostname=OFFICE-PC-01
displayCount=2
displays=display-1,display-2
platform=win32
uptime=3600
```

## Implementation Details

### Host Agent (Service Publisher)

#### Dependencies
- `bonjour` or `mdns` package for Node.js/Electron
- Service runs in Electron main process

#### Service Advertisement
```typescript
import bonjour from 'bonjour';

const service = bonjour();

// Advertise service on startup
const advertisement = service.publish({
  name: `${hostname}-${agentId}`,
  type: 'screenfleet',
  port: 8080,
  txt: {
    version: '1.0.0',
    agentId: 'mini-pc-01',
    hostname: os.hostname(),
    displayCount: '2',
    displays: 'display-1,display-2',
    platform: os.platform(),
    uptime: process.uptime().toString()
  }
});

// Handle shutdown
process.on('SIGTERM', () => {
  advertisement.stop();
  service.destroy();
});
```

#### Service Lifecycle
1. **Startup**: Advertise service immediately after Electron app ready
2. **Updates**: Re-advertise with updated TXT records on status changes
3. **Heartbeat**: Update TXT record with current uptime every 30 seconds
4. **Shutdown**: Properly unpublish service on app exit

### Web Controller (Service Browser)

#### Dependencies
- `bonjour` package for service discovery
- Service browser runs in NextJS backend/API routes

#### Service Discovery
```typescript
import bonjour from 'bonjour';

const browser = bonjour();

// Start browsing for services
const serviceBrowser = browser.find({ type: 'screenfleet' });

serviceBrowser.on('up', (service) => {
  console.log('Found service:', service);
  registerHostAgent(service);
});

serviceBrowser.on('down', (service) => {
  console.log('Service went down:', service);
  unregisterHostAgent(service);
});

// Clean shutdown
process.on('SIGTERM', () => {
  serviceBrowser.stop();
  browser.destroy();
});
```

#### Service Processing
1. **Discovery**: Automatically detect new services
2. **Registration**: Add discovered hosts to active agents list
3. **Monitoring**: Track service availability and status
4. **Cleanup**: Remove offline services after timeout

## Network Requirements

### mDNS Protocol
- **Port**: UDP 5353
- **Multicast**: 224.0.0.251 (IPv4), FF02::FB (IPv6)
- **TTL**: Typically 255 (local network only)

### Firewall Configuration
Windows Defender Firewall rules needed:
- **Inbound**: Allow UDP 5353 for mDNS
- **Outbound**: Allow UDP 5353 for mDNS
- **Application**: Allow Node.js/Electron applications

### Network Topology Support
- **Same Subnet**: Works natively
- **VLANs**: Requires mDNS repeater/reflector
- **Corporate Networks**: May need IT configuration
- **Wi-Fi**: Works if multicast is enabled

## Error Handling

### Common Issues

#### Service Not Discovered
- **Cause**: Firewall blocking UDP 5353
- **Solution**: Configure firewall rules
- **Fallback**: Manual IP configuration option

#### Service Discovery Timeout
- **Cause**: Network congestion or segmentation
- **Solution**: Increase discovery timeout
- **Fallback**: Cached service list

#### Multiple Network Interfaces
- **Cause**: VPN or multiple NICs
- **Solution**: Bind to specific interface
- **Configuration**: Allow interface selection

### Retry Logic
- **Service Advertisement**: Retry every 10 seconds on failure
- **Service Discovery**: Continuous browsing with exponential backoff
- **Network Changes**: Re-advertise on IP address changes

## Testing Strategy

### Unit Tests
- Service advertisement and unpublishing
- TXT record formatting and parsing
- Error handling for network failures

### Integration Tests
- Discovery across multiple devices
- Service updates and notifications
- Network interface changes

### Network Tests
- Different network topologies
- Firewall configurations
- Corporate network policies

## Monitoring and Debugging

### Logging
- Service advertisement events
- Discovery events with timestamps
- Network interface changes
- Error conditions and retries

### Debug Tools
- `dns-sd` command line tool (macOS/Linux)
- Wireshark for packet analysis
- Network scanner tools

### Health Checks
- Verify service is advertised
- Monitor discovery response times
- Track service availability metrics

## Security Considerations

### Information Disclosure
- TXT records are publicly visible on network
- Avoid sensitive information in metadata
- Use generic service descriptions

### Network Scanning
- mDNS services are discoverable by any device
- Implement proper authentication on API endpoints
- Consider network segmentation for sensitive environments

### Denial of Service
- Rate limit service advertisements
- Implement proper resource cleanup
- Monitor for excessive discovery requests

## Future Enhancements

### Service Versioning
- Support multiple service versions
- Graceful degradation for compatibility
- Automatic migration between versions

### Advanced Discovery
- Service priority and load balancing
- Geographic or zone-based discovery
- Service dependency resolution

### Enterprise Features
- Integration with corporate DNS
- Active Directory service publishing
- Centralized service registry
