# DisplayOps Management System - Architecture

## Overview
A distributed system to manage multiple displays in an office environment, handling dashboard display, authentication, and monitoring across multiple mini PCs.

## System Components

### 1. Web Controller (NextJS)
- **Purpose**: Central control interface for managing all displays
- **Technology**: NextJS with TypeScript
- **Responsibilities**:
  - Provide web interface for display configuration
  - Manage dashboard assignments per display
  - Handle cookie synchronization
  - Monitor host agent status
  - Store configuration in local JSON files

### 2. Host Agent (Electron)
- **Purpose**: Desktop application running on each mini PC controlling 2 displays
- **Technology**: Electron with TypeScript
- **Architecture**: Main process + Renderer processes for each display
- **Responsibilities**:
  - Receive commands from web controller via REST API
  - Manage dual-display windows with native Electron APIs
  - Handle cookie synchronization using Electron session API
  - Monitor dashboard health via IPC communication
  - Auto-update using Electron's autoUpdater module
  - Report status back to controller

### 3. Communication Layer
- **Discovery**: mDNS/Bonjour for automatic service discovery
- **Protocol**: REST API with JSON payloads  
- **Authentication**: Simple token-based auth
- **Service Name**: `_displayops._tcp.local`
- **Commands**:
  - `open_dashboard` - Navigate to specific dashboard
  - `sync_cookies` - Copy authentication cookies
  - `health_check` - Report system status
  - `update_agent` - Download and install updates

## Data Flow

1. **Discovery**: Host agents advertise `_displayops._tcp.local` service on startup
2. **Registration**: Web controller discovers agents automatically via mDNS
3. **Configuration**: User configures dashboards via web interface
4. **Command**: Web controller sends commands to discovered host agents
5. **Execution**: Host agents execute commands using Electron windows
6. **Monitoring**: Continuous health checks and status reporting
7. **Updates**: Automatic agent updates when new versions available

## Network Architecture

### Diagrama de Arquitetura Atual

```mermaid
graph TB
    subgraph "Web Controller (NextJS)"
        WC[Web Controller<br/>localhost:3000]
        WC_API[API Routes]
        WC_UI[React UI]
        WC_DATA[Local JSON Files]
        
        WC --> WC_API
        WC --> WC_UI
        WC_API --> WC_DATA
    end
    
    subgraph "Browser Extension"
        BE[Chrome Extension]
        BE_COOKIES[Cookie Sync]
        BE_DISCOVERY[Host Discovery]
        
        BE --> BE_COOKIES
        BE --> BE_DISCOVERY
    end
    
    subgraph "Host Agent (Electron)"
        HA[Host Agent<br/>localhost:8082]
        HA_GRPC[gRPC Service]
        HA_BROWSER[Browser Windows]
        HA_COOKIES[Cookie Manager]
        HA_TRAY[System Tray]
        
        HA --> HA_GRPC
        HA --> HA_BROWSER
        HA --> HA_COOKIES
        HA --> HA_TRAY
    end
    
    subgraph "Display Devices"
        D1[Display 1]
        D2[Display 2]
    end
    
    %% Connections
    WC_API -.->|mDNS Discovery| HA
    WC_API -.->|gRPC Commands| HA_GRPC
    BE_DISCOVERY -.->|mDNS| HA
    BE_COOKIES -->|HTTP API| HA_COOKIES
    HA_BROWSER --> D1
    HA_BROWSER --> D2
    
    %% Data Flow
    WC_DATA -.->|Dashboard Config| WC_API
    WC_API -.->|Commands| HA_GRPC
    HA_GRPC -.->|Status Updates| WC_API
```

### Fluxo de Dados Detalhado

```mermaid
sequenceDiagram
    participant WC as Web Controller
    participant BE as Browser Extension
    participant HA as Host Agent
    participant D as Displays
    
    Note over WC, D: 1. Discovery Phase
    HA->>WC: mDNS Advertisement (_displayops._tcp.local)
    WC->>WC: Store host info
    
    Note over WC, D: 2. Configuration Phase
    WC->>WC: Load dashboard config from JSON
    WC->>WC: Assign dashboards to hosts
    
    Note over WC, D: 3. Authentication Sync
    BE->>BE: Detect login on dashboard site
    BE->>HA: Sync cookies via HTTP API
    HA->>HA: Store cookies in session
    
    Note over WC, D: 4. Command Execution
    WC->>HA: gRPC Command (open_dashboard)
    HA->>D: Open browser window with dashboard
    HA->>WC: Status update (success/error)
    
    Note over WC, D: 5. Monitoring
    loop Every 30s
        HA->>WC: Health check + status
        WC->>WC: Update host status
    end
```

### Componentes e Responsabilidades

| Componente | Tecnologia | Porta | Responsabilidade |
|------------|------------|-------|------------------|
| Web Controller | NextJS | 3000 | Interface web, gestão de dashboards |
| Host Agent | Electron | 8082 | Controle de displays, execução de comandos |
| Browser Extension | Chrome Ext | - | Sincronização de cookies |
| mDNS Service | Bonjour | 5353 | Descoberta automática de hosts |
| gRPC Service | gRPC | 8082 | Comunicação controller ↔ host |
| HTTP API | Express | 8080 | API para extensão do navegador |

## Security Considerations

- Host agents only accept commands from configured controller IP
- Cookie data encrypted during transfer
- No persistent storage of sensitive authentication data on hosts
- Auto-update mechanism with signature verification

## Future Enhancements

- AWS integration for cloud-based configuration
- Advanced scheduling and rotation features
- Mobile app for quick TV control
- Integration with office automation systems
