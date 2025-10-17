# 🔄 Migrar Socket.IO → HTTP Polling (Para Vercel)

## ⚠️ ATENÇÃO
Esta migração requer:
- ✏️ Mudanças no host-agent (Socket.IO → HTTP)
- ✏️ Mudanças no web-admin (componentes React)
- ⏱️ Tempo estimado: 2-3 horas
- 📊 Latência maior (não é real-time, mas funcional)

## Resumo das mudanças

### Web-Admin (servidor)
1. ✅ SSE já implementado em `/api/hosts/events`
2. ❌ Remover `/api/websocket.ts`
3. ✅ Criar endpoints HTTP para receber dados dos hosts

### Host-Agent (cliente)
1. ❌ Remover Socket.IO
2. ✅ Implementar HTTP polling para heartbeat
3. ✅ Implementar HTTP POST para enviar métricas/logs

### Web-Admin (React)
1. ❌ Remover `io()` dos componentes
2. ✅ Usar `EventSource` (SSE) para receber updates
3. ✅ Usar HTTP polling se necessário

## Arquitetura

### Antes (Socket.IO - NÃO FUNCIONA NA VERCEL)
```
Host Agent → Socket.IO → Web-Admin → Socket.IO → React
```

### Depois (HTTP + SSE - FUNCIONA NA VERCEL)
```
Host Agent → HTTP POST → Web-Admin API → SSE → React
            ← HTTP GET ← (comandos)
```

## Se você quiser esta solução, me avise e eu implemento!

**MAS EU RECOMENDO FORTEMENTE:**
👉 **Use Railway/Render** - é MUITO mais fácil e funciona agora!

