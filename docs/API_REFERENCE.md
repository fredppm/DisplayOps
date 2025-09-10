# API Reference - Sistema Atual

## Visão Geral
Este documento descreve todas as APIs disponíveis no sistema atual, incluindo endpoints, parâmetros, respostas e exemplos de uso.

## Base URL
- **Desenvolvimento**: `http://localhost:3000`
- **Produção**: Configurável via variáveis de ambiente

## Autenticação
Atualmente o sistema não possui autenticação. Todas as APIs são públicas.

## Endpoints

### 1. Discovery APIs

#### GET `/api/discovery/hosts`
Lista todos os hosts descobertos via mDNS.

**Resposta:**
```json
{
  "hosts": [
    {
      "id": "host-001",
      "name": "Display-001",
      "address": "192.168.1.100",
      "port": 50051,
      "status": "online",
      "lastSeen": "2024-01-01T10:00:00Z",
      "capabilities": ["display", "browser"],
      "metadata": {
        "location": "1º Andar",
        "department": "Marketing"
      }
    }
  ]
}
```

#### GET `/api/discovery/events`
Endpoint para Server-Sent Events (SSE) que fornece atualizações em tempo real sobre descoberta de hosts.

**Headers necessários:**
```
Accept: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
```

**Eventos:**
```javascript
// Host descoberto
event: host-discovered
data: {"id": "host-001", "name": "Display-001", "status": "online"}

// Host perdido
event: host-lost
data: {"id": "host-001", "name": "Display-001", "status": "offline"}

// Status atualizado
event: host-updated
data: {"id": "host-001", "status": "error", "error": "Connection failed"}
```

### 2. Host Management APIs

#### POST `/api/host/[hostId]/command`
Envia comandos para um host específico.

**Parâmetros:**
- `hostId` (path): ID do host alvo

**Body:**
```json
{
  "command": "navigate",
  "params": {
    "url": "https://example.com",
    "timeout": 5000
  }
}
```

**Comandos disponíveis:**
- `navigate`: Navega para uma URL
- `refresh`: Atualiza a página atual
- `close`: Fecha todas as janelas
- `restart`: Reinicia o host agent
- `ping`: Testa conectividade

**Resposta:**
```json
{
  "success": true,
  "commandId": "cmd-123",
  "timestamp": "2024-01-01T10:00:00Z",
  "result": {
    "status": "executed",
    "message": "Navigation successful"
  }
}
```

#### GET `/api/host/[hostId]/windows`
Lista janelas abertas no host.

**Resposta:**
```json
{
  "windows": [
    {
      "id": "window-001",
      "title": "Example Page",
      "url": "https://example.com",
      "status": "active",
      "openedAt": "2024-01-01T10:00:00Z"
    }
  ]
}
```

#### GET `/api/host/[hostId]/display/state`
Obtém o estado atual do display.

**Resposta:**
```json
{
  "display": {
    "status": "active",
    "currentUrl": "https://example.com",
    "lastUpdate": "2024-01-01T10:00:00Z",
    "error": null
  }
}
```

#### POST `/api/host/[hostId]/display/override`
Força uma URL específica no display (override de emergência).

**Body:**
```json
{
  "url": "https://emergency.com",
  "duration": 300000,
  "reason": "Emergency broadcast"
}
```

#### GET `/api/host/[hostId]/debug/info`
Obtém informações de debug do host.

**Resposta:**
```json
{
  "debug": {
    "version": "1.0.0",
    "uptime": 3600,
    "memory": {
      "used": 512,
      "total": 2048
    },
    "cpu": {
      "usage": 25.5
    },
    "logs": [
      {
        "level": "info",
        "message": "Host agent started",
        "timestamp": "2024-01-01T10:00:00Z"
      }
    ]
  }
}
```

### 3. Dashboard APIs

#### GET `/api/dashboards`
Lista todos os dashboards configurados.

**Resposta:**
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

#### POST `/api/dashboards`
Cria um novo dashboard.

**Body:**
```json
{
  "name": "New Dashboard",
  "description": "Dashboard description",
  "urls": ["https://example.com"],
  "rotationInterval": 30000,
  "assignedHosts": ["host-001"]
}
```

#### PUT `/api/dashboards/[dashboardId]`
Atualiza um dashboard existente.

#### DELETE `/api/dashboards/[dashboardId]`
Remove um dashboard.

#### POST `/api/dashboards/[dashboardId]/assign`
Atribui hosts a um dashboard.

**Body:**
```json
{
  "hostIds": ["host-001", "host-002"]
}
```

#### POST `/api/dashboards/[dashboardId]/unassign`
Remove hosts de um dashboard.

**Body:**
```json
{
  "hostIds": ["host-001"]
}
```

### 4. Cookie Management APIs

#### GET `/api/cookies`
Lista todas as configurações de cookies.

**Resposta:**
```json
{
  "cookies": [
    {
      "id": "cookie-001",
      "name": "session",
      "domain": ".example.com",
      "value": "abc123",
      "assignedHosts": ["host-001"],
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ]
}
```

#### POST `/api/cookies`
Cria uma nova configuração de cookie.

**Body:**
```json
{
  "name": "session",
  "domain": ".example.com",
  "value": "abc123",
  "assignedHosts": ["host-001"]
}
```

#### PUT `/api/cookies/[cookieId]`
Atualiza uma configuração de cookie.

#### DELETE `/api/cookies/[cookieId]`
Remove uma configuração de cookie.

### 5. Extension APIs

#### GET `/api/extension/status`
Obtém o status da extensão do navegador.

**Resposta:**
```json
{
  "extension": {
    "status": "connected",
    "version": "1.0.0",
    "lastSync": "2024-01-01T10:00:00Z",
    "connectedHosts": ["host-001"]
  }
}
```

#### POST `/api/extension/sync`
Força sincronização com a extensão.

### 6. Auto-Initialization API

#### POST `/api/auto-init`
Inicializa automaticamente o sistema com configurações padrão.

**Body:**
```json
{
  "defaultDashboard": {
    "name": "Default Dashboard",
    "urls": ["https://example.com"]
  },
  "autoAssign": true
}
```

### 7. Dashboard Closed API

#### POST `/api/dashboard-closed`
Notifica que um dashboard foi fechado.

**Body:**
```json
{
  "hostId": "host-001",
  "dashboardId": "dashboard-001",
  "reason": "user_closed"
}
```

## Códigos de Erro

### HTTP Status Codes
- `200`: Sucesso
- `400`: Bad Request - Parâmetros inválidos
- `404`: Not Found - Recurso não encontrado
- `500`: Internal Server Error - Erro interno do servidor

### Error Response Format
```json
{
  "error": {
    "code": "INVALID_PARAMETER",
    "message": "Invalid host ID provided",
    "details": {
      "field": "hostId",
      "value": "invalid-id"
    }
  }
}
```

### Error Codes
- `INVALID_PARAMETER`: Parâmetro inválido
- `HOST_NOT_FOUND`: Host não encontrado
- `DASHBOARD_NOT_FOUND`: Dashboard não encontrado
- `COMMAND_FAILED`: Comando falhou
- `CONNECTION_ERROR`: Erro de conexão
- `VALIDATION_ERROR`: Erro de validação

## Exemplos de Uso

### JavaScript/TypeScript

```typescript
// Listar hosts
const hosts = await fetch('/api/discovery/hosts').then(r => r.json());

// Enviar comando
const command = await fetch('/api/host/host-001/command', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    command: 'navigate',
    params: { url: 'https://example.com' }
  })
}).then(r => r.json());

// Escutar eventos SSE
const eventSource = new EventSource('/api/discovery/events');
eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Host update:', data);
};
```

### cURL

```bash
# Listar hosts
curl http://localhost:3000/api/discovery/hosts

# Enviar comando
curl -X POST http://localhost:3000/api/host/host-001/command \
  -H "Content-Type: application/json" \
  -d '{"command": "navigate", "params": {"url": "https://example.com"}}'

# Criar dashboard
curl -X POST http://localhost:3000/api/dashboards \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Dashboard", "urls": ["https://example.com"]}'
```

## Rate Limiting
Atualmente não há rate limiting implementado.

## Logs e Debugging
Todas as requisições são logadas no console do servidor com timestamp e detalhes da operação.

## Versionamento
Esta documentação refere-se à versão atual do sistema. Mudanças futuras serão documentadas em novas versões.