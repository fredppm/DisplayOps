# DisplayOps Management System

A comprehensive solution for managing multiple displays in office environments. This system allows centralized control of dashboards across multiple mini PCs, with automatic authentication handling and real-time monitoring.

## Problem Statement

Managing multiple displays in an office setting presents several challenges:
- Displays automatically turn off, losing displayed content
- Authentication sessions expire, requiring manual login on each device
- Time-consuming process to configure each display individually via TeamViewer
- No centralized way to monitor or manage all displays

## Solution

This system provides:
- **HTTP Registration**: Host agents register with web admin via HTTP heartbeats
- **Centralized Web Admin**: Manage all displays from a single interface
- **gRPC Communication**: Fast, efficient command execution via gRPC
- **Automated Window Control**: Open dashboards in kiosk mode using Electron
- **Cookie Synchronization**: Share authentication across all devices
- **Real-time Monitoring**: SSE-based updates for live status tracking
- **System Tray Integration**: Easy access to host agent controls
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
- **Kiosk Mode**: Full-screen dashboard display with Chromium
- **Automatic Recovery**: Restores displays after power loss or system restart
- **Display Identification**: Visual overlay showing display numbers (Ctrl+Shift+D)
- **Per-Display Controls**: Open, refresh, restart, remove dashboards individually
- **Screenshot Capture**: Take screenshots of any display remotely

### 🌐 Real-time Communication
- **gRPC Commands**: Fast, reliable command execution
- **HTTP Heartbeats**: 30-second interval status updates
- **SSE Updates**: Server-Sent Events for live UI updates
- **Status Polling**: Hybrid approach for offline detection
- **Smart Status Detection**: Automatically detects disconnected hosts

### 🍪 Cookie Management
- **Visual Cookie Editor**: Easy-to-use interface for cookie management
- **Domain-based Sync**: Share authentication across all devices
- **Secure Storage**: Cookies stored per domain
- **Bulk Operations**: Sync cookies to multiple hosts simultaneously

### 📊 Monitoring & Debugging
- **Real-time Metrics**: CPU, memory, uptime tracking
- **Live Logs**: View host logs via gRPC in terminal-style UI
- **Debug Overlay**: System metrics and display info on screen
- **Health Checks**: Automated health monitoring
- **Color-coded Status**: Visual indicators for host/display states

## Architecture

### Components
- **Web Admin** (Next.js): Centralized web interface for management
  - Dashboard management UI
  - Host monitoring and control
  - Cookie editor and sync
  - PostgreSQL database for persistence
  - SSE for real-time updates
  
- **Host Agent** (Electron): Desktop application running on each mini PC
  - System tray integration
  - gRPC server for commands (port 8082)
  - Window management (Chromium-based)
  - HTTP client for heartbeats
  - Auto-updater
  - Debug overlay

### Communication Flow
```
[Web Admin]
    │
    ├─→ HTTP POST /api/hosts/heartbeat ←─── [Host Agent] (every 30s)
    │   (status, metrics, displays)
    │
    ├─→ gRPC :8082 ──────────────────────→ [Host Agent]
    │   (commands: open, refresh, restart, screenshot, logs, etc.)
    │
    └─→ SSE /api/hosts/events ────────────→ [Browser]
        (real-time updates)

[Host Agent] → [Display 1, Display 2] (Chromium windows)
```

### Network Topology
```
[Web Admin:3000] ──gRPC/HTTP──> [Mini PC 1:8082] ──> [Display 1, Display 2]
                                 [Mini PC 2:8082] ──> [Display 3, Display 4]
                                 [Mini PC 3:8082] ──> [Display 5, Display 6]
                                 [Mini PC 4:8082] ──> [Display 7, Display 8]
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
- Local network connectivity between Web Admin and host agents
- Port 8082 (gRPC) open on each mini PC
- Port 3000 (Web Admin) accessible from your browser
- Firewall configured to allow HTTP/gRPC traffic

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
- Install dependencies for both web-admin and host-agent
- Start both services concurrently with colored output
- Web Admin: http://localhost:3000
- Host Agent gRPC: localhost:8082

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
- `npm run dev:web` - Start only web-admin
- `npm run dev:host` - Start only host-agent
- `npm run build` - Build both services for production
- `npm run start` - Start both services in production mode

### Manual Setup

#### 1. Web Admin Setup

```bash
cd web-admin
npm install

# Set environment variables
cp .env.example .env.local
# Edit .env.local with your database URL and web admin URL

npm run dev          # Development
# OR
npm run build        # Production
npm start            # Production
```

The web interface will be available at `http://localhost:3000`

**Environment Variables:**
```env
DATABASE_URL=postgresql://user:password@localhost:5432/displayops
WEB_ADMIN_URL=http://localhost:3000
```

#### 2. Host Agent Setup (on each mini PC)

```bash
cd host-agent
npm install
npm run dev          # Development with hot reload
# OR
npm run build        # Build for production
npm run package      # Create installer (DisplayOps Host Agent Setup.exe)
```

**Initial Configuration:**
- On first run, agent will prompt for Web Admin URL
- Agent ID is auto-generated based on hostname
- gRPC server starts on port 8082
- System tray icon appears for easy access

#### 3. Database Setup (PostgreSQL)

```bash
cd web-admin

# Install PostgreSQL (if not already installed)
# Create database
createdb displayops

# Run migrations
npm run migrate
```

## Usage

### Dashboard Management
1. Access the web admin interface at http://localhost:3000
2. Navigate to "Dashboards" page
3. Click "Add Dashboard" to create a new dashboard
4. Configure:
   - Dashboard name and URL
   - Refresh interval
   - Category (optional)
5. Save dashboard

### Deploying to Displays
1. Go to "Hosts" page to see all connected mini PCs
2. Click on a host to view details
3. For each display:
   - Click "Open Dashboard" to assign a dashboard
   - Select dashboard from the list
   - Use "Refresh", "Restart", or "Remove" as needed
4. Take screenshots to verify display content

### Cookie Synchronization
1. Navigate to "Cookies" page in web admin
2. Select a domain or create a new one
3. Click "Edit Cookies" to open the cookie editor
4. Add/edit cookies in JSON format or use the visual editor
5. Click "Sync to Hosts" to push cookies to all agents
6. Verify sync status in the hosts list

### Host Monitoring
- **Real-time Updates**: Status, metrics, and displays update automatically via SSE
- **Color-coded Status**: 
  - 🟢 Green = Online
  - 🔴 Red (pulsing) = Offline
  - 🟡 Orange = Stale data (>2 minutes)
- **Metrics Cards**: CPU, Memory, Status, Display count
- **Per-Display Actions**: Open, Refresh, Restart, Remove, Screenshot
- **Live Logs**: Click "Load Logs" to view host logs in real-time

### Debugging Tools
- **Debug Overlay** (Ctrl+Shift+D on mini PC): Shows system metrics and display info on screen
- **Display Identification**: Click "Identify Displays" to show numbers on all screens
- **Screenshot Capture**: Take screenshots of any display remotely
- **Log Viewer**: View last 100 log entries with level filtering
- **Health Checks**: Automated system health monitoring

## Development

### Project Structure
```
office_tv/
├── web-admin/         # Next.js web interface
│   ├── src/
│   │   ├── pages/     # Next.js pages and API routes
│   │   ├── components/# React components
│   │   ├── lib/       # gRPC client, repositories
│   │   ├── contexts/  # React contexts (Toast, etc.)
│   │   └── types/     # TypeScript types
│   ├── database/      # PostgreSQL schema
│   └── migrations/    # Database migrations
│
├── host-agent/        # Electron desktop app for mini PCs
│   ├── src/
│   │   ├── main.ts    # Electron main process
│   │   ├── managers/  # Window, config, tray managers
│   │   ├── services/  # gRPC, registry, state services
│   │   ├── preload/   # Preload scripts
│   │   └── renderer/  # Debug overlay, cookie editor
│   └── release/       # Built installers
│
├── shared/            # Shared protobuf definitions
│   └── proto/         # gRPC protocol definitions
│
├── docs/              # Documentation
└── scripts/           # Utility scripts
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

#### Web Admin
```env
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://user:password@localhost:5432/displayops
WEB_ADMIN_URL=http://your-admin-url:3000
```

#### Host Agent
```env
NODE_ENV=production
WEB_ADMIN_URL=http://admin-ip:3000
LOG_LEVEL=INFO  # DEBUG, INFO, WARN, ERROR
```

**Development Mode Features:**
- When `NODE_ENV` is not set to `production`, developer tools are enabled in browser windows
- Press `F12` in any dashboard window to toggle dev tools
- Press `Ctrl+Shift+D` to open debug overlay for real-time monitoring
- Dev tools are automatically disabled in production for security and performance

### Configuration Files
- `web-admin/.env.local`: Web admin environment variables
- `host-agent/data/display-state.json`: Display assignments and state (auto-generated)
- Host agent settings stored in app data directory

## Troubleshooting

### Common Issues

**Host not showing up in Web Admin**
- Check if host agent is running (system tray icon visible)
- Verify Web Admin URL is configured correctly in host agent
- Check network connectivity between host and web admin
- Verify firewall allows HTTP traffic on port 3000
- Check web admin logs for heartbeat errors

**Host shows as Offline**
- Host status is calculated based on last heartbeat (30s interval)
- Host is marked offline if no heartbeat for >2 minutes
- Check if host agent is actually running
- Verify network connectivity
- Check host agent logs for errors

**gRPC Commands Not Working**
- Verify port 8082 is open on mini PC firewall
- Test gRPC connectivity: `telnet mini-pc-ip 8082`
- Check host agent logs for gRPC errors
- Ensure host agent gRPC server started successfully

**Window management fails**
- Check Electron application is running properly (system tray icon)
- Verify display configuration in Windows Settings
- Test monitor setup with Windows display settings
- Check host agent logs for window manager errors
- Try "Identify Displays" to verify display detection

**Authentication issues**
- Use Cookie Editor to sync cookies from web admin
- Verify cookie domain matches dashboard URL domain
- Check that cookies are being set correctly in browser windows
- Re-sync cookies if session expires

**Display not showing dashboard**
- Check if dashboard URL is accessible from mini PC
- Verify display is detected (check Displays count in host details)
- Try "Identify Displays" to see if display is working
- Check for errors in host agent logs
- Take screenshot to verify what's actually showing

**Database connection errors**
- Verify PostgreSQL is running
- Check DATABASE_URL in .env.local
- Run migrations: `npm run migrate`
- Check web admin logs for database errors

### Logs

**Web Admin:**
- Browser console (F12)
- Next.js server logs (terminal running npm run dev)
- Check `/api/hosts/[hostId]/logs` endpoint for host logs

**Host Agent:**
- In-memory logs (last 1000 entries)
- View via Web Admin → Host Details → "Load Logs"
- Or check Electron console if running in dev mode
- Windows Event Viewer for crashes

**Log Levels:**
- ERROR: Critical issues requiring attention
- WARN: Potential problems
- INFO: Normal operations
- DEBUG: Detailed troubleshooting info

## Roadmap

### Phase 1 ✅ (Completed)
- [x] gRPC-based architecture for commands
- [x] HTTP heartbeat registration
- [x] Electron-based window management
- [x] Cookie synchronization with visual editor
- [x] Web admin interface for management
- [x] Real-time monitoring with SSE
- [x] PostgreSQL database persistence
- [x] System tray integration
- [x] Debug overlay system
- [x] Display identification
- [x] Screenshot capture
- [x] Live log viewing
- [x] Per-display dashboard controls
- [x] Auto-updater system

### Phase 2 🚧 (In Progress)
- [ ] Advanced scheduling features (time-based dashboard switching)
- [ ] Alert system (email/SMS notifications)
- [ ] Dashboard rotation/playlist
- [ ] Custom display layouts
- [ ] Mobile app for quick control
- [ ] Performance analytics and reporting
- [ ] Backup and restore configuration

### Phase 3 🔮 (Future)
- [ ] Cloud deployment (Vercel/AWS)
- [ ] Multi-tenant support
- [ ] Advanced analytics dashboard
- [ ] Multi-location/site management
- [ ] Integration with office automation systems
- [ ] API for third-party integrations
- [ ] Role-based access control (RBAC)

## Contributing

1. Follow the development guidelines in `.cursor/rules.md`
2. Create feature branches for new functionality
3. Include tests for new features
4. Update documentation as needed

## License

Internal project - All rights reserved
