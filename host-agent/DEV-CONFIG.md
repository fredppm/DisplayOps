# Configuração de Desenvolvimento - Host Agent

## Problema: Host Agent Conectando ao Servidor Errado

Por padrão, o Host Agent tenta se conectar ao servidor de produção (`https://displayops.vtex.com`). Para desenvolvimento local, você precisa configurar a variável de ambiente `WEB_ADMIN_URL`.

## Solução Rápida

### Para desenvolvimento local (localhost):

O script `npm run dev` já está configurado automaticamente para usar `http://localhost:3000`.

Apenas rode:
```bash
cd host-agent
npm run dev
```

### Para conectar a um servidor diferente:

#### Windows:
```powershell
# PowerShell
$env:WEB_ADMIN_URL="http://localhost:3000"
npm start

# CMD
set WEB_ADMIN_URL=http://localhost:3000
npm start
```

#### Linux/Mac:
```bash
export WEB_ADMIN_URL=http://localhost:3000
npm start
```

## Variáveis de Ambiente Disponíveis

- **`WEB_ADMIN_URL`** - URL do servidor web-admin
  - Desenvolvimento: `http://localhost:3000`
  - Produção: `https://displayops.vtex.com`

- **`DISPLAYOPS_WEB_ADMIN_URL`** - Nome alternativo para a mesma variável

- **`NODE_ENV`** - Ambiente de execução
  - `development` - Modo desenvolvimento (logs verbosos, hot reload)
  - `production` - Modo produção

## Verificando a Conexão

Quando o Host Agent iniciar, você verá no log:

```
🌐 HttpClientService initialized {
  webAdminUrl: 'http://localhost:3000',
  agentId: 'agent-xxx-xxx'
}
```

Se estiver conectando ao servidor errado, o `webAdminUrl` mostrará a URL incorreta.

## Troubleshooting

### Sintoma: Comandos dando timeout (30s)
**Causa**: Host Agent está conectado ao servidor de produção ao invés do localhost.

**Solução**: Configure `WEB_ADMIN_URL=http://localhost:3000` antes de rodar o agent.

### Sintoma: Host não aparece na lista do web-admin
**Causa**: Agent está conectado a um servidor diferente.

**Solução**: 
1. Verifique os logs do agent para ver qual `webAdminUrl` está sendo usado
2. Configure a variável de ambiente correta
3. Reinicie o agent

### Sintoma: "Authentication failed when polling commands"
**Causa**: O servidor está rejeitando as requisições do agent.

**Solução**: Verifique se o `agentId` é válido e começa com `agent-`.

## Scripts Disponíveis

- `npm run dev` - Desenvolvimento local (já configurado para localhost)
- `npm start` - Inicia o agent (usa variáveis de ambiente ou default produção)
- `npm run start:prod` - Build e inicia em modo produção
- `npm run build` - Compila TypeScript

## Configuração Permanente (Opcional)

Se você quiser configurar permanentemente, crie um arquivo `.env` na raiz do `host-agent`:

```env
# .env
WEB_ADMIN_URL=http://localhost:3000
NODE_ENV=development
```

**Nota**: O arquivo `.env` não é versionado no git por questões de segurança.

