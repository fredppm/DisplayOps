# Protocolo de Sincronização Bidirecional - DisplayOps Multi-Site

## Visão Geral

Este documento define o protocolo de sincronização bidirecional entre o Web-Admin (central) e os Controllers locais na arquitetura DisplayOps Multi-Site.

## Objetivos

1. **Bidirecionalidade**: Sincronização em ambas as direções (Web-Admin ↔ Controller)
2. **Confiabilidade**: Garantir entrega e integridade dos dados
3. **Eficiência**: Minimizar tráfego de rede com sincronização incremental
4. **Resiliência**: Operação offline e recuperação automática

## Arquitetura do Protocolo

```
Web-Admin (Central)           Controller Local
       |                            |
       |←── Heartbeat ──────────────|
       |──── Commands ──────────────→|
       |←── Status/Metrics ──────────|
       |←── Config Changes ──────────|
       |──── Dashboard Updates ─────→|
```

## 1. Estrutura de Mensagens

### 1.1 Envelope de Mensagem Base

```typescript
interface SyncMessage {
  id: string;                    // UUID único da mensagem
  type: MessageType;            // Tipo da mensagem
  timestamp: string;            // ISO timestamp
  source: {
    controllerId: string;
    siteId: string;
    version: string;
  };
  target?: {
    controllerId?: string;      // Para mensagens direcionadas
    siteId?: string;
  };
  payload: any;                 // Dados específicos da mensagem
  checksum: string;            // Hash MD5 do payload
  priority: 'low' | 'normal' | 'high' | 'critical';
  ttl?: number;                // Time-to-live em segundos
}

enum MessageType {
  HEARTBEAT = 'heartbeat',
  COMMAND = 'command',
  STATUS = 'status', 
  CONFIG = 'config',
  DASHBOARD = 'dashboard',
  METRICS = 'metrics',
  ACK = 'acknowledgment',
  ERROR = 'error'
}
```

### 1.2 Tipos Específicos de Mensagem

#### Heartbeat (Controller → Web-Admin)
```typescript
interface HeartbeatPayload {
  status: 'online' | 'warning' | 'error';
  uptime: number;
  lastSync: string;
  services: {
    mdns: boolean;
    hostManager: boolean;
    httpServer: boolean;
  };
  hostAgents: {
    total: number;
    online: number;
    offline: number;
  };
  systemMetrics: {
    cpu: number;
    memory: number;
    diskSpace: number;
  };
}
```

#### Command (Web-Admin → Controller)
```typescript
interface CommandPayload {
  commandId: string;
  action: 'display_dashboard' | 'reload_browser' | 'take_screenshot' | 'update_config';
  targets?: string[];          // Host IDs específicos (opcional)
  parameters: {
    [key: string]: any;
  };
  executeAt?: string;          // Timestamp para execução agendada
  timeout: number;             // Timeout em segundos
}
```

#### Config Update (Bidirecional)
```typescript
interface ConfigPayload {
  configType: 'controller' | 'dashboard' | 'host';
  changes: {
    [key: string]: {
      old: any;
      new: any;
      timestamp: string;
    };
  };
  source: 'web-admin' | 'controller' | 'host';
  requiresRestart: boolean;
}
```

#### Dashboard Update (Web-Admin → Controller)
```typescript
interface DashboardPayload {
  dashboards: Array<{
    id: string;
    name: string;
    url: string;
    version: string;
    checksum: string;
    siteRestrictions?: string[];
    controllerRestrictions?: string[];
  }>;
  operation: 'full' | 'incremental' | 'delete';
  lastModified: string;
}
```

## 2. Fluxo de Sincronização

### 2.1 Inicialização

1. Controller inicia e conecta ao Web-Admin
2. Handshake com troca de informações de versão
3. Web-Admin valida identidade do Controller
4. Sincronização inicial (full sync)

```typescript
// Handshake Request (Controller → Web-Admin)
interface HandshakeRequest {
  controllerId: string;
  siteId: string;
  version: string;
  capabilities: string[];
  lastSync?: string;
}

// Handshake Response (Web-Admin → Controller)  
interface HandshakeResponse {
  accepted: boolean;
  serverTime: string;
  syncRequired: boolean;
  syncType: 'full' | 'incremental';
  config: ControllerConfig;
}
```

### 2.2 Sincronização Contínua

#### Heartbeat Periódico (Padrão: 30s)
- Controller envia status para Web-Admin
- Web-Admin responde com ACK e comandos pendentes
- Detecção de desconexão se heartbeat não recebido

#### Sincronização de Dados (Padrão: 5min)
- Web-Admin envia updates incrementais
- Controller aplica changes e envia ACK
- Fallback para full sync se incremental falhar

### 2.3 Resolução de Conflitos

#### Timestamps
- Todas as mudanças incluem timestamp preciso
- Última modificação válida ganha ("last-writer-wins")
- Web-Admin tem precedência em caso de empate

#### Versionamento
- Cada objeto mantém número de versão
- Incremento automático a cada mudança
- Validação de versão antes de aplicar updates

## 3. Garantias de Entrega

### 3.1 Acknowledgments
```typescript
interface AckPayload {
  messageId: string;           // ID da mensagem original
  status: 'success' | 'error' | 'partial';
  timestamp: string;
  error?: string;
  details?: {
    processed: number;
    failed: number;
    errors: string[];
  };
}
```

### 3.2 Retry Logic

#### Exponential Backoff
- Tentativa inicial: imediata  
- Retry 1: 1 segundo
- Retry 2: 2 segundos
- Retry 3: 4 segundos
- Retry 4: 8 segundos
- Máximo: 30 segundos

#### Circuit Breaker
- Falha após 5 tentativas consecutivas
- Modo "half-open" após 2 minutos
- Teste de conectividade antes de reativar

### 3.3 Persistência

#### Message Queue (Controller)
```typescript
interface QueuedMessage {
  message: SyncMessage;
  attempts: number;
  nextRetry: Date;
  maxRetries: number;
  createdAt: Date;
}
```

#### Armazenamento Local
- Mensagens pendentes salvas em disco
- Recuperação automática após restart
- Limpeza de mensagens expiradas

## 4. Compressão e Otimização

### 4.1 Compressão de Payload

```typescript
interface CompressedPayload {
  compressed: boolean;
  algorithm: 'gzip' | 'deflate';
  originalSize: number;
  compressedSize: number;
  data: string;                // Base64 encoded
}
```

### 4.2 Delta Sync

```typescript
interface DeltaPayload {
  baseVersion: string;
  operations: Array<{
    op: 'add' | 'remove' | 'replace' | 'move';
    path: string;
    value?: any;
    from?: string;             // Para operação move
  }>;
  checksum: string;
}
```

## 5. Checksums e Integridade

### 5.1 Validação de Integridade

```typescript
interface ChecksumValidation {
  algorithm: 'md5' | 'sha256';
  payload: string;             // Hash do payload
  headers: string;             // Hash dos headers
  full: string;               // Hash da mensagem completa
}
```

### 5.2 Detecção de Corrupção

- Validação de checksum obrigatória
- Rejeição automática de mensagens corrompidas
- Solicitação de retransmissão
- Log de eventos de corrupção

## 6. Segurança e Autenticação

### 6.1 Headers de Segurança

```typescript
interface SecurityHeaders {
  apiKey?: string;            // Para autenticação simples
  signature?: string;         // HMAC do payload
  nonce?: string;            // Para prevenir replay attacks
  timestamp: string;         // Para validação de freshness
}
```

### 6.2 Rate Limiting

- Máximo 100 mensagens/minuto por controller
- Burst de até 10 mensagens instantâneas
- Throttling automático em caso de abuso

## 7. Monitoramento e Métricas

### 7.1 Métricas de Sincronização

```typescript
interface SyncMetrics {
  messagesPerMinute: number;
  averageLatency: number;
  successRate: number;
  errorRate: number;
  retryRate: number;
  queueSize: number;
  lastSync: string;
  bandwidth: {
    sent: number;            // bytes
    received: number;        // bytes
  };
}
```

### 7.2 Health Check

```typescript
interface SyncHealth {
  status: 'healthy' | 'warning' | 'critical';
  lastHeartbeat: string;
  consecutiveFailures: number;
  queueBacklog: number;
  avgResponseTime: number;
}
```

## 8. Implementação de Referência

### 8.1 Web-Admin Endpoint

```typescript
// POST /api/v1/sync/message
app.post('/api/v1/sync/message', async (req, res) => {
  const message: SyncMessage = req.body;
  
  // Validar checksum
  if (!validateChecksum(message)) {
    return res.status(400).json({ error: 'Invalid checksum' });
  }
  
  // Processar mensagem
  const result = await processSyncMessage(message);
  
  // Enviar ACK
  res.json({
    messageId: message.id,
    status: 'success',
    timestamp: new Date().toISOString(),
    data: result
  });
});
```

### 8.2 Controller Client

```typescript
class SyncClient {
  private messageQueue: QueuedMessage[] = [];
  private retryTimer: NodeJS.Timeout | null = null;
  
  async sendMessage(message: SyncMessage): Promise<void> {
    try {
      const response = await this.httpClient.post('/api/v1/sync/message', message);
      this.handleAck(response.data);
    } catch (error) {
      this.queueForRetry(message);
    }
  }
  
  private queueForRetry(message: SyncMessage): void {
    const queuedMessage: QueuedMessage = {
      message,
      attempts: 0,
      nextRetry: new Date(Date.now() + 1000),
      maxRetries: 5,
      createdAt: new Date()
    };
    
    this.messageQueue.push(queuedMessage);
    this.scheduleRetry();
  }
}
```

## 9. Configuração

### 9.1 Parâmetros Configuráveis

```typescript
interface SyncConfig {
  heartbeatInterval: number;      // 30000ms (30s)
  syncInterval: number;           // 300000ms (5min)  
  maxRetries: number;            // 5
  retryDelay: number;            // 1000ms
  maxQueueSize: number;          // 1000
  compressionThreshold: number;   // 1024 bytes
  checksumRequired: boolean;      // true
  enableDeltaSync: boolean;      // true
}
```

## 10. Testes e Validação

### 10.1 Cenários de Teste

1. **Conectividade Normal**: Sync bidirecional funcionando
2. **Perda de Rede**: Recuperação automática após reconexão
3. **Latência Alta**: Performance sob condições adversas
4. **Dados Corrompidos**: Detecção e recuperação
5. **Sobrecarga**: Rate limiting e throttling
6. **Conflitos**: Resolução de conflitos de dados

### 10.2 Métricas de Validação

- **Latência**: < 100ms para mensagens normais
- **Throughput**: > 50 mensagens/segundo
- **Confiabilidade**: 99.9% de entrega garantida
- **Recuperação**: < 30s para reconectar após falha

---

## Status de Implementação

- ✅ **Estrutura base**: Implementada no web-admin e controller
- ✅ **Heartbeat**: Funcional com retry automático
- ✅ **Comandos**: Execução remota implementada
- ✅ **Config sync**: Sincronização de configurações
- ✅ **Dashboard sync**: Distribuição de dashboards
- ✅ **Checksums**: Validação de integridade básica
- ⚠️ **Compressão**: Próxima implementação
- ⚠️ **Delta sync**: Próxima implementação
- ⚠️ **Criptografia**: Para fase de segurança

**Data**: 03/09/2025  
**Versão**: 1.0.0