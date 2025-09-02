# ScreenFleet Management System

A comprehensive solution for managing multiple displays in office environments. This system allows centralized control of dashboards across multiple mini PCs, with automatic authentication handling and real-time monitoring.

## Problem Statement

Managing multiple displays in an office setting presents several challenges:
- Displays automatically turn off, losing displayed content
- Authentication sessions expire, requiring manual login on each device
- Time-consuming process to configure each display individually via TeamViewer
- No centralized way to monitor or manage all displays

## Solution

This system provides:
- **Automatic Discovery**: Host agents discovered automatically via mDNS
- **Centralized Web Controller**: Manage all displays from a single interface
- **Automated Window Control**: Open dashboards in kiosk mode using Electron
- **Cookie Synchronization**: Share authentication across all devices
- **Real-time Monitoring**: Track status and health of all displays
- **Auto-update System**: Keep all agents updated automatically
- **Single Instance Protection**: Prevents multiple instances from running simultaneously

## Key Features

### 🔒 Single Instance Protection
- **Prevents Duplicate Instances**: Only one host agent can run per mini PC
- **Port Conflict Prevention**: Automatically checks port availability before starting
- **Automatic Cleanup**: Removes stale lock files from crashed processes
- **Production Ready**: Ideal for production environments where service uniqueness is critical

### 🖥️ Display Management
- **Multi-Monitor Support**: Handles multiple displays per mini PC
- **Kiosk Mode**: Full-screen dashboard display
- **Automatic Recovery**: Restores displays after power loss or system restart

### 🌐 Network Discovery
- **mDNS Auto-Discovery**: Automatically finds all host agents on the network
- **Real-time Status**: Monitor health and status of all displays
- **Centralized Control**: Manage all displays from a single web interface

## Architecture

### Components
- **Web Controller** (NextJS): Central management interface
- **Host Agent** (Electron): Desktop application running on each mini PC
- **Communication Layer**: REST API for command distribution

### Network Topology
```
[Web Controller] --REST API--> [Mini PC 1] --> [Display 1, Display 2]
                            --> [Mini PC 2] --> [Display 3, Display 4]
                            --> [Mini PC 3] --> [Display 5, Display 6]
                            --> [Mini PC 4] --> [Display 7, Display 8]
```

## Prerequisites

### Hardware
- Mini PCs with dual HDMI outputs (Dell or equivalent)
- Displays connected via HDMI
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

From the root directory:

```bash
# Install all dependencies
npm install

# Start both services in development mode
npm run dev
```

This will automatically:
- Install dependencies for both web-controller and host-agent
- Start both services concurrently with colored output
- Web Controller: http://localhost:3000
- Host Agent API: http://localhost:8080

### Testing Single Instance Protection

Test the single instance functionality:

```bash
# Windows
scripts\test-single-instance.bat

# Linux/macOS
node scripts/test-single-instance.js
```

This will demonstrate:
- First instance starts successfully
- Second instance is blocked
- Resources are properly cleaned up

### Available Commands

From the root directory:
- `npm run dev` - Start both services in development mode
- `npm run dev:web` - Start only web-controller
- `npm run dev:host` - Start only host-agent
- `npm run build` - Build both services for production
- `npm run start` - Start both services in production mode
- `npm run lint` - Run linting on both services

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
1. Access the web controller interface at http://localhost:3000
2. Go to "Dashboard Management" tab
3. Click ✏️ to edit existing dashboards or "Add Dashboard" for new ones
4. Configure dashboard URL, refresh interval, and authentication settings
5. Assign dashboards to specific displays and deploy

### Cookie Synchronization
1. Login to your dashboards on your local machine using a browser
2. Press F12 and go to Application → Cookies → select your domain
3. Copy cookies (Ctrl+A → Ctrl+C)
4. In the web controller, go to "🍪 Cookies" tab
5. Paste cookies and click "Validate" then "Sync to All TVs"

### Monitoring and Debugging
- Real-time status of all displays and mini PCs through web interface
- Health checks and error reporting with visual notifications
- Debug overlay system: Press `Ctrl+Shift+D` on any mini PC to toggle debug mode
- Display identification: Use API `/api/displays/identify` to show numbers on each screen
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

**Development Mode Features:**
- When `NODE_ENV` is not set to `production`, developer tools are enabled in browser windows
- Press `F12` in any dashboard window to toggle dev tools
- Press `Ctrl+Shift+D` to open debug overlay for real-time monitoring
- Dev tools are automatically disabled in production for security and performance

### Configuration Files
- `web-controller/data/config.json`: System configuration
- `host-agent/config/agent.json`: Agent-specific settings

## Troubleshooting

### Common Issues

**Agents not discovered automatically**
- Check if UDP port 5353 is open in firewall
- Verify multicast is enabled on network
- Test mDNS with `dns-sd -B _screenfleet._tcp` command
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
