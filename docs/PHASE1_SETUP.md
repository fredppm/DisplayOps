# Phase 1 Setup Guide - Foundation & Communication

This guide covers the setup and testing of Phase 1 functionality: basic communication between web controller and host agents.

## What's Included in Phase 1

✅ **Completed Features:**
- Express server integrated in Electron host agent
- mDNS service advertising in host agents
- mDNS discovery service in web controller  
- REST API endpoints for command handling
- Simple command dispatch system
- NextJS web interface with Tailwind CSS
- Basic UI for discovered hosts management
- Real-time host status monitoring
- Dashboard assignment interface
- Communication testing tools

🚧 **Not Yet Implemented (Future Phases):**
- Basic authentication/authorization
- Cookie synchronization
- Browser automation
- Auto-update system

## Prerequisites

### Software Requirements
- **Node.js 18+** on all machines
- **Windows 10/11** on mini PCs (for host agents)
- **Any OS** for web controller
- **Network connectivity** between all devices

### Network Requirements
- **mDNS/Bonjour support** enabled
- **UDP port 5353** open for mDNS discovery
- **TCP port 8080** open for host agent APIs
- **TCP port 3000** open for web controller
- **Firewall configured** to allow these ports

## Installation Steps

### 1. Clone and Setup

```bash
# Clone the repository
git clone <repository-url>
cd office_tv

# Quick development setup (recommended)
cd scripts
npm install

# Windows
start-dev.bat

# Linux/Mac  
chmod +x start-dev.sh
./start-dev.sh
```

### 2. Manual Setup (Alternative)

If you prefer to start services manually:

```bash
# Terminal 1: Web Controller
cd web-controller
npm install
npm run dev

# Terminal 2: Host Agent  
cd host-agent
npm install
npm run dev
```

### 3. Verify Setup

1. **Web Controller**: Open http://localhost:3000
2. **Host Agent API**: Check http://localhost:8080/health
3. **Auto-Discovery**: Host should appear in web interface within 10 seconds

## Testing Phase 1 Communication

### Automated Testing

```bash
cd scripts
npm run test-communication
```

This script will:
- Scan for mDNS services
- Test API connectivity
- Verify command dispatch
- Report any issues

### Manual Testing

1. **Open Web Controller**: http://localhost:3000
2. **Check Host Discovery**: 
   - Should see host agent appear in "Host Agents" tab
   - Status should show "Online"
   - System metrics should be displayed

3. **Test Dashboard Assignment**:
   - Go to "Dashboards" tab
   - Select a dashboard from the list
   - Assign it to a TV display
   - Check host agent logs for command reception

4. **Monitor System Status**:
   - Go to "System Status" tab
   - Verify real-time metrics
   - Check TV display statuses

## Configuration

### Host Agent Configuration

The host agent creates a configuration file at:
- **Windows**: `%APPDATA%/office-tv-host-agent/agent-config.json`
- **Linux**: `~/.config/office-tv-host-agent/agent-config.json`

Default configuration:
```json
{
  "agentId": "agent-{hostname}",
  "hostname": "{auto-detected}",
  "apiPort": 8080,
  "version": "1.0.0",
  "displays": [
    {
      "id": "display-1",
      "name": "Primary Display", 
      "monitorIndex": 0
    },
    {
      "id": "display-2",
      "name": "Secondary Display",
      "monitorIndex": 1
    }
  ]
}
```

### Web Controller Configuration

Environment variables (create `.env.local`):
```bash
NODE_ENV=development
PORT=3000
NEXT_PUBLIC_API_URL=http://localhost:3000
MDNS_DISCOVERY_TIMEOUT=10000
```

## Troubleshooting

### Host Not Discovered

**Symptoms**: Host agent running but not appearing in web controller

**Solutions**:
1. Check if mDNS is enabled:
   ```bash
   # Windows
   nslookup -type=PTR _services._dns-sd._udp.local
   
   # Linux
   avahi-browse -rt _officetv._tcp
   ```

2. Verify firewall settings:
   - Allow UDP port 5353 (mDNS)
   - Allow TCP port 8080 (host agent)
   - Allow Node.js applications

3. Check network connectivity:
   ```bash
   # Test direct API access
   curl http://{host-ip}:8080/health
   ```

### API Communication Fails

**Symptoms**: Host discovered but commands fail

**Solutions**:
1. Check host agent logs for errors
2. Verify API endpoints:
   ```bash
   curl http://localhost:8080/api/status
   ```
3. Test with simple health check command
4. Check CORS headers in responses

### Development Issues

**Port Conflicts**:
- Web controller: Change PORT in `.env.local`
- Host agent: Change API_PORT in configuration

**Node.js Version**:
- Ensure Node.js 18+ is installed
- Use `node --version` to verify

**Dependencies**:
- Clear node_modules and reinstall if needed
- Use `npm ci` for clean installation

## Phase 1 Limitations

### Current Limitations
- **No Authentication**: All API endpoints are open
- **No Persistence**: Configuration resets on restart
- **Basic Error Handling**: Limited error recovery
- **Manual Fallback**: No automatic host addition
- **Development Only**: Not production-ready

### Workarounds
- **Manual Host Addition**: Add hosts manually in discovery API
- **Static Configuration**: Edit config files directly
- **Network Debugging**: Use test scripts for diagnosis

## Next Steps

After Phase 1 is working:

1. **Phase 2**: Browser automation with Electron windows
2. **Phase 3**: Authentication and cookie synchronization  
3. **Phase 4**: Monitoring and health checks
4. **Phase 5**: Auto-update system
5. **Phase 6**: Advanced features

## Support

### Log Locations
- **Host Agent**: Console output in development
- **Web Controller**: Browser console + Next.js logs
- **Discovery**: Check browser network tab

### Debug Mode
```bash
# Enable verbose logging
DEBUG=officetv:* npm run dev
```

### Getting Help
1. Check this documentation
2. Review error logs
3. Test with provided scripts
4. Verify network configuration
5. Check firewall settings
