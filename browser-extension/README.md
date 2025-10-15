# 🔐 Office Display Credentials Sync Extension

> **Extensão de navegador que automatiza a captura e sincronização de credenciais de autenticação para sistemas Office Display**

Elimina a necessidade de extrair cookies manualmente via DevTools, automatizando todo o processo de sincronização de credenciais para múltiplos displays.

---

## 🎯 **FUNCIONALIDADES**

### ✅ **Core Features**
- 🔍 **Auto-detecção** de dashboards conhecidos (Grafana, Tableau, Sentry, etc.)
- 🍪 **Captura automática** de credenciais após login
- 🚀 **Sincronização one-click** com DisplayOps Admin
- 🔧 **Auto-configuração** do endpoint (localhost:3000)
- 🔔 **Indicadores visuais** no ícone da extensão (sem notificações invasivas)
- 📊 **Status em tempo real** dos domínios monitorados

### 🎨 **Estados Visuais da Extensão**
- 🔴 **Cinza**: Nenhuma credencial detectada
- 🟡 **Amarelo**: Credenciais prontas para sync
- 🟢 **Verde**: Sincronizado recentemente  
- 🔴 **Vermelho**: Erro na sincronização

---

## 📦 **INSTALAÇÃO**

### **1. Preparar Extensão**
```bash
# No diretório do projeto Office Display
cd office-display-extension

# Instalar dependências para gerar ícones (opcional)
pip install Pillow

# Gerar ícones (se necessário)
python icons/create-icons.py
```

### **2. Instalar no Chrome/Edge**
1. **Abra Chrome/Edge**
2. **Vá para** `chrome://extensions/` (ou `edge://extensions/`)
3. **Ative "Modo do desenvolvedor"** (canto superior direito)
4. **Clique "Carregar sem compactação"**
5. **Selecione pasta** `office-display-extension`
6. **✅ Extensão instalada!**

### **3. Configuração Inicial**
A extensão se auto-configura automaticamente:
- 🔍 **Detecta Office Display** em `localhost:3000`
- ⚙️ **Configuração editável** se necessário
- 🔗 **Testa conexão** automaticamente

---

## 🚀 **COMO USAR**

### **Fluxo Típico:**
```
1. 🌐 Navegue para dashboard (ex: grafana.company.com)
2. 🔐 Faça login normalmente  
3. 🟡 Ícone da extensão fica amarelo (credenciais prontas)
4. 📱 Clique no ícone da extensão
5. 🚀 Clique "Sync Credenciais"
6. ✅ Todas as displays ficam logadas automaticamente!
7. 🟢 Ícone fica verde (sincronizado)
```

### **Interface da Extensão:**
```
📱 [Popup da Extensão]
┌─────────────────────────────────┐
│ 🔐 Office Display Sync          │
├─────────────────────────────────┤
│ 🟢 Conectado: localhost:3000    │
│                                 │
│ 📍 Domínio Atual                │
│ grafana.company.com             │
│ 🟡 Credenciais prontas          │
│ [🚀 Sync Credenciais]           │
│                                 │
│ 📊 Domínios Monitorados:        │
│ 🟢 grafana.company.com (2m)     │
│ 🟢 tableau.company.com (5m)     │
│ 🔴 sentry.io (expirado)         │
│                                 │
│ ⚙️ Office Display: localhost:3000│
│ [Test] [Salvar]                 │
└─────────────────────────────────┘
```

---

## 🔧 **CONFIGURAÇÃO AVANÇADA**

### **Domínios Suportados Automaticamente:**
- 🔶 **Grafana**: `grafana.*`
- 📊 **Tableau**: `tableau.*` 
- 🏥 **Health Monitor**: `healthmonitor.*`
- 📈 **Generic Dashboard**: `dashboard.*`
- 📊 **Monitoring**: `monitoring.*`, `metrics.*`
- 🐛 **Kibana**: `kibana.*`
- 🚨 **Sentry**: `sentry.*`
- 🐕 **DataDog**: `datadog.*`

### **Endpoint Office Display:**
```javascript
// Auto-detecta nesta ordem:
const DEFAULT_ENDPOINTS = [
  'http://localhost:3000',
  'http://localhost:3002', 
  'http://127.0.0.1:3000'
];
```

### **Configuração Manual:**
1. **Clique no ícone da extensão**
2. **Seção "⚙️ Configuração"**
3. **Digite endpoint**: `http://localhost:3000`
4. **Clique "Test"** para validar
5. **Clique "Salvar"**

---

## 🔍 **DETECÇÃO DE LOGIN**

A extensão detecta login automaticamente usando:

### **🌐 Padrões de URL:**
- `/dashboard`, `/home`, `/main`, `/overview`, `/app`

### **🎯 Elementos DOM:**
- Menus de usuário, sidebars, navigation
- Botões de logout (indica que está logado)
- Elementos específicos do Grafana, Tableau, etc.

### **📝 Conteúdo Textual:**
- "welcome", "dashboard", "logout", "profile"

### **🍪 Cookies de Autenticação:**
- Filtros para cookies relevantes (session, auth, token, jwt, etc.)
- Ignora cookies muito pequenos (< 10 chars)
- Prioriza cookies longos (> 50 chars)

---

## 🔗 **INTEGRAÇÃO COM OFFICE DISPLAY**

### **API Utilizada:**
```javascript
POST /api/cookies/import
{
  "domain": "https://grafana.company.com",
  "cookies": "session_id=abc123\nauth_token=xyz789...",
  "timestamp": "2025-01-01T12:00:00.000Z"
}
```

### **Status API:**
```javascript
GET /api/cookies/status
// Verifica se Office Display está online
```

### **Formato de Credenciais:**
```
# Formato enviado para API:
session_id=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
auth_token=MTIzNDU2Nzg5MC4xMjM0NTY3ODkw...
grafana_sess=abcd1234567890xyz...
```

---

## 🐛 **TROUBLESHOOTING**

### **❌ Extensão não detecta login:**
- ✅ Verifique se o domínio está na lista suportada
- ✅ Aguarde 2-5 segundos após login para detecção
- ✅ Certifique-se que login foi bem-sucedido (não há redirecionamento para tela de erro)

### **❌ Sync falha:**
- ✅ Verifique se Office Display está rodando (`localhost:3000`)
- ✅ Teste conexão na configuração da extensão
- ✅ Confirme que há credenciais válidas no domínio atual

### **❌ Ícone sempre cinza:**
- ✅ Navegue para um domínio de dashboard suportado
- ✅ Faça login completo no dashboard  
- ✅ Aguarde alguns segundos para detecção automática

### **❌ Office Display não responde:**
```bash
# Verificar se Office Display está rodando:
curl http://localhost:3000/api/cookies/status

# Iniciar Office Display se necessário:
cd web-admin && npm run dev
```

---

## 🔒 **SEGURANÇA E PRIVACIDADE**

### **✅ Dados Locais:**
- 🔐 **Credenciais não são armazenadas** permanentemente na extensão
- 📊 **Apenas metadados** são salvos (domínio, timestamp, contadores)
- 🌐 **Comunicação local** apenas com Office Display (localhost)

### **✅ Permissões Mínimas:**
- 🍪 `cookies`: Apenas para leitura de credenciais de autenticação
- 📱 `activeTab`: Apenas da aba atual quando extensão é usada
- 💾 `storage`: Configurações locais da extensão

### **✅ Sem Telemetria:**
- ❌ **Não envia dados** para servidores externos
- ❌ **Não coleta informações** pessoais
- ✅ **100% local** entre navegador e Office Display

---

## 📁 **ESTRUTURA DO PROJETO**

```
office-display-extension/
├── manifest.json              # Manifest V3 da extensão
├── background.js              # Service Worker principal
├── content-script.js          # Script de detecção de login
├── popup/
│   ├── popup.html            # Interface da extensão
│   ├── popup.css             # Estilos da interface
│   └── popup.js              # Lógica da interface
├── icons/
│   ├── create-icons.py       # Script para gerar ícones
│   ├── icon-idle-*.png       # Ícones estado inativo
│   ├── icon-ready-*.png      # Ícones estado pronto
│   ├── icon-synced-*.png     # Ícones estado sincronizado
│   └── icon-error-*.png      # Ícones estado erro
└── README.md                 # Esta documentação
```

---

## 🎯 **RESULTADOS**

### **ANTES:** 😞
1. F12 → DevTools → Application → Cookies
2. Selecionar domínio → Copiar cookies
3. Abrir Office Display → Aba Cookies  
4. Colar cookies → Validar → Sync
5. **Total: ~2-3 minutos por dashboard**

### **DEPOIS:** 😍  
1. 🔐 Fazer login no dashboard normalmente
2. 🟡 Ver ícone amarelo (credenciais prontas)
3. 📱 Clicar na extensão → "Sync Credenciais"
4. ✅ Todas as displays logadas automaticamente!
5. **Total: ~10 segundos por dashboard**

### **🚀 Benefícios:**
- ⚡ **20x mais rápido** que processo manual
- 🔒 **Mais seguro** - não precisa abrir DevTools
- 🤖 **Automático** - detecta login sem intervenção  
- 📊 **Visibilidade** - status em tempo real
- 🔄 **Escalável** - funciona com múltiplos domínios simultaneamente

---

## 📞 **SUPORTE**

Para problemas ou sugestões:
1. **Verifique troubleshooting** acima
2. **Console do navegador**: F12 → Console (para logs da extensão)  
3. **Logs do Office Display**: Terminal onde roda `npm run dev`

---

**✅ EXTENSÃO OFFICE DISPLAY CREDENTIALS SYNC - PRONTA PARA USO!** 🚀🔐