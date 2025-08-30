# Developer Tools Integration

## Overview

O sistema Office TV agora suporta ferramentas de desenvolvimento (dev tools) nas janelas de navegação do host agent quando não está executando em ambiente de produção.

## Funcionalidades

### Habilitação Automática
- As dev tools são automaticamente habilitadas quando `NODE_ENV` não está definido como `'production'`
- Em ambiente de desenvolvimento, todas as janelas de dashboard têm acesso às ferramentas de desenvolvedor

### Controles de Teclado
- **F12**: Alterna entre abrir/fechar as dev tools na janela ativa
- Funciona em todas as janelas de dashboard gerenciadas pelo WindowManager

### Segurança em Produção
- Em ambiente de produção (`NODE_ENV=production`), as dev tools são:
  - Desabilitadas na criação da janela
  - Automaticamente fechadas se abertas por algum motivo
  - Não respondem ao atalho F12

## Implementação Técnica

### WindowManager Modifications

```typescript
// webPreferences configuration
webPreferences: {
  nodeIntegration: false,
  contextIsolation: true,
  sandbox: true,
  webSecurity: true,
  preload: join(__dirname, '../preload/preload.js'),
  devTools: process.env.NODE_ENV !== 'production' // ✨ Nova configuração
}
```

### Kiosk Mode Configuration

```typescript
private configureKioskMode(window: BrowserWindow): void {
  if (process.env.NODE_ENV === 'production') {
    // Produção: Desabilita dev tools
    window.webContents.on('devtools-opened', () => {
      window.webContents.closeDevTools();
    });
  } else {
    // Desenvolvimento: Habilita F12
    window.webContents.on('before-input-event', (event, input) => {
      if (input.key === 'F12' && input.type === 'keyDown') {
        if (window.webContents.isDevToolsOpened()) {
          window.webContents.closeDevTools();
        } else {
          window.webContents.openDevTools();
        }
      }
    });
  }
}
```

## Como Usar

### Desenvolvimento Local

1. **Inicie o host agent em modo de desenvolvimento:**
   ```bash
   cd host-agent
   npm run dev
   ```

2. **Crie uma janela de dashboard através da interface web**

3. **Pressione F12 na janela do dashboard para abrir as dev tools**

### Teste Manual

Execute o script de teste incluído:
```bash
cd host-agent
node test-devtools.js
```

Este script:
- Cria uma janela de teste
- Verifica se as dev tools estão habilitadas
- Testa a funcionalidade do F12
- Fornece feedback no console

## Configuração de Ambiente

### Desenvolvimento
```bash
# .env ou variável de ambiente
NODE_ENV=development
```

### Produção
```bash
# .env ou variável de ambiente  
NODE_ENV=production
```

## Logs e Debugging

### Logs de Desenvolvimento
Quando uma janela é criada em modo de desenvolvimento, você verá:
```
Dev tools enabled for window dashboard-1. Press F12 to toggle.
```

### Eventos de Dev Tools
- `devtools-opened`: Disparado quando as dev tools são abertas
- `devtools-closed`: Disparado quando as dev tools são fechadas
- `before-input-event`: Captura o pressionamento de F12

## Benefícios

### Para Desenvolvedores
- **Debugging**: Inspecionar elementos, console, network, etc.
- **Performance**: Análise de performance das páginas de dashboard
- **Testing**: Testar JavaScript customizado nos dashboards

### Para Administradores
- **Troubleshooting**: Diagnosticar problemas de carregamento
- **Customização**: Testar modificações CSS/JS em tempo real
- **Monitoring**: Verificar requests de rede e erros

## Segurança

### Produção
- Dev tools completamente desabilitadas
- Não há overhead de performance
- Não há riscos de segurança

### Desenvolvimento
- Dev tools disponíveis apenas localmente
- Não afeta o comportamento normal do sistema
- Facilita debugging e desenvolvimento

## Troubleshooting

### Dev Tools Não Abrem
1. Verifique se `NODE_ENV` não está definido como `'production'`
2. Confirme que a janela está em foco ao pressionar F12
3. Verifique os logs do console para mensagens de erro

### F12 Não Funciona
1. Certifique-se de que a janela do dashboard está ativa
2. Verifique se não há outros aplicativos capturando F12
3. Tente clicar na janela antes de pressionar F12

### Performance em Desenvolvimento
- As dev tools podem consumir recursos adicionais
- Para melhor performance, mantenha as dev tools fechadas quando não estiver usando
- Em produção, não há impacto na performance

## Arquivos Modificados

- `host-agent/src/managers/window-manager.ts`: Implementação principal
- `README.md`: Documentação de configuração
- `host-agent/test-devtools.js`: Script de teste
- `DEVTOOLS_README.md`: Esta documentação
