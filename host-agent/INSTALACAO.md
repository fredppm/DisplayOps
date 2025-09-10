# DisplayOps Host Agent - Guia de Instalação

## Visão Geral

O DisplayOps Host Agent é a aplicação que deve ser instalada nos mini PCs (hosts) para controle de displays. Este agente se comunica com o Controller e executa comandos de controle de display conforme configurado no sistema.

## Download

Faça o download do instalador mais recente na pasta `release/`:
- **Windows**: `DisplayOps Host Agent Setup 1.0.0.exe`

## Instalação

### Windows

1. Execute o arquivo `DisplayOps Host Agent Setup 1.0.0.exe`
2. Siga o assistente de instalação:
   - Escolha o diretório de instalação (padrão recomendado)
   - Marque as opções de atalho conforme desejado
3. O aplicativo será instalado e pode ser iniciado automaticamente

### Localização da Instalação

- **Windows**: `C:\Users\{usuario}\AppData\Local\Programs\DisplayOps Host Agent\`
- **Arquivos de configuração**: `%APPDATA%\displayops-host-agent\`

## Configuração

### Primeira Execução

1. Ao iniciar pela primeira vez, o Host Agent tentará se conectar ao Controller
2. Configure as informações de rede se necessário:
   - IP do Controller
   - Porta de comunicação (padrão: 50051)
3. O agente aparecerá na bandeja do sistema

### Configurações Avançadas

#### Arquivo de Configuração
O arquivo `config.json` é criado automaticamente em:
- Windows: `%APPDATA%\displayops-host-agent\config.json`

Exemplo de configuração:
```json
{
  "controller": {
    "host": "192.168.1.100",
    "port": 50051
  },
  "display": {
    "autoDetect": true,
    "preferredDisplay": 0
  },
  "logging": {
    "level": "info",
    "enableFileLogging": true
  }
}
```

#### Variáveis de Ambiente

Você pode configurar o Host Agent através de variáveis de ambiente:

- `DISPLAYOPS_CONTROLLER_HOST`: IP do Controller
- `DISPLAYOPS_CONTROLLER_PORT`: Porta do Controller
- `DISPLAYOPS_LOG_LEVEL`: Nível de log (debug, info, warn, error)

### Auto-Inicialização

O Host Agent é configurado para iniciar automaticamente com o sistema. Para desabilitar:

1. **Windows**: 
   - Abra o Gerenciador de Tarefas
   - Vá para a aba "Inicializar"
   - Desabilite "DisplayOps Host Agent"

## Status e Monitoramento

### Ícone da Bandeja

O Host Agent mostra seu status através do ícone na bandeja:
- 🟢 **Verde**: Conectado e funcionando
- 🟡 **Amarelo**: Aguardando conexão
- 🔴 **Vermelho**: Erro de conexão
- ⚪ **Cinza**: Inativo

### Logs

Os logs são salvos em:
- Windows: `%APPDATA%\displayops-host-agent\logs\`

Níveis de log disponíveis:
- **debug**: Informações detalhadas para desenvolvimento
- **info**: Informações gerais de operação
- **warn**: Avisos não críticos
- **error**: Apenas erros

## Solução de Problemas

### Problemas Comuns

#### Não consegue conectar ao Controller
1. Verifique se o Controller está em execução
2. Confirme o IP e porta do Controller
3. Verifique se não há firewall bloqueando a conexão
4. Teste a conectividade de rede: `telnet [IP_DO_CONTROLLER] 50051`

#### Display não responde
1. Verifique se o display está ligado e conectado
2. Confirme as configurações de display no sistema operacional
3. Verifique os logs para mensagens de erro específicas

#### Aplicativo não inicia
1. Verifique se não há outra instância já em execução
2. Execute como administrador se necessário
3. Verifique os logs de sistema para erros

### Comandos de Diagnóstico

#### Verificar Status
```bash
# No diretório de instalação
./displayops-host-agent --status
```

#### Teste de Conexão
```bash
# Testar conexão com o Controller
./displayops-host-agent --test-connection [IP_CONTROLLER] [PORTA]
```

#### Reset de Configuração
```bash
# Resetar configurações para o padrão
./displayops-host-agent --reset-config
```

## Desinstalação

### Windows
1. Vá para "Configurações" > "Aplicativos"
2. Procure por "DisplayOps Host Agent"
3. Clique em "Desinstalar"

Ou use o Painel de Controle:
1. "Painel de Controle" > "Programas e Recursos"
2. Selecione "DisplayOps Host Agent"
3. Clique em "Desinstalar"

## Atualizações

O Host Agent suporta atualizações automáticas:

1. **Verificação automática**: Verifica atualizações na inicialização
2. **Download automático**: Baixa atualizações quando disponíveis
3. **Instalação**: Solicita permissão para instalar atualizações

### Atualização Manual

Para atualizar manualmente:
1. Faça download da nova versão
2. Execute o novo instalador
3. O instalador atualizará a versão existente

## Requisitos do Sistema

### Mínimos
- **SO**: Windows 10 ou superior
- **RAM**: 2GB
- **Armazenamento**: 500MB livres
- **Rede**: Conexão Ethernet ou Wi-Fi

### Recomendados
- **SO**: Windows 11
- **RAM**: 4GB ou mais
- **Armazenamento**: 1GB livres
- **Rede**: Conexão Ethernet estável

## Suporte

Para suporte técnico:
- Consulte os logs em `%APPDATA%\displayops-host-agent\logs\`
- Entre em contato com a equipe de TI com as informações dos logs
- Versão do software disponível no menu "Sobre"

---

**Versão do Documento**: 1.0.0  
**Data**: Setembro 2024  
**Aplicação**: DisplayOps Host Agent v1.0.0