# 🐛 Debug Overlay System - Office TV

Sistema de debug visual em tempo real para monitorar atividade do host agent.

## ✨ Funcionalidades

### **Debug Overlay Transparente**
- 🖥️ **Janela transparente** sempre no topo
- 📍 **Posicionável** nos cantos da tela
- ⚡ **Updates em tempo real** (1 segundo)
- 🔥 **Hotkey global**: `Ctrl+Shift+D` para toggle
- 📱 **Interface compacta** (320x400px)

### **Monitoramento em Tempo Real**
- 🌐 **API Requests**: Endpoint, método, duração
- 🔄 **mDNS Status**: Advertising, discovery
- 🖼️ **Window Events**: Criação, navegação, erros
- 📊 **System Metrics**: CPU, memória, uptime
- ❌ **Error Tracking**: Erros com stack traces

### **Dados Coletados**
```typescript
// Eventos de API
{
  "timestamp": "2025-01-XX 14:32:15",
  "type": "api_request", 
  "category": "API",
  "message": "POST /api/command",
  "data": { "body": {...} },
  "duration": 150
}

// Métricas do Sistema
{
  "cpu": 15,
  "memory": 45, 
  "uptime": 3600,
  "activeWindows": 2,
  "apiRequestsPerMinute": 12,
  "mdnsStatus": "active"
}
```

## 🚀 Como Usar

### **1. Ativar Debug Mode**

**Via Hotkey (Recomendado):**
```
Ctrl + Shift + D  # Toggle overlay visual
```

**Via API:**
```bash
# Ativar debug
curl -X POST http://localhost:8080/api/debug/enable

# Verificar status
curl http://localhost:8080/api/debug/status

# Obter eventos
curl http://localhost:8080/api/debug/events?limit=20
```

### **2. Interface do Overlay**

```
┌─ 🐛 Debug Monitor ─────────┐
│ 📌 📊 ─ ✕                  │ <- Controles
├────────────────────────────┤
│ 🟢 mDNS  🟢 API: 5/min    │ <- Status
│ Windows: 2  Uptime: 1h     │
├────────────────────────────┤
│ Events | Metrics | System  │ <- Abas
├────────────────────────────┤
│ ⚡ ÚLTIMOS EVENTOS:         │
│ [14:32] API - POST command │
│   └ OPEN_DASHBOARD → TV1   │
│ [14:31] Window - Created   │  
│ [14:30] mDNS - Service Up  │
│ [Clear] [Export JSON]      │
└────────────────────────────┘
```

### **3. Controles do Overlay**

- **📌 Pin**: Fixa o overlay (não some no blur)
- **─ Minimize**: Minimiza a janela
- **✕ Close**: Fecha o overlay
- **Clear**: Limpa eventos de debug
- **Export**: Salva eventos como JSON

## 🧪 Teste e Validação

### **Script de Teste Automatizado:**
```bash
# Teste completo do debug system
node scripts/test-debug-overlay.js
```

O script testa:
- ✅ Ativação/desativação do debug mode
- ✅ Coleta de eventos em tempo real
- ✅ APIs de debug (/api/debug/*)
- ✅ Métricas do sistema
- ✅ Limpeza de eventos

### **Teste Manual:**

1. **Inicie o host-agent:**
   ```bash
   cd host-agent
   npm run dev
   ```

2. **Ative o overlay:**
   ```
   Pressione: Ctrl + Shift + D
   ```

3. **Gere atividade:**
   ```bash
   # Faça algumas requisições para gerar eventos
   curl http://localhost:8080/health
   curl http://localhost:8080/api/status
   curl http://localhost:8080/api/windows
   ```

4. **Observe eventos em tempo real** no overlay

## 📊 Tipos de Eventos

| Tipo | Categoria | Descrição |
|------|-----------|-----------|
| `api_request` | API | Requisições recebidas |
| `api_response` | API | Respostas enviadas |
| `window_event` | Window | Janelas criadas/navegadas |
| `mdns_event` | mDNS | Service discovery |
| `system_event` | System | Eventos do sistema |
| `error` | Error | Erros com stack trace |

## 🎛️ APIs de Debug

### **Control Endpoints**
```bash
POST /api/debug/enable    # Ativa debug mode
POST /api/debug/disable   # Desativa debug mode
GET  /api/debug/status    # Status e métricas
```

### **Data Endpoints** 
```bash
GET    /api/debug/events?limit=20  # Últimos eventos
DELETE /api/debug/events           # Limpa eventos
```

### **Response Format**
```json
{
  "success": true,
  "data": {
    "enabled": true,
    "metrics": {
      "cpu": 15,
      "memory": 45,
      "apiRequestsPerMinute": 8,
      "activeWindows": 2,
      "mdnsStatus": "active"
    }
  },
  "timestamp": "2025-01-XX..."
}
```

## ⚙️ Configuração Avançada

### **Customizar Posição do Overlay**
```typescript
// Em host-agent/src/managers/debug-overlay-manager.ts
const config = {
  position: 'top-right',    // top-left, top-right, bottom-left, bottom-right
  opacity: 0.9,            // 0.1 - 1.0
  width: 320,              // pixels
  height: 400,             // pixels
  alwaysOnTop: true        // sempre no topo
}
```

### **Ajustar Limite de Eventos**
```typescript  
// Em host-agent/src/services/debug-service.ts
private maxEvents: number = 100;  // Máx eventos na memória
```

### **Customizar Hotkey**
```typescript
// Em host-agent/src/managers/debug-overlay-manager.ts
hotkey: 'CommandOrControl+Shift+D'  // Padrão
// Opções: 'F12', 'Alt+D', 'CommandOrControl+Alt+D'
```

## 🔧 Troubleshooting

### **Overlay não aparece**
1. Verifique se o Electron está rodando
2. Teste via API: `curl -X POST http://localhost:8080/api/debug/enable`
3. Verifique console do host-agent para erros

### **Hotkey não funciona**
1. Verifique se outro app usa a mesma combinação
2. Teste manual via API
3. Verifique logs do `globalShortcut`

### **Eventos não aparecem**
1. Debug mode está ativo? `GET /api/debug/status`
2. Faça requests para gerar eventos
3. Verifique se há erros no DebugService

### **Performance Impact**
- ⚡ **Baixo overhead**: ~1% CPU, ~5MB RAM
- 🔄 **Updates**: 1 segundo (configurável)
- 📊 **Eventos**: Máximo 100 na memória
- 🎯 **Produção**: Desativado por padrão

## 💡 Casos de Uso

### **Development & Debug**
- 🐛 Debugar APIs que não respondem
- 📊 Monitorar performance em tempo real
- 🔍 Identificar gargalos de requisições
- ❌ Acompanhar erros e exceptions

### **Production Monitoring** 
- 🚨 Ativar temporariamente em problemas
- 📈 Coletar métricas específicas
- 🔧 Diagnóstico remoto via APIs
- 📋 Export de logs para análise

### **Testing & QA**
- ✅ Verificar fluxos de comandos
- 🔄 Monitorar integrações mDNS
- 🖼️ Acompanhar ciclo de vida das janelas
- 📊 Coletar dados para relatórios

## 🎯 Próximos Passos

Implementado e funcionando! Para usar:

1. **Inicie o host-agent** com `npm run dev`
2. **Pressione `Ctrl+Shift+D`** para ativar o overlay
3. **Execute operações** para ver eventos em tempo real
4. **Use o script de teste** para validação automatizada

O debug overlay está pronto para uso em desenvolvimento e troubleshooting! 🎉
