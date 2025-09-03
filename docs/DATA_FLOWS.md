# Fluxos de Dados Críticos - Sistema Atual

## Visão Geral
Este documento descreve os fluxos de dados críticos do sistema, incluindo descoberta de hosts, sincronização de cookies, execução de comandos e monitoramento.

## 1. Fluxo de Descoberta de Hosts (mDNS)

### 1.1 Anúncio do Host Agent
```mermaid
sequenceDiagram
    participant HA as Host Agent
    participant MDNS as mDNS Network
    participant WC as Web Controller
    
    Note over HA, WC: Startup do Host Agent
    HA->>HA: Inicializar gRPC service (porta 8082)
    HA->>MDNS: Anunciar serviço _displayops._tcp.local
    Note right of HA: TXT records: version, displays, capabilities
    
    loop A cada 30 segundos
        HA->>MDNS: Renovar anúncio mDNS
    end
```

### 1.2 Descoberta pelo Web Controller
```mermaid
sequenceDiagram
    participant WC as Web Controller
    participant MDNS as mDNS Network
    participant HA as Host Agent
    
    Note over WC, HA: Inicialização do Web Controller
    WC->>MDNS: Escutar _displayops._tcp.local
    MDNS->>WC: Host Agent descoberto
    WC->>WC: Armazenar informações do host
    WC->>WC: Atualizar lista de hosts disponíveis
    
    Note over WC, HA: Eventos em tempo real (SSE)
    WC->>WC: Emitir evento host-discovered
    WC->>WC: Atualizar interface do usuário
```

### 1.3 Dados Transmitidos
```json
{
  "hostId": "host-001",
  "name": "Display-001",
  "address": "192.168.1.100",
  "port": 8082,
  "capabilities": ["display", "browser", "cookies"],
  "metadata": {
    "version": "1.0.0",
    "displays": 2,
    "location": "1º Andar",
    "department": "Marketing"
  }
}
```

## 2. Fluxo de Sincronização de Cookies

### 2.1 Detecção de Login pela Extensão
```mermaid
sequenceDiagram
    participant User as Usuário
    participant BE as Browser Extension
    participant Site as Dashboard Site
    participant HA as Host Agent
    
    User->>Site: Login no dashboard
    Site->>User: Cookies de autenticação
    BE->>BE: Detectar cookies de auth
    BE->>BE: Extrair dados relevantes
    BE->>HA: POST /api/cookies/import
    Note right of BE: Dados: name, value, domain, path
    
    HA->>HA: Armazenar cookies na sessão
    HA->>BE: Confirmação de recebimento
```

### 2.2 Estrutura dos Cookies
```json
{
  "cookies": [
    {
      "name": "session",
      "value": "abc123def456",
      "domain": ".example.com",
      "path": "/",
      "secure": true,
      "httpOnly": true,
      "expires": 1735689600
    }
  ],
  "assignedHosts": ["host-001", "host-002"]
}
```

### 2.3 Aplicação nos Displays
```mermaid
sequenceDiagram
    participant WC as Web Controller
    participant HA as Host Agent
    participant Browser as Browser Window
    
    WC->>HA: Comando open_dashboard
    HA->>Browser: Abrir nova janela
    HA->>Browser: Aplicar cookies da sessão
    Browser->>Browser: Navegar para dashboard
    Browser->>Browser: Usar cookies para auth
    HA->>WC: Status: dashboard carregado
```

## 3. Fluxo de Execução de Comandos

### 3.1 Comando de Navegação
```mermaid
sequenceDiagram
    participant WC as Web Controller
    participant HA as Host Agent
    participant Browser as Browser Window
    participant Display as Display Device
    
    WC->>WC: Usuário seleciona dashboard
    WC->>HA: gRPC ExecuteCommand
    Note right of WC: {command: "open_dashboard", url: "https://example.com"}
    
    HA->>Browser: Criar nova janela
    HA->>Browser: Aplicar cookies
    HA->>Browser: Navegar para URL
    Browser->>Display: Renderizar dashboard
    
    HA->>WC: Status: success/error
    WC->>WC: Atualizar interface
```

### 3.2 Comando de Refresh
```mermaid
sequenceDiagram
    participant WC as Web Controller
    participant HA as Host Agent
    participant Browser as Browser Window
    
    WC->>HA: gRPC ExecuteCommand
    Note right of WC: {command: "refresh_dashboard"}
    
    HA->>Browser: Reload página atual
    Browser->>Browser: Recarregar conteúdo
    HA->>WC: Status: refreshed
```

### 3.3 Estrutura dos Comandos gRPC
```protobuf
message Command {
  string command = 1;
  string display_id = 2;
  string dashboard_id = 3;
  string url = 4;
  bool fullscreen = 5;
  map<string, string> params = 6;
}

message CommandResponse {
  bool success = 1;
  string message = 2;
  string error = 3;
  int64 timestamp = 4;
}
```

## 4. Fluxo de Monitoramento e Health Check

### 4.1 Health Check Automático
```mermaid
sequenceDiagram
    participant HA as Host Agent
    participant WC as Web Controller
    
    loop A cada 30 segundos
        HA->>HA: Coletar métricas do sistema
        Note right of HA: CPU, memória, uptime, displays
        
        HA->>WC: gRPC HealthCheck
        Note right of HA: {status: "healthy", metrics: {...}}
        
        WC->>WC: Atualizar status do host
        WC->>WC: Emitir evento host-updated
    end
```

### 4.2 Métricas Coletadas
```json
{
  "hostId": "host-001",
  "status": "healthy",
  "uptime": 3600,
  "system": {
    "cpu": {
      "usage": 25.5,
      "cores": 4
    },
    "memory": {
      "used": 2048,
      "total": 8192,
      "percentage": 25.0
    },
    "disk": {
      "used": 50000,
      "total": 250000,
      "percentage": 20.0
    }
  },
  "displays": [
    {
      "id": "display-1",
      "status": "active",
      "currentUrl": "https://example.com",
      "lastUpdate": "2024-01-01T10:00:00Z"
    }
  ],
  "timestamp": "2024-01-01T10:00:00Z"
}
```

## 5. Fluxo de Configuração de Dashboards

### 5.1 Criação de Dashboard
```mermaid
sequenceDiagram
    participant User as Usuário
    participant WC as Web Controller
    participant Data as JSON Files
    
    User->>WC: Criar novo dashboard
    Note right of User: Nome, URLs, intervalo de rotação
    
    WC->>WC: Validar dados
    WC->>Data: Salvar em dashboards.json
    WC->>WC: Atualizar interface
    WC->>User: Confirmação de criação
```

### 5.2 Atribuição de Hosts
```mermaid
sequenceDiagram
    participant User as Usuário
    participant WC as Web Controller
    participant HA as Host Agent
    
    User->>WC: Atribuir hosts ao dashboard
    WC->>WC: Atualizar configuração
    WC->>HA: Comando open_dashboard
    HA->>HA: Aplicar nova configuração
    HA->>WC: Confirmação de aplicação
```

### 5.3 Estrutura de Configuração
```json
{
  "dashboards": [
    {
      "id": "dashboard-001",
      "name": "Marketing Dashboard",
      "description": "Dashboard para equipe de marketing",
      "urls": [
        "https://analytics.google.com",
        "https://facebook.com/insights"
      ],
      "rotationInterval": 30000,
      "assignedHosts": ["host-001", "host-002"],
      "createdAt": "2024-01-01T00:00:00Z",
      "updatedAt": "2024-01-01T00:00:00Z"
    }
  ]
}
```

## 6. Fluxo de Tratamento de Erros

### 6.1 Erro de Conexão
```mermaid
sequenceDiagram
    participant WC as Web Controller
    participant HA as Host Agent
    
    WC->>HA: gRPC Command
    Note over WC, HA: Timeout ou erro de rede
    
    WC->>WC: Marcar host como offline
    WC->>WC: Emitir evento host-lost
    WC->>WC: Atualizar interface
    
    Note over WC, HA: Retry automático
    loop A cada 5 segundos
        WC->>HA: Tentar reconexão
        alt Sucesso
            WC->>WC: Marcar host como online
            WC->>WC: Emitir evento host-discovered
        end
    end
```

### 6.2 Erro de Comando
```mermaid
sequenceDiagram
    participant WC as Web Controller
    participant HA as Host Agent
    participant Browser as Browser Window
    
    WC->>HA: gRPC ExecuteCommand
    HA->>Browser: Tentar executar comando
    Browser->>HA: Erro (ex: URL inválida)
    
    HA->>WC: CommandResponse com erro
    WC->>WC: Registrar erro no log
    WC->>WC: Atualizar status do host
    WC->>WC: Mostrar notificação de erro
```

## 7. Fluxo de Dados Persistentes

### 7.1 Armazenamento Local
```mermaid
graph LR
    subgraph "Web Controller"
        WC[Web Controller]
        DASH[dashboards.json]
        COOKIES[cookies.json]
        LOGS[logs/]
        
        WC --> DASH
        WC --> COOKIES
        WC --> LOGS
    end
    
    subgraph "Host Agent"
        HA[Host Agent]
        CONFIG[config.json]
        CACHE[cache/]
        
        HA --> CONFIG
        HA --> CACHE
    end
```

### 7.2 Estrutura dos Arquivos
```json
// dashboards.json
{
  "dashboards": [...],
  "lastUpdated": "2024-01-01T10:00:00Z",
  "version": "1.0.0"
}

// cookies.json
{
  "cookies": [...],
  "lastSync": "2024-01-01T10:00:00Z"
}

// config.json (Host Agent)
{
  "hostId": "host-001",
  "name": "Display-001",
  "displays": 2,
  "autoStart": true,
  "logLevel": "info"
}
```

## 8. Considerações de Performance

### 8.1 Latência Típica
- **mDNS Discovery**: 1-3 segundos
- **gRPC Command**: 50-200ms
- **Cookie Sync**: 100-500ms
- **Health Check**: 100-300ms

### 8.2 Throughput
- **Comandos simultâneos**: 10-50 por segundo
- **Hosts suportados**: 100+ por controller
- **Cookies por host**: 1000+ cookies
- **Dashboards**: 100+ por controller

### 8.3 Otimizações
- **Caching**: Dados de hosts em memória
- **Compression**: gRPC com gzip
- **Batching**: Múltiplos comandos em uma requisição
- **Connection Pooling**: Reutilização de conexões gRPC
