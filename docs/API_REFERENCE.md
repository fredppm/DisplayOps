# DisplayOps Management System - API Reference

## Overview

The DisplayOps Management System consists of three main components:
- **Web Controller**: NextJS-based management interface
- **Host Agent**: Electron-based agent running on display devices
- **Browser Extension**: Chrome extension for authentication sync

This document provides a comprehensive reference of all active APIs and integrations.

## Web Controller APIs

### Host Management

#### Execute Host Command
**Endpoint**: `POST /api/host/{hostId}/command`

Execute commands on remote host agents via gRPC.

**Supported Commands**:
- `REFRESH_PAGE` - Refresh current dashboard
- `identify_displays` - Show display identification overlay
- `open_dashboard` - Deploy dashboard to specific display
- `SYNC_COOKIES` - Synchronize authentication cookies

**Request Body**:
```json
{
  "type": "open_dashboard",
  "display_id": "display-1",
  "dashboard_id": "dash-123",
  "url": "https://example.com/dashboard",
  "fullscreen": true
}
```

#### Debug Management
**Endpoints**:
- `POST /api/host/{hostId}/debug/toggle` - Enable/disable debug mode
- `GET /api/host/{hostId}/debug/events?limit=1000` - Download debug logs
- `DELETE /api/host/{hostId}/debug/events` - Clear debug logs

#### Display Management
**Endpoints**:
- `GET /api/host/{hostId}/windows` - Get active browser windows
- `DELETE /api/host/{hostId}/display/{displayId}/remove-dashboard` - Remove dashboard

### Discovery System

#### Host Discovery
**Endpoints**:
- `GET /api/discovery/events` - **Server-Sent Events stream** for real-time host discovery
- `GET /api/discovery/hosts` - HTTP fallback for host list

**SSE Event Types**:
- `host_discovered` - New host found on network
- `host_updated` - Host information changed
- `host_lost` - Host no longer reachable

### Dashboard Management

#### Dashboard CRUD Operations
**Endpoints**:
- `GET /api/dashboards` - List all dashboards
- `POST /api/dashboards` - Create new dashboard
- `PUT /api/dashboards/{id}` - Update existing dashboard
- `DELETE /api/dashboards/{id}` - Delete dashboard

**Dashboard Schema**:
```json
{
  "id": "string",
  "name": "string", 
  "url": "string",
  "refresh_interval_ms": "number",
  "fullscreen": "boolean"
}
```

### Authentication & Cookies

#### Cookie Management
**Endpoints**:
- `GET /api/cookies/status` - Get cookie storage overview
- `GET /api/cookies/domain/{domain}` - Get cookies for specific domain
- `POST /api/cookies/add` - Add individual cookie
- `POST /api/cookies/remove` - Remove specific cookie
- `POST /api/cookies/import` - Import structured cookies
- `POST /api/cookies/import-devtools` - Import DevTools format cookies
- `DELETE /api/cookies/domain` - Remove entire domain

**Cookie Schema**:
```json
{
  "name": "string",
  "value": "string", 
  "domain": "string",
  "path": "string",
  "expires": "number",
  "httpOnly": "boolean",
  "secure": "boolean",
  "sameSite": "string"
}
```

### Extension System

#### Extension Download
**Endpoint**: `GET /api/extension/download`

Downloads the DisplayOps browser extension as a zip file.

### Application Lifecycle

#### System Management
**Endpoints**:
- `POST /api/auto-init` - Initialize application state
- `POST /api/dashboard-closed` - Notify dashboard closure (via sendBeacon)

## gRPC Service Reference

### Host Agent Service

The host agent exposes a gRPC service on port 8082 with the following methods:

#### ExecuteCommand
Execute single commands on the host agent.

**Command Types**:
| Command | Purpose |
|---------|---------|
| `OPEN_DASHBOARD` | Deploy dashboard to display |
| `REFRESH_DASHBOARD` | Refresh current dashboard |
| `SET_COOKIES` | Sync authentication cookies |
| `HEALTH_CHECK` | Get system status |
| `IDENTIFY_DISPLAYS` | Show display identification |
| `TAKE_SCREENSHOT` | Capture display screenshot |
| `RESTART_DASHBOARD` | Restart dashboard process |
| `DEBUG_ENABLE` | Enable debug mode |
| `DEBUG_DISABLE` | Disable debug mode |
| `REMOVE_DASHBOARD` | Remove dashboard from display |

#### StreamEvents
Server streaming for real-time events.

**Event Types**:
| Event | Description |
|-------|-------------|
| `HEARTBEAT` | System status updates (every 30s) |
| `DISPLAY_STATE_CHANGED` | Display status changes |
| `HOST_STATUS_CHANGED` | Host system status updates |

#### HealthCheck
Unary RPC for health status checking.

**Response includes**:
- Host system status (CPU, memory, uptime)
- Display states and assignments
- System information

## Browser Extension Integration

### Extension APIs

The browser extension communicates with host agents via HTTP:

#### Connection Health
**Endpoint**: `GET /api/cookies/status`

Check connection status and cookie storage health.

#### Cookie Sync
**Endpoint**: `POST /api/cookies/import`

Sync detected authentication cookies from browser sessions.

### Extension Features

- **Auto-Detection**: Identifies dashboard domains (Grafana, Tableau, etc.)
- **Login Monitoring**: Detects successful authentication events
- **Cookie Extraction**: Extracts relevant authentication cookies
- **Auto-Sync**: Automatically syncs to discovered DisplayOps systems

## Network Architecture

### Service Discovery

Uses mDNS (Multicast DNS) for automatic host discovery:
- **Service Type**: `_displayops._tcp.local`
- **Port**: UDP 5353
- **TXT Records**: Host metadata (displays, version, capabilities)

### Communication Protocols

- **Web Controller ↔ Host Agent**: gRPC (port 8082)
- **Browser Extension ↔ Host Agent**: HTTP APIs (port 8080)
- **Host Discovery**: mDNS (UDP 5353)
- **Web Interface**: HTTP/WebSocket (NextJS default ports)

### Real-Time Updates

- **Primary**: Server-Sent Events for host discovery
- **Secondary**: gRPC streaming for host events
- **Fallback**: HTTP polling when connections fail

## Error Handling

### Circuit Breaker Pattern

gRPC connections implement circuit breakers with:
- Connection timeouts
- Automatic retry with exponential backoff
- Graceful fallback to cached data

### Resilience Features

- **Connection Recovery**: Automatic reconnection on network changes
- **Cached Data**: Local caching for offline operation
- **Timeout Handling**: Configurable timeouts for all operations
- **Error Reporting**: Structured error responses with proper HTTP codes

## Authentication Flow

1. User logs into dashboard via browser
2. Browser extension detects successful login
3. Extension extracts authentication cookies
4. Extension syncs cookies to discovered DisplayOps hosts
4. Extension syncs cookies to discovered DisplayOps hosts
5. Host agents store cookies for dashboard authentication
6. Dashboards deployed with pre-authenticated sessions

This architecture provides seamless authentication across all display devices without manual credential management.