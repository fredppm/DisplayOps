# API Reference - Office TV Management System

## Host Agent API (Port 8080)

### Base URL
```
http://localhost:8080
```

## System APIs

### Health Check
**GET** `/health`

Simple health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-01-XX..."
}
```

### System Status
**GET** `/api/status`

Get comprehensive system status.

**Response:**
```json
{
  "success": true,
  "data": {
    "agent_id": "office-tv-agent",
    "uptime": 3600,
    "displays": 2,
    "activeWindows": 1,
    "mdnsStatus": "active",
    "version": "1.0.0"
  },
  "timestamp": "2025-01-XX..."
}
```

## Cookie Management APIs

### Import Cookies
**POST** `/api/cookies/import`

Import cookies for a specific domain.

**Request Body:**
```json
{
  "domain": "https://grafana.company.com",
  "cookies": "session_id=abc123; auth_token=xyz789"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "domain": "https://grafana.company.com",
    "cookiesImported": 2,
    "status": "imported"
  },
  "timestamp": "2025-01-XX..."
}
```

### Cookie Status
**GET** `/api/cookies/status`

Get status of all imported cookies.

**Response:**
```json
{
  "success": true,
  "data": {
    "domains": [
      {
        "domain": "https://grafana.company.com",
        "cookieCount": 2,
        "lastSync": "2025-01-XX...",
        "status": "valid"
      }
    ],
    "totalDomains": 1
  },
  "timestamp": "2025-01-XX..."
}
```

### Refresh Cookies
**POST** `/api/cookies/refresh`

Re-sync all cookies to active windows.

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Cookies refreshed successfully",
    "domainsProcessed": 1,
    "windowsUpdated": 2
  },
  "timestamp": "2025-01-XX..."
}
```

### Validate Domain Cookies
**POST** `/api/cookies/validate/:domain`

Validate cookies for a specific domain.

**URL Parameters:**
- `domain`: URL-encoded domain (e.g., `https%3A%2F%2Fgrafana.company.com`)

**Response:**
```json
{
  "success": true,
  "data": {
    "domain": "https://grafana.company.com",
    "valid": true,
    "cookieCount": 2,
    "lastValidated": "2025-01-XX..."
  },
  "timestamp": "2025-01-XX..."
}
```

### Delete Domain Cookies
**DELETE** `/api/cookies/:domain`

Clear cookies for a specific domain.

**URL Parameters:**
- `domain`: URL-encoded domain

**Response:**
```json
{
  "success": true,
  "data": {
    "domain": "https://grafana.company.com",
    "message": "Cookies cleared successfully"
  },
  "timestamp": "2025-01-XX..."
}
```

## Debug System APIs

### Enable Debug Mode
**POST** `/api/debug/enable`

Activate debug mode and overlay.

**Response:**
```json
{
  "success": true,
  "data": {
    "enabled": true,
    "overlayVisible": true,
    "message": "Debug mode enabled"
  },
  "timestamp": "2025-01-XX..."
}
```

### Disable Debug Mode
**POST** `/api/debug/disable`

Deactivate debug mode.

**Response:**
```json
{
  "success": true,
  "data": {
    "enabled": false,
    "overlayVisible": false,
    "message": "Debug mode disabled"
  },
  "timestamp": "2025-01-XX..."
}
```

### Debug Status
**GET** `/api/debug/status`

Get debug system status and metrics.

**Response:**
```json
{
  "success": true,
  "data": {
    "enabled": true,
    "metrics": {
      "cpu": 15,
      "memory": 45,
      "uptime": 3600,
      "activeWindows": 2,
      "apiRequestsPerMinute": 12,
      "mdnsStatus": "active"
    },
    "overlayVisible": true
  },
  "timestamp": "2025-01-XX..."
}
```

### Get Debug Events
**GET** `/api/debug/events`

Retrieve debug events with optional filtering.

**Query Parameters:**
- `limit` (optional): Number of events to return (default: 50, max: 100)

**Response:**
```json
{
  "success": true,
  "data": {
    "events": [
      {
        "timestamp": "2025-01-XX 14:32:15",
        "type": "api_request",
        "category": "API",
        "message": "POST /api/command",
        "data": { "body": {...} },
        "duration": 150
      }
    ],
    "totalEvents": 25,
    "returned": 25
  },
  "timestamp": "2025-01-XX..."
}
```

### Clear Debug Events
**DELETE** `/api/debug/events`

Clear all stored debug events.

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Debug events cleared",
    "eventsCleared": 25
  },
  "timestamp": "2025-01-XX..."
}
```

## Display Management APIs

### Identify Displays
**POST** `/api/displays/identify`

Show identification numbers on all displays.

**Request Body (optional):**
```json
{
  "duration": 5,
  "fontSize": 200,
  "backgroundColor": "rgba(0, 0, 0, 0.8)"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Identifying 2 displays for 5 seconds",
    "displays": [
      {
        "displayId": 1,
        "bounds": {
          "x": 0,
          "y": 0,
          "width": 1920,
          "height": 1080
        }
      }
    ],
    "options": {
      "duration": 5,
      "fontSize": 200,
      "backgroundColor": "rgba(0, 0, 0, 0.8)"
    }
  },
  "timestamp": "2025-01-XX..."
}
```

## Window Management APIs

### List Windows
**GET** `/api/windows`

Get list of all managed windows.

**Response:**
```json
{
  "success": true,
  "data": {
    "windows": [
      {
        "id": "dashboard-1",
        "url": "https://grafana.company.com/d/main",
        "display": 1,
        "status": "active",
        "created": "2025-01-XX..."
      }
    ],
    "totalWindows": 1
  },
  "timestamp": "2025-01-XX..."
}
```

### Create Window
**POST** `/api/windows/create`

Create a new dashboard window.

**Request Body:**
```json
{
  "url": "https://grafana.company.com/d/main",
  "display": 1,
  "windowId": "dashboard-1"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "windowId": "dashboard-1",
    "url": "https://grafana.company.com/d/main",
    "display": 1,
    "status": "created"
  },
  "timestamp": "2025-01-XX..."
}
```

## Command System API

### Execute Command
**POST** `/api/command`

Execute unified commands through the command system.

**Request Body:**
```json
{
  "type": "open_dashboard",
  "targetDisplay": "1",
  "payload": {
    "url": "https://grafana.company.com/d/main",
    "windowId": "dashboard-1"
  },
  "timestamp": "2025-01-XX..."
}
```

### Available Command Types

#### open_dashboard
Open a dashboard on a specific display.

**Payload:**
```json
{
  "url": "https://grafana.company.com/d/main",
  "windowId": "dashboard-1"
}
```

#### close_window
Close a specific window.

**Payload:**
```json
{
  "windowId": "dashboard-1"
}
```

#### identify_displays
Identify all displays.

**Payload:**
```json
{
  "duration": 5,
  "fontSize": 200
}
```

#### sync_cookies
Sync cookies to all windows.

**Payload:**
```json
{
  "domain": "https://grafana.company.com"
}
```

**Response Format:**
```json
{
  "success": true,
  "data": {
    "commandId": "cmd-123",
    "type": "open_dashboard",
    "status": "executed",
    "result": { /* command-specific result */ }
  },
  "timestamp": "2025-01-XX..."
}
```

## Error Responses

All APIs use consistent error response format:

```json
{
  "success": false,
  "error": "Error message describing what went wrong",
  "code": "ERROR_CODE",
  "timestamp": "2025-01-XX..."
}
```

### Common Error Codes

- `INVALID_REQUEST` - Malformed request body or parameters
- `SERVICE_UNAVAILABLE` - Required service not available
- `DISPLAY_NOT_FOUND` - Specified display doesn't exist
- `WINDOW_NOT_FOUND` - Specified window doesn't exist
- `COOKIE_PARSE_ERROR` - Invalid cookie format
- `DEBUG_NOT_AVAILABLE` - Debug system not initialized

## Rate Limiting

APIs have the following rate limits:
- General APIs: 100 requests/minute
- Debug APIs: 200 requests/minute
- Cookie APIs: 50 requests/minute

## Authentication

Currently, the host agent API does not require authentication as it runs on localhost. In production environments, consider implementing:
- API key authentication
- IP whitelisting
- TLS encryption

## WebSocket API (Future)

Real-time updates will be available via WebSocket connection:

```javascript
const ws = new WebSocket('ws://localhost:8080/ws');

ws.on('message', (data) => {
  const event = JSON.parse(data);
  console.log('Real-time event:', event);
});
```

## SDK Examples

### Node.js
```javascript
const axios = require('axios');

class OfficeTVAPI {
  constructor(baseURL = 'http://localhost:8080') {
    this.client = axios.create({ baseURL });
  }

  async identifyDisplays(options = {}) {
    const response = await this.client.post('/api/displays/identify', options);
    return response.data;
  }

  async syncCookies(domain, cookies) {
    const response = await this.client.post('/api/cookies/import', {
      domain, cookies
    });
    return response.data;
  }

  async enableDebug() {
    const response = await this.client.post('/api/debug/enable');
    return response.data;
  }
}
```

### PowerShell
```powershell
# Identify displays
$response = Invoke-RestMethod -Uri "http://localhost:8080/api/displays/identify" -Method POST

# Import cookies
$body = @{
  domain = "https://grafana.company.com"
  cookies = "session=abc123; token=xyz789"
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri "http://localhost:8080/api/cookies/import" -Method POST -Body $body -ContentType "application/json"
```