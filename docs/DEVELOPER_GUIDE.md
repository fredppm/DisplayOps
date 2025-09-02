# Developer Guide - ScreenFleet Management System

## Architecture Overview

O ScreenFleet Management System consiste em uma arquitetura distribuída com componentes especializados:

- **Web Controller** (NextJS): Interface centralizada de gerenciamento
- **Host Agent** (Electron): Aplicação desktop executada em cada mini PC
- **Communication Layer**: APIs REST para comunicação entre componentes

## Core Components

### 1. Cookie Management System

Sistema avançado para sincronização automática de cookies de autenticação.

#### Implementation Details

```typescript
// host-agent/src/services/cookie-service.ts
class CookieService {
  async importCookies(domain: string, cookies: Cookie[]): Promise<void>
  async validateCookies(domain: string): Promise<boolean>
  async syncCookies(): Promise<void>
}
```

#### APIs
- `POST /api/cookies/import` - Import cookies for a domain
- `GET /api/cookies/status` - Get cookie sync status
- `POST /api/cookies/refresh` - Re-sync all cookies
- `DELETE /api/cookies/:domain` - Clear domain cookies

### 2. Debug Overlay System

Sistema de debug visual em tempo real para monitorar atividade do host agent.

#### Features
- Janela transparente sempre no topo
- Updates em tempo real (1 segundo)
- Hotkey global: `Ctrl+Shift+D`
- Monitoramento de API requests, mDNS, window events, system metrics

#### Implementation
```typescript
// host-agent/src/managers/debug-overlay-manager.ts
class DebugOverlayManager {
  toggleOverlay(): void
  updateMetrics(): void
  logEvent(event: DebugEvent): void
}
```

#### APIs
- `POST /api/debug/enable` - Ativa debug mode
- `GET /api/debug/status` - Status e métricas
- `GET /api/debug/events` - Eventos de debug
- `DELETE /api/debug/events` - Limpa eventos

### 3. Display Identifier System

Sistema para identificar displays/monitores visualmente.

#### Features
- Números grandes em cada monitor
- Customizável (duração, tamanho, cor)
- Multi-monitor support
- Auto-fechamento

#### Implementation
```typescript
// host-agent/src/services/display-identifier.ts
class DisplayIdentifier {
  identifyDisplays(options?: IdentifyOptions): Promise<DisplayInfo[]>
  createIdentifierWindow(display: Display): BrowserWindow
}
```

#### API
- `POST /api/displays/identify` - Identifica todos os displays

### 4. Single Instance Protection

Mecanismo para garantir que apenas uma instância do host agent execute por vez.

#### Features
- File lock mechanism
- PID verification
- Port availability check
- Automatic cleanup

#### Implementation
```typescript
// host-agent/src/utils/single-instance.ts
function ensureSingleInstance(): boolean
function ensurePortAvailable(port: number): Promise<boolean>
```

### 5. Developer Tools Integration

Sistema de habilitação de dev tools baseado em ambiente.

#### Features
- Auto-habilitação em desenvolvimento
- F12 toggle em janelas de dashboard
- Desabilitação automática em produção

#### Implementation
```typescript
// host-agent/src/managers/window-manager.ts
class WindowManager {
  private configureKioskMode(window: BrowserWindow): void
  private enableDevTools(window: BrowserWindow): void
}
```

## Development Workflow

### Setting Up Development Environment

```bash
# Install dependencies for both services
npm install

# Start both services in development mode
npm run dev

# Or start individually
npm run dev:web    # Web controller only
npm run dev:host   # Host agent only
```

### Testing Features

```bash
# Test cookie system
node scripts/test-cookie-system.js

# Test debug overlay
node scripts/test-debug-overlay.js

# Test display identifier
node scripts/test-display-identifier.js

# Test single instance
scripts\test-single-instance.bat
```

### Code Structure

```
host-agent/
├── src/
│   ├── managers/           # System managers
│   │   ├── debug-overlay-manager.ts
│   │   └── window-manager.ts
│   ├── services/           # Business logic services
│   │   ├── cookie-service.ts
│   │   ├── display-identifier.ts
│   │   └── mdns-service.ts
│   ├── routes/             # API routes
│   │   └── api-router.ts
│   └── utils/              # Utilities
│       └── single-instance.ts

web-controller/
├── src/
│   ├── components/         # React components
│   │   ├── CookieManager.tsx
│   │   └── DashboardManager.tsx
│   └── pages/              # NextJS pages
```

## API Reference

### Host Agent APIs

#### System Control
- `GET /health` - Health check
- `GET /api/status` - System status
- `POST /api/command` - Execute commands

#### Cookie Management
- `POST /api/cookies/import` - Import cookies
- `GET /api/cookies/status` - Cookie status
- `POST /api/cookies/refresh` - Refresh cookies

#### Debug System
- `POST /api/debug/enable` - Enable debug mode
- `GET /api/debug/events` - Get debug events
- `DELETE /api/debug/events` - Clear events

#### Display Management
- `POST /api/displays/identify` - Identify displays
- `GET /api/windows` - List windows
- `POST /api/windows/create` - Create window

### Command System

O sistema de comandos unificado permite executar operações através de uma API comum:

```typescript
interface Command {
  type: string;
  targetDisplay?: string;
  payload?: any;
  timestamp: string;
}
```

#### Command Types
- `open_dashboard` - Abre dashboard em display específico
- `close_window` - Fecha janela
- `identify_displays` - Identifica displays
- `sync_cookies` - Sincroniza cookies

## Performance Considerations

### Hot Path Logging Rules
- **NEVER** use debug logging in performance-critical code paths
- Debug logging adds 10-50 microseconds per call even when disabled
- Only use debug logging in error paths or startup

### Resource Management
- Single instance protection prevents resource conflicts
- Automatic cleanup of stale processes and lock files
- Efficient memory usage in debug overlay (~5MB RAM)

## Security Guidelines

### Production Environment
- Dev tools are automatically disabled
- Debug overlay requires explicit activation
- Cookie encryption for local storage

### Development Environment
- Full debugging capabilities enabled
- F12 dev tools available
- Debug overlay with Ctrl+Shift+D

## Troubleshooting

### Common Issues

**Port conflicts:**
```bash
# Check if port is in use
netstat -ano | findstr :8080

# Kill process using port
taskkill /PID <process_id> /F
```

**Multiple instances:**
```bash
# Check for lock files
dir %TEMP%\office-tv-host-agent.lock

# Manual cleanup if needed
del %TEMP%\office-tv-host-agent.lock
```

**Debug overlay not appearing:**
1. Verify Electron is running
2. Test via API: `curl -X POST http://localhost:8080/api/debug/enable`
3. Check console for errors

### Logging

Host agent logs are available at:
- Console output during development
- Windows Event Logs in production
- Debug events via `/api/debug/events`

## Contributing

1. Follow TypeScript strict mode
2. Add tests for new features
3. Update API documentation
4. Test on multiple displays
5. Verify single instance behavior

## Performance Benchmarks

- Cookie sync: <100ms per domain
- Display identification: <500ms startup
- Debug overlay: ~1% CPU overhead
- API response times: <50ms average