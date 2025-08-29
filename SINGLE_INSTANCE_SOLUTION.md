# Solução para Instância Única do Electron

## Problema
O Electron estava permitindo múltiplas instâncias serem executadas simultaneamente, causando:
- Conflitos de porta (porta já em uso)
- Múltiplos processos rodando
- Comportamento inesperado da aplicação

## Solução Implementada

### 1. Verificação de Instância Única (File Lock)
- **Arquivo de Lock**: `office-tv-host-agent.lock` no diretório temporário do sistema
- **Verificação de PID**: Confirma se o processo do arquivo de lock ainda está rodando
- **Limpeza Automática**: Remove arquivos de lock obsoletos (processos que foram encerrados abruptamente)

### 2. Verificação de Porta Disponível
- **Teste de Conexão**: Tenta conectar na porta antes de iniciar o servidor
- **Timeout de 1 segundo**: Evita travamentos na verificação
- **Feedback Claro**: Mensagens informativas sobre o status da porta

### 3. Mecanismo de Saída Segura
- **Handlers de Sinal**: Captura SIGINT, SIGTERM, SIGQUIT
- **Limpeza Automática**: Remove arquivo de lock ao sair
- **Saída Limpa**: Processo sai sem deixar resíduos

## Como Funciona

```typescript
// 1. Verifica se já existe uma instância rodando
if (!ensureSingleInstance()) {
  console.log('Exiting duplicate instance...');
  app.quit();
  process.exit(0);
}

// 2. Verifica se a porta está disponível
const portAvailable = await ensurePortAvailable(port);
if (!portAvailable) {
  console.error(`Cannot start server - port ${port} is not available`);
  process.exit(1);
}
```

## Benefícios

✅ **Previne Múltiplas Instâncias**: Apenas uma instância pode rodar por vez
✅ **Evita Conflitos de Porta**: Verifica disponibilidade antes de iniciar
✅ **Limpeza Automática**: Remove arquivos de lock obsoletos
✅ **Feedback Claro**: Mensagens informativas para o usuário
✅ **Robustez**: Funciona mesmo com encerramento abrupto
✅ **Produção Segura**: Ideal para ambientes de produção

## Cenários de Uso

### Desenvolvimento
- Evita conflitos ao executar múltiplas vezes durante desenvolvimento
- Feedback claro sobre instâncias duplicadas

### Produção
- Garante que apenas uma instância do serviço esteja rodando
- Previne conflitos de porta em servidores
- Ideal para serviços que devem ser únicos

### Troubleshooting
- Mensagens claras sobre problemas de porta
- Identificação de processos duplicados
- Logs informativos para debugging

## Compatibilidade

- ✅ Windows
- ✅ macOS  
- ✅ Linux
- ✅ Electron 28+
- ✅ Node.js 18+

## Logs de Exemplo

```
✅ Single instance lock created (PID: 12345)
✅ Port 3000 is available
Host agent API server listening on port 3000
```

```
🚫 Another instance is already running (PID: 12345)
Focusing existing instance...
Exiting duplicate instance...
```

```
❌ Port 3000 is already in use!
This could mean another instance is running or another service is using the port.
Cannot start server - port 3000 is not available
```

