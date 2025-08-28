# Office TV Management System

A comprehensive solution for managing multiple TV displays in office environments. This system allows centralized control of dashboards across multiple mini PCs, with automatic authentication handling and real-time monitoring.

## Problem Statement

Managing multiple TVs in an office setting presents several challenges:
- TVs automatically turn off, losing displayed content
- Authentication sessions expire, requiring manual login on each device
- Time-consuming process to configure each TV individually via TeamViewer
- No centralized way to monitor or manage all displays

## Solution

This system provides:
- **Automatic Discovery**: Host agents discovered automatically via mDNS
- **Centralized Web Controller**: Manage all TVs from a single interface
- **Automated Window Control**: Open dashboards in kiosk mode using Electron
- **Cookie Synchronization**: Share authentication across all devices
- **Real-time Monitoring**: Track status and health of all displays
- **Auto-update System**: Keep all agents updated automatically

## Architecture

### Components
- **Web Controller** (NextJS): Central management interface
- **Host Agent** (Electron): Desktop application running on each mini PC
- **Communication Layer**: REST API for command distribution

### Network Topology
```
[Web Controller] --REST API--> [Mini PC 1] --> [TV 1, TV 2]
                            --> [Mini PC 2] --> [TV 3, TV 4]
                            --> [Mini PC 3] --> [TV 5, TV 6]
                            --> [Mini PC 4] --> [TV 7, TV 8]
```

## Prerequisites

### Hardware
- Mini PCs with dual HDMI outputs (Dell or equivalent)
- TVs connected via HDMI
- Network connectivity between all devices

### Software
- Windows 10/11 on mini PCs
- Node.js 18+ on all devices
- Electron runtime (included in application)

### Network Requirements
- Local network with multicast support
- UDP port 5353 for mDNS discovery
- Firewall configured to allow mDNS traffic

## Installation

### Quick Start (Development)

Use the provided scripts to start both services quickly:

**Windows:**
```bash
cd scripts
start-dev.bat
```

**Linux/Mac:**
```bash
cd scripts
chmod +x start-dev.sh
./start-dev.sh
```

### Manual Setup

#### 1. Web Controller Setup

```bash
cd web-controller
npm install
npm run dev          # Development
# OR
npm run build        # Production
npm start            # Production
```

The web interface will be available at `http://localhost:3000`

#### 2. Host Agent Setup (on each mini PC)

```bash
cd host-agent
npm install
npm run dev          # Development with hot reload
# OR
npm run build        # Production
npm run start        # Production
```

Host agent API will be available at `http://localhost:8080`

#### 3. Test Communication (Phase 1)

```bash
cd scripts
npm install
npm run test-communication
```

This will test mDNS discovery and basic API communication between components.

## Usage

### Dashboard Management
1. Access the web controller interface
2. Add your dashboards with URLs and settings
3. Assign dashboards to specific TVs
4. Deploy configuration to all mini PCs

### Cookie Synchronization
1. Login to your dashboards on your local machine
2. Use the "Sync Cookies" feature in the web controller
3. Cookies will be automatically copied to all mini PCs

### Monitoring
- Real-time status of all TVs and mini PCs
- Health checks and error reporting
- Screenshot capture for verification
- Automatic recovery from failures

## Development

### Project Structure
```
office_tv/
├── web-controller/     # NextJS web interface
├── host-agent/        # Electron desktop app for mini PCs
├── shared/           # Shared types and utilities
├── docs/             # Documentation
└── scripts/          # Deployment scripts
```

### Development Guidelines
- All code and documentation in English
- TypeScript for type safety
- Follow ESLint and Prettier configurations
- See `.cursor/rules.md` files for specific guidelines

### Adding New Features
1. Update shared types if needed
2. Implement in appropriate module
3. Update API documentation
4. Add tests for new functionality

## Configuration

### Environment Variables

#### Web Controller
```
NODE_ENV=production
PORT=3000
CONFIG_PATH=./data/config.json
```

#### Host Agent
```
NODE_ENV=production
PORT=8080
CONTROLLER_URL=http://controller-ip:3000
AGENT_ID=minipc-01
```

### Configuration Files
- `web-controller/data/config.json`: System configuration
- `host-agent/config/agent.json`: Agent-specific settings

## Troubleshooting

### Common Issues

**Agents not discovered automatically**
- Check if UDP port 5353 is open in firewall
- Verify multicast is enabled on network
- Test mDNS with `dns-sd -B _officetv._tcp` command
- Check if agents are advertising service correctly

**Agent not responding**
- Check network connectivity
- Verify agent is running with PM2
- Check logs in `host-agent/logs/`
- Ensure mDNS service is advertised

**Window management fails**
- Check Electron application is running properly
- Verify display configuration and drivers
- Test monitor setup with Windows display settings
- Check Electron window positioning logs

**Authentication issues**
- Re-sync cookies from web controller
- Check cookie domain settings
- Verify dashboard URLs are correct

### Logs
- Web Controller: Browser console and Next.js logs
- Host Agent: `logs/agent.log` and PM2 logs

## Roadmap

### Phase 1 (Current)
- [x] Basic architecture and communication
- [ ] Browser automation with Puppeteer
- [ ] Cookie synchronization
- [ ] Web interface for configuration

### Phase 2
- [ ] Real-time monitoring and alerts
- [ ] Auto-update system
- [ ] Advanced scheduling features
- [ ] Mobile app for quick control

### Phase 3
- [ ] AWS integration
- [ ] Advanced analytics
- [ ] Multi-location support
- [ ] Integration with office automation

## Contributing

1. Follow the development guidelines in `.cursor/rules.md`
2. Create feature branches for new functionality
3. Include tests for new features
4. Update documentation as needed

## License

Internal project - All rights reserved
