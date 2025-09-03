# Guia de Troubleshooting - Sistema Atual

## Visão Geral
Este guia fornece soluções para problemas comuns do sistema DisplayOps, incluindo diagnóstico, resolução e prevenção.

## Índice Rápido

### Problemas de Descoberta
- [Host Agent não aparece na lista](#host-agent-não-aparece)
- [Descoberta mDNS falhando](#descoberta-mdns-falhando)
- [Hosts aparecem e desaparecem](#hosts-aparecem-e-desaparecem)

### Problemas de Comunicação
- [Erro de conexão gRPC](#erro-de-conexão-grpc)
- [Timeout em comandos](#timeout-em-comandos)
- [Comunicação intermitente](#comunicação-intermitente)

### Problemas de Display
- [Dashboard não carrega](#dashboard-não-carrega)
- [Erro de autenticação](#erro-de-autenticação)
- [Display em branco](#display-em-branco)

### Problemas de Performance
- [Sistema lento](#sistema-lento)
- [Alto uso de CPU/memória](#alto-uso-de-recursos)
- [Comandos demoram](#comandos-demoram)

## Diagnóstico Inicial

### 1. Verificar Status dos Serviços

#### Web Controller
```bash
# Verificar se está rodando
curl http://localhost:3000/api/discovery/hosts

# Verificar logs
tail -f web-controller/logs/app.log
```

#### Host Agent
```bash
# Verificar se está rodando
curl http://localhost:8080/api/health

# Verificar logs
tail -f host-agent/logs/host-agent.log
```

### 2. Verificar Conectividade de Rede

```bash
# Testar conectividade entre controller e host
ping [IP_DO_HOST]

# Testar porta gRPC
telnet [IP_DO_HOST] 8082

# Testar porta HTTP
telnet [IP_DO_HOST] 8080
```

### 3. Verificar Configurações

```bash
# Verificar configuração do host agent
cat host-agent/data/config.json

# Verificar dashboards configurados
cat web-controller/data/dashboards.json
```

## Problemas Específicos

### Host Agent não aparece na lista

#### Sintomas
- Host agent está rodando mas não aparece no web controller
- Lista de hosts vazia ou incompleta

#### Diagnóstico
```bash
# 1. Verificar se o host agent está anunciando mDNS
dns-sd -B _displayops._tcp.local

# 2. Verificar logs do host agent
grep "mDNS" host-agent/logs/host-agent.log

# 3. Verificar firewall
sudo ufw status
```

#### Soluções

**Problema: Firewall bloqueando mDNS**
```bash
# Permitir mDNS (porta 5353)
sudo ufw allow 5353/udp

# Permitir gRPC (porta 8082)
sudo ufw allow 8082/tcp
```

**Problema: Serviço mDNS não iniciou**
```bash
# Reiniciar host agent
cd host-agent
npm restart

# Verificar se o serviço está anunciando
dns-sd -L "Display-001" _displayops._tcp.local
```

**Problema: Configuração incorreta**
```json
// Verificar host-agent/data/config.json
{
  "hostId": "host-001",
  "name": "Display-001",
  "mdnsService": "_displayops._tcp.local",
  "mdnsPort": 5353,
  "grpcPort": 8082
}
```

### Descoberta mDNS falhando

#### Sintomas
- Hosts não são descobertos automaticamente
- Erro "mDNS discovery failed" nos logs

#### Diagnóstico
```bash
# Verificar se o mDNS está funcionando
dns-sd -B _displayops._tcp.local

# Verificar logs do web controller
grep "mDNS" web-controller/logs/app.log

# Testar com ferramenta específica
nslookup _displayops._tcp.local
```

#### Soluções

**Problema: Bonjour/Avahi não instalado**
```bash
# Ubuntu/Debian
sudo apt-get install avahi-daemon

# macOS (já vem instalado)
# Windows (instalar Bonjour)
```

**Problema: Rede não suporta multicast**
```bash
# Verificar se multicast está habilitado
ip route show | grep 224.0.0.0

# Se não estiver, configurar rota multicast
sudo ip route add 224.0.0.0/4 dev eth0
```

### Erro de conexão gRPC

#### Sintomas
- Erro "Failed to connect to host" no web controller
- Timeout em comandos
- Host aparece como offline

#### Diagnóstico
```bash
# Testar conectividade gRPC
grpcurl -plaintext [IP_DO_HOST]:8082 list

# Verificar se a porta está aberta
netstat -tlnp | grep 8082

# Verificar logs do host agent
grep "gRPC" host-agent/logs/host-agent.log
```

#### Soluções

**Problema: Porta 8082 não está aberta**
```bash
# Verificar se o host agent está rodando
ps aux | grep host-agent

# Reiniciar host agent
cd host-agent && npm restart
```

**Problema: Firewall bloqueando**
```bash
# Permitir porta 8082
sudo ufw allow 8082/tcp

# Verificar regras
sudo ufw status numbered
```

**Problema: Configuração de rede incorreta**
```json
// Verificar web-controller/src/lib/grpc-client.ts
{
  "host": "192.168.1.100",
  "port": 8082,
  "timeout": 5000
}
```

### Dashboard não carrega

#### Sintomas
- Comando enviado mas dashboard não aparece
- Erro "Failed to load dashboard"
- Display em branco

#### Diagnóstico
```bash
# Verificar logs do host agent
grep "dashboard" host-agent/logs/host-agent.log

# Verificar se o browser abriu
ps aux | grep electron

# Testar URL diretamente
curl -I [URL_DO_DASHBOARD]
```

#### Soluções

**Problema: URL inválida**
```json
// Verificar dashboards.json
{
  "urls": [
    "https://example.com/dashboard" // URL deve ser válida
  ]
}
```

**Problema: Erro de autenticação**
```bash
# Verificar se os cookies estão sincronizados
curl http://localhost:8080/api/cookies/status

# Re-sincronizar cookies via extensão
# 1. Fazer login no dashboard
# 2. Verificar se a extensão detectou
# 3. Sincronizar com host agent
```

**Problema: Browser travado**
```bash
# Matar processos do Electron
pkill -f electron

# Reiniciar host agent
cd host-agent && npm restart
```

### Erro de autenticação

#### Sintomas
- Dashboard carrega mas mostra erro de login
- Cookies não estão sendo aplicados
- Sessão expirada

#### Diagnóstico
```bash
# Verificar cookies armazenados
curl http://localhost:8080/api/cookies

# Verificar logs da extensão
# Abrir DevTools da extensão e verificar logs

# Testar cookies manualmente
curl -b "session=abc123" [URL_DO_DASHBOARD]
```

#### Soluções

**Problema: Cookies não sincronizados**
```javascript
// 1. Verificar se a extensão está ativa
// 2. Fazer login no dashboard
// 3. Verificar se os cookies foram detectados
// 4. Sincronizar com host agent
```

**Problema: Cookies expirados**
```bash
# Limpar cookies antigos
curl -X DELETE http://localhost:8080/api/cookies/expired

# Re-sincronizar cookies
# Fazer login novamente no dashboard
```

**Problema: Domínio incorreto**
```json
// Verificar se o domínio dos cookies está correto
{
  "cookies": [
    {
      "name": "session",
      "domain": ".example.com", // Deve corresponder ao dashboard
      "value": "abc123"
    }
  ]
}
```

### Sistema lento

#### Sintomas
- Comandos demoram para executar
- Interface web lenta
- Alto uso de CPU/memória

#### Diagnóstico
```bash
# Verificar uso de recursos
top
htop

# Verificar logs de performance
grep "performance" web-controller/logs/app.log
grep "performance" host-agent/logs/host-agent.log

# Verificar conexões ativas
netstat -an | grep :8082
```

#### Soluções

**Problema: Muitas conexões gRPC abertas**
```javascript
// Implementar connection pooling
// Verificar web-controller/src/lib/grpc-client.ts
```

**Problema: Logs muito grandes**
```bash
# Limpar logs antigos
find . -name "*.log" -mtime +7 -delete

# Configurar rotação de logs
# Verificar logrotate ou similar
```

**Problema: Muitos dashboards ativos**
```json
// Reduzir número de dashboards simultâneos
// Verificar dashboards.json
```

## Logs e Debugging

### Logs Importantes

#### Web Controller
```bash
# Logs principais
tail -f web-controller/logs/app.log

# Logs de erro
tail -f web-controller/logs/error.log

# Logs de acesso
tail -f web-controller/logs/access.log
```

#### Host Agent
```bash
# Logs principais
tail -f host-agent/logs/host-agent.log

# Logs de debug
tail -f host-agent/logs/debug.log

# Logs do Electron
tail -f host-agent/logs/electron.log
```

### Comandos de Debug

```bash
# Verificar status geral do sistema
curl http://localhost:3000/api/health

# Verificar hosts descobertos
curl http://localhost:3000/api/discovery/hosts

# Verificar dashboards configurados
curl http://localhost:3000/api/dashboards

# Verificar status do host agent
curl http://localhost:8080/api/health
```

### Ferramentas de Diagnóstico

```bash
# Monitorar rede
sudo tcpdump -i any port 8082

# Monitorar mDNS
dns-sd -B _displayops._tcp.local

# Monitorar processos
ps aux | grep -E "(host-agent|web-controller|electron)"

# Monitorar portas
netstat -tlnp | grep -E "(3000|8080|8082)"
```

## Prevenção de Problemas

### Monitoramento Contínuo

```bash
# Script de monitoramento básico
#!/bin/bash
while true; do
    # Verificar web controller
    if ! curl -s http://localhost:3000/api/health > /dev/null; then
        echo "Web Controller down at $(date)"
        # Reiniciar web controller
    fi
    
    # Verificar host agent
    if ! curl -s http://localhost:8080/api/health > /dev/null; then
        echo "Host Agent down at $(date)"
        # Reiniciar host agent
    fi
    
    sleep 30
done
```

### Backup de Configurações

```bash
# Backup automático das configurações
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
tar -czf "backup_${DATE}.tar.gz" \
    web-controller/data/ \
    host-agent/data/ \
    web-controller/logs/ \
    host-agent/logs/
```

### Limpeza Automática

```bash
# Limpar logs antigos
find . -name "*.log" -mtime +7 -delete

# Limpar backups antigos
find . -name "backup_*.tar.gz" -mtime +30 -delete
```

## Contatos de Emergência

### Escalação de Problemas

1. **Problema Crítico**: Sistema completamente inoperante
   - Contato: [EMAIL_EMERGENCIA]
   - Tempo de resposta: 1 hora

2. **Problema Grave**: Funcionalidade principal afetada
   - Contato: [EMAIL_SUPORTE]
   - Tempo de resposta: 4 horas

3. **Problema Moderado**: Funcionalidade secundária afetada
   - Contato: [EMAIL_SUPORTE]
   - Tempo de resposta: 24 horas

### Recursos Adicionais

- **Documentação**: `/docs/`
- **Logs**: `/logs/`
- **Configurações**: `/data/`
- **Backups**: `/backups/`

## Checklist de Troubleshooting

### Antes de Contatar Suporte

- [ ] Verificou os logs de erro?
- [ ] Testou conectividade de rede?
- [ ] Reiniciou os serviços?
- [ ] Verificou configurações?
- [ ] Testou com configuração mínima?
- [ ] Documentou os passos realizados?

### Informações para Suporte

- Versão do sistema
- Logs de erro
- Configurações atuais
- Passos para reproduzir o problema
- Ambiente (OS, rede, etc.)
- Últimas mudanças realizadas
