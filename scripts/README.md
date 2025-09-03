# Scripts de Performance e Monitoramento

Este diretório contém scripts para medir, monitorar e analisar a performance do sistema DisplayOps atual.

## Scripts Disponíveis

### 1. `performance-baseline.js`
Mede o baseline de performance do sistema atual.

**Uso:**
```bash
# Executar baseline completo
node scripts/performance-baseline.js

# Com variáveis de ambiente
WEB_CONTROLLER_URL=http://localhost:3000 HOST_AGENT_URL=http://localhost:8080 node scripts/performance-baseline.js
```

**Testes realizados:**
- Latência de descoberta de hosts
- Latência de comandos gRPC
- Latência de health check
- Throughput (requisições simultâneas)
- Uso de recursos durante carga
- Teste de uptime por 30 segundos

**Saída:**
- Arquivo JSON em `data/performance/baseline-YYYY-MM-DDTHH-MM-SS.json`
- Resumo no console

### 2. `uptime-monitor.js`
Monitora continuamente o uptime do sistema.

**Uso:**
```bash
# Iniciar monitoramento
node scripts/uptime-monitor.js

# Gerar relatório de métricas existentes
node scripts/uptime-monitor.js --report

# Com configuração personalizada
CHECK_INTERVAL=60000 LOG_FILE=uptime.log node scripts/uptime-monitor.js
```

**Funcionalidades:**
- Verificação contínua de Web Controller e Host Agent
- Cálculo de uptime percentage
- Logs estruturados
- Relatórios por hora
- Métricas salvas em JSON

### 3. `resource-monitor.js`
Monitora uso de recursos do sistema.

**Uso:**
```bash
# Iniciar monitoramento
node scripts/resource-monitor.js

# Gerar relatório
node scripts/resource-monitor.js --report

# Com intervalo personalizado
MONITOR_INTERVAL=10000 node scripts/resource-monitor.js
```

**Métricas coletadas:**
- Uso de CPU (%)
- Uso de memória (%)
- Uso de disco (%)
- Estatísticas de rede
- Processos Node.js/Electron
- Uptime do sistema

### 4. `metrics-dashboard.js`
Dashboard web para visualizar métricas.

**Uso:**
```bash
# Iniciar dashboard
node scripts/metrics-dashboard.js

# Com porta personalizada
DASHBOARD_PORT=8082 node scripts/metrics-dashboard.js
```

**Funcionalidades:**
- Dashboard web em http://localhost:8081
- Visualização de performance, uptime e recursos
- Gráficos de histórico
- Auto-refresh a cada 30 segundos
- API JSON em `/api/metrics`

### 5. `health-check.js`
Health checks básicos do sistema.

**Uso:**
```bash
# Executar health checks
node scripts/health-check.js

# Com timeout personalizado
HEALTH_TIMEOUT=10000 node scripts/health-check.js
```

**Verificações:**
- Conectividade do Web Controller
- Conectividade do Host Agent
- APIs de descoberta e dashboards
- Arquivos de configuração
- Serviço mDNS
- Portas necessárias
- Recursos do sistema
- Processos ativos

## Configuração

### Variáveis de Ambiente

| Variável | Padrão | Descrição |
|----------|--------|-----------|
| `WEB_CONTROLLER_URL` | `http://localhost:3000` | URL do Web Controller |
| `HOST_AGENT_URL` | `http://localhost:8080` | URL do Host Agent |
| `CHECK_INTERVAL` | `30000` | Intervalo de verificação (ms) |
| `MONITOR_INTERVAL` | `5000` | Intervalo de monitoramento (ms) |
| `HEALTH_TIMEOUT` | `5000` | Timeout para health checks (ms) |
| `DASHBOARD_PORT` | `8081` | Porta do dashboard de métricas |
| `LOG_FILE` | `uptime-monitor.log` | Arquivo de log |
| `RESOURCE_LOG_FILE` | `resource-monitor.log` | Arquivo de log de recursos |
| `METRICS_FILE` | `uptime-metrics.json` | Arquivo de métricas |
| `RESOURCE_METRICS_FILE` | `resource-metrics.json` | Arquivo de métricas de recursos |
| `HEALTH_OUTPUT` | `health-check.json` | Arquivo de saída dos health checks |

### Arquivos de Saída

| Script | Arquivo de Saída | Descrição |
|--------|------------------|-----------|
| `performance-baseline.js` | `data/performance/baseline-*.json` | Resultados de performance |
| `uptime-monitor.js` | `uptime-metrics.json` | Métricas de uptime |
| `resource-monitor.js` | `resource-metrics.json` | Métricas de recursos |
| `health-check.js` | `health-check.json` | Resultados dos health checks |

## Exemplos de Uso

### Monitoramento Completo

```bash
# Terminal 1: Monitor de uptime
node scripts/uptime-monitor.js

# Terminal 2: Monitor de recursos
node scripts/resource-monitor.js

# Terminal 3: Dashboard de métricas
node scripts/metrics-dashboard.js
```

### Análise de Performance

```bash
# Executar baseline
node scripts/performance-baseline.js

# Verificar saúde do sistema
node scripts/health-check.js

# Gerar relatórios
node scripts/uptime-monitor.js --report
node scripts/resource-monitor.js --report
```

### Scripts de Automação

```bash
#!/bin/bash
# monitor-system.sh

echo "Iniciando monitoramento do sistema DisplayOps..."

# Iniciar monitores em background
node scripts/uptime-monitor.js > uptime.log 2>&1 &
node scripts/resource-monitor.js > resource.log 2>&1 &
node scripts/metrics-dashboard.js > dashboard.log 2>&1 &

echo "Monitores iniciados:"
echo "- Uptime: uptime.log"
echo "- Recursos: resource.log"
echo "- Dashboard: dashboard.log"
echo "- Dashboard web: http://localhost:8081"
```

## Interpretação dos Resultados

### Performance Baseline

- **Latência de Descoberta**: < 100ms (excelente), < 500ms (boa), > 1000ms (problema)
- **Latência de Comandos**: < 200ms (excelente), < 1000ms (boa), > 2000ms (problema)
- **Throughput**: > 50 req/s (excelente), > 20 req/s (boa), < 10 req/s (problema)

### Uptime

- **99.9%+**: Excelente
- **99.0-99.9%**: Bom
- **95.0-99.0%**: Aceitável
- **< 95.0%**: Problema

### Recursos

- **CPU**: < 50% (excelente), < 80% (boa), > 80% (problema)
- **Memória**: < 70% (excelente), < 85% (boa), > 85% (problema)
- **Disco**: < 80% (excelente), < 90% (boa), > 90% (problema)

### Health Checks

- **Healthy**: Todos os checks passaram
- **Warning**: Alguns checks falharam (não críticos)
- **Unhealthy**: Muitos checks críticos falharam

## Troubleshooting

### Problemas Comuns

**Script não executa:**
```bash
# Verificar Node.js
node --version

# Instalar dependências
npm install axios
```

**Erro de conectividade:**
```bash
# Verificar se os serviços estão rodando
curl http://localhost:3000/api/discovery/hosts
curl http://localhost:8080/api/health
```

**Permissões de arquivo:**
```bash
# Tornar scripts executáveis
chmod +x scripts/*.js
```

**Porta em uso:**
```bash
# Verificar portas em uso
netstat -tlnp | grep :8081

# Usar porta alternativa
DASHBOARD_PORT=8082 node scripts/metrics-dashboard.js
```

### Logs e Debug

```bash
# Ver logs em tempo real
tail -f uptime-monitor.log
tail -f resource-monitor.log

# Verificar métricas
cat uptime-metrics.json | jq '.summary'
cat resource-metrics.json | jq '.summary'
```

## Integração com CI/CD

### GitHub Actions

```yaml
name: Performance Tests
on: [push, pull_request]

jobs:
  performance:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      
      - run: npm install
      - run: npm start &
      - run: sleep 10
      - run: node scripts/performance-baseline.js
      - run: node scripts/health-check.js
      
      - name: Upload results
        uses: actions/upload-artifact@v2
        with:
          name: performance-results
          path: data/performance/
```

### Cron Job

```bash
# /etc/crontab
# Executar health checks a cada hora
0 * * * * cd /path/to/displayops && node scripts/health-check.js

# Executar baseline diário às 2h
0 2 * * * cd /path/to/displayops && node scripts/performance-baseline.js
```

## Contribuição

Para adicionar novos scripts ou modificar existentes:

1. Mantenha a estrutura de classes
2. Use variáveis de ambiente para configuração
3. Implemente tratamento de erros
4. Adicione documentação
5. Teste em diferentes ambientes

## Licença

Este projeto está sob a licença UNLICENSED.
