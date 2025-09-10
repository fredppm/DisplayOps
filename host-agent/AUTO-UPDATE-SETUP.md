# DisplayOps Host Agent - Auto Update Setup

## Visão Geral

O DisplayOps Host Agent possui sistema de auto-update integrado usando `electron-updater` com GitHub Releases como fonte de distribuição. O processo inclui CI/CD automatizado via GitHub Actions.

## Arquitetura do Sistema de Updates

### 1. Componentes

- **Auto-Updater Service** (`src/auto-updater.ts`)
- **GitHub Actions Workflow** (`.github/workflows/release-host.yml`)
- **Update Server** (`https://displayops.vtex.com/api/updates/host`)
- **GitHub Releases** (distribuição de arquivos)

### 2. Fluxo de Updates

```
1. Código modificado → 2. Tag criada → 3. GitHub Actions → 4. Release gerada → 5. App verifica updates → 6. Download/Install
```

## Processo de Release

### Automático (Recomendado)

1. **Criar Tag de Release**
   ```bash
   git tag host-v1.0.1
   git push origin host-v1.0.1
   ```

2. **GitHub Actions será executado automaticamente**
   - Builds para Windows, macOS e Linux
   - Cria release no GitHub
   - Publica arquivos instaladores

### Manual (Alternativo)

1. **Via GitHub Interface**
   - Acesse: Actions → Release Host Agent
   - Click "Run workflow"
   - Informe a versão (ex: 1.0.1)

## Configuração do Update Server

### Variáveis de Ambiente

```bash
# URL do servidor de updates (padrão)
UPDATE_SERVER_URL=https://displayops.vtex.com/api/updates/host

# Canal de release (stable, beta, alpha)
RELEASE_CHANNEL=stable

# Ambiente (desabilita updates em desenvolvimento)
NODE_ENV=production
```

### Endpoints da API

```
GET  /api/updates/host/latest.yml        # Metadata da versão mais recente
GET  /api/updates/host/[version].exe     # Download do instalador Windows
GET  /api/updates/host/[version].dmg     # Download do instalador macOS
GET  /api/updates/host/[version].AppImage # Download do instalador Linux
```

## Configuração Electron-Updater

### package.json - Seção "build"

```json
{
  "build": {
    "publish": {
      "provider": "generic",
      "url": "https://displayops.vtex.com/api/updates/host"
    }
  }
}
```

### Auto-Updater Settings

```typescript
// src/auto-updater.ts
autoUpdater.setFeedURL({
  provider: 'generic',
  url: 'https://displayops.vtex.com/api/updates/host',
  useMultipleRangeRequest: false,
  channel: 'stable'
});

// Configurações de comportamento
autoUpdater.autoDownload = false;        // Perguntar antes de baixar
autoUpdater.autoInstallOnAppQuit = true; // Instalar ao fechar
```

## Verificação de Updates

### Automática

- **Startup**: Verifica updates 3 segundos após inicializar
- **Intervalo**: Pode ser configurado para verificar periodicamente

### Manual

- **System Tray**: Menu "Check for Updates"
- **Programática**: `autoUpdaterService.manualCheckForUpdates()`

## Interface do Usuário

### Notificações do Sistema

1. **Update Available**: Mostra versão disponível + botão de download
2. **Download Progress**: Progresso do download (pode ser melhorado com UI)
3. **Update Ready**: Update baixado + botão de reiniciar

### Dialogs

1. **Update Dialog**: Informações detalhadas + opções (Download/Release Notes/Later)
2. **Restart Dialog**: Confirmação para reiniciar e instalar

## Versionamento

### Formato de Versões

```
host-v[MAJOR].[MINOR].[PATCH]
```

Exemplos:
- `host-v1.0.0` - Release inicial
- `host-v1.0.1` - Bug fixes
- `host-v1.1.0` - Novas features
- `host-v2.0.0` - Breaking changes

### Estratégia de Tags

```bash
# Release de produção
git tag host-v1.0.1

# Pre-release (beta)
git tag host-v1.1.0-beta.1

# Release candidate
git tag host-v1.1.0-rc.1
```

## Troubleshooting

### Problemas Comuns

#### Update Check Failed
```javascript
// Erro: Network/SSL issues
Error: net::ERR_INTERNET_DISCONNECTED

// Solução: Verificar conectividade e certificados SSL
```

#### Permission Denied
```javascript
// Erro: Sem permissões para escrever
Error: EACCES: permission denied

// Solução: Executar como administrador ou verificar permissões
```

#### Invalid Signature
```javascript
// Erro: Assinatura inválida
Error: Could not verify signature

// Solução: Configurar code signing ou desabilitar verificação em dev
```

### Debug de Updates

#### Enable Logging
```typescript
// src/auto-updater.ts
import log from 'electron-log';

autoUpdater.logger = log;
log.transports.file.level = 'debug';
```

#### Manual Testing
```bash
# Testar update manually
cd host-agent
npm run dist:win

# Simular update server locally
npx http-server release -p 3000
```

### Verificar Update Server

```bash
# Verificar metadata
curl https://displayops.vtex.com/api/updates/host/latest.yml

# Verificar se arquivo existe
curl -I https://displayops.vtex.com/api/updates/host/DisplayOps-Host-Agent-Setup-1.0.1.exe
```

## Configuração de Produção

### 1. Code Signing

```yaml
# .github/workflows/release-host.yml
env:
  # Windows
  CSC_LINK: ${{ secrets.WINDOWS_CSC_LINK }}
  CSC_KEY_PASSWORD: ${{ secrets.WINDOWS_CSC_KEY_PASSWORD }}
  
  # macOS  
  APPLEID: ${{ secrets.APPLEID }}
  APPLEIDPASS: ${{ secrets.APPLEIDPASS }}
```

### 2. Auto-Update Server

O servidor de updates deve implementar:

```javascript
// Exemplo de endpoint latest.yml
app.get('/api/updates/host/latest.yml', (req, res) => {
  res.type('text/yaml');
  res.send(`
version: 1.0.1
files:
  - url: DisplayOps-Host-Agent-Setup-1.0.1.exe
    sha512: [hash]
    size: 123456789
path: DisplayOps-Host-Agent-Setup-1.0.1.exe
sha512: [hash]
releaseDate: '2024-09-10T10:00:00.000Z'
  `);
});
```

### 3. Monitoring

- **Update Success Rate**: Quantos updates foram aplicados com sucesso
- **Error Tracking**: Log de erros de update
- **Version Distribution**: Quais versões estão em uso

## Rollback Strategy

### Automatic Rollback

```typescript
// Em caso de falha crítica, pode implementar rollback automático
autoUpdater.on('update-downloaded', (info) => {
  // Verificar integridade antes de instalar
  if (!validateUpdate(info)) {
    autoUpdater.quitAndInstall = () => {
      console.log('Update failed validation, skipping install');
    };
  }
});
```

### Manual Rollback

1. **GitHub Releases**: Marcar release como "pre-release"
2. **Update Server**: Apontar latest.yml para versão anterior
3. **Force Update**: Forçar download de versão específica

## Checklist de Release

- [ ] Código testado e funcionando
- [ ] Versão atualizada em package.json
- [ ] Tag criada com formato correto (`host-v1.0.1`)
- [ ] GitHub Actions executou sem erros
- [ ] Release aparece no GitHub Releases
- [ ] Arquivos de instalação funcionam
- [ ] Auto-update detecta nova versão
- [ ] Download e instalação funcionam
- [ ] Rollback plan definido

---

**Versão do Documento**: 1.0.0  
**Data**: Setembro 2024  
**Aplicação**: DisplayOps Host Agent v1.0.0