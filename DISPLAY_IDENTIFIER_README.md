# 🖥️ Display Identifier System - Office TV

Sistema para identificar displays/monitores mostrando números grandes em cada tela, similar ao recurso do Windows.

## ✨ Funcionalidades

### **Identificação Visual de Displays**
- 🔢 **Números grandes** em cada monitor (1, 2, 3...)
- 🎨 **Customizável**: duração, tamanho, cor
- 📱 **Transparente** com animação pulsante
- 🖥️ **Multi-monitor** - funciona com qualquer quantidade
- ⚡ **Auto-fechamento** após tempo configurado

### **Interface Visual**
```
┌─────────────────────────┐
│                         │
│           1             │  <- Display 1
│      Display 1          │
│     1920 × 1080         │
│                         │
│ Will close in 3 seconds │
└─────────────────────────┘
```

### **Informações Mostradas**
- 🔢 **Número** do display (1, 2, 3...)
- 📊 **Resolução** (1920×1080, etc.)
- ⏱️ **Countdown** de fechamento
- ✨ **Animação** pulsante suave

## 🚀 Como Usar

### **1. Via API Direta (Recomendado)**

**Identificação Básica (5 segundos):**
```bash
curl -X POST http://localhost:8080/api/displays/identify \
     -H "Content-Type: application/json"
```

**Com Customizações:**
```bash
curl -X POST http://localhost:8080/api/displays/identify \
     -H "Content-Type: application/json" \
     -d '{
       "duration": 3,
       "fontSize": 250,
       "backgroundColor": "rgba(0, 100, 200, 0.9)"
     }'
```

### **2. Via Comando (Sistema Unificado)**

```bash
curl -X POST http://localhost:8080/api/command \
     -H "Content-Type: application/json" \
     -d '{
       "type": "identify_displays",
       "targetDisplay": "all", 
       "payload": {
         "duration": 4,
         "fontSize": 180
       },
       "timestamp": "'$(date -Iseconds)'"
     }'
```

### **3. Programaticamente**

**JavaScript/Node.js:**
```javascript
const axios = require('axios');

async function identifyDisplays() {
  try {
    const response = await axios.post('http://localhost:8080/api/displays/identify', {
      duration: 5,
      fontSize: 200,
      backgroundColor: 'rgba(0, 0, 0, 0.8)'
    });
    
    console.log('Displays identificados:', response.data.data.displays.length);
  } catch (error) {
    console.error('Erro:', error.message);
  }
}
```

## ⚙️ Configurações

### **Parâmetros Disponíveis**

| Parâmetro | Tipo | Padrão | Descrição |
|-----------|------|--------|-----------|
| `duration` | number | 5 | Duração em segundos (1-30) |
| `fontSize` | number | 200 | Tamanho da fonte em pixels (50-500) |
| `backgroundColor` | string | `rgba(0, 0, 0, 0.8)` | Cor de fundo CSS |

### **Exemplos de Cores**

```json
// Preto semi-transparente (padrão)
"backgroundColor": "rgba(0, 0, 0, 0.8)"

// Azul semi-transparente  
"backgroundColor": "rgba(0, 100, 200, 0.9)"

// Verde translúcido
"backgroundColor": "rgba(50, 200, 50, 0.7)"

// Vermelho sólido
"backgroundColor": "rgba(200, 50, 50, 1.0)"

// Completamente transparente (só texto)
"backgroundColor": "rgba(0, 0, 0, 0.1)"
```

## 📊 API Response

### **Success Response**
```json
{
  "success": true,
  "data": {
    "message": "Identifying 2 displays for 5 seconds",
    "displays": [
      {
        "displayId": 1,
        "bounds": {
          "x": 0,
          "y": 0, 
          "width": 1920,
          "height": 1080
        }
      },
      {
        "displayId": 2,
        "bounds": {
          "x": 1920,
          "y": 0,
          "width": 1680,
          "height": 1050
        }
      }
    ],
    "options": {
      "duration": 5,
      "fontSize": 200,
      "backgroundColor": "rgba(0, 0, 0, 0.8)"
    }
  },
  "timestamp": "2025-01-XX..."
}
```

### **Error Response**
```json
{
  "success": false,
  "error": "Display identifier service not available",
  "timestamp": "2025-01-XX..."
}
```

## 🧪 Teste e Validação

### **Script de Teste Automatizado:**
```bash
# Teste completo do display identifier
node scripts/test-display-identifier.js
```

O script testa:
- ✅ Detecção de displays
- ✅ Identificação via API direta
- ✅ Identificação via comando  
- ✅ Customizações de cor/tamanho
- ✅ Múltiplas configurações

### **Teste Manual Rápido:**

1. **Inicie o host-agent:**
   ```bash
   cd host-agent
   npm run dev
   ```

2. **Execute identificação:**
   ```bash
   curl -X POST http://localhost:8080/api/displays/identify
   ```

3. **Observe números em cada monitor** por 5 segundos

## 🎯 Casos de Uso

### **Setup e Configuração**
- 🖥️ **Configurar office TV** - identificar qual TV é qual
- 🔧 **Diagnosticar displays** - verificar se todos estão ativos
- 📊 **Mapear layout** - entender posicionamento físico
- 🎛️ **Testar multi-monitor** - validar configuração

### **Troubleshooting**
- 🐛 **Debug problemas de display** - qual monitor não funciona
- 📍 **Verificar posicionamento** - displays em ordem errada
- 🔍 **Identificar resolução** - conferir specs dos monitores
- ⚡ **Teste rápido** - todos os displays respondem?

### **Integração com Office TV**
- 📺 **Dashboard deployment** - saber qual TV recebe qual conteúdo
- 🔄 **Rotação de conteúdo** - programar displays específicos  
- 📊 **Monitoramento** - verificar saúde dos displays
- 🎯 **Targeting preciso** - comandos para displays específicos

## 🔧 Funcionamento Interno

### **Fluxo de Execução**
```
1. API recebe comando → DisplayIdentifier
2. Electron.screen.getAllDisplays() → Lista displays
3. Para cada display:
   - Cria BrowserWindow transparente
   - Posiciona na tela específica
   - Carrega HTML com número grande
4. Auto-fecha após duração configurada
```

### **Arquitetura**
```typescript
DisplayIdentifier
├── identifyDisplays() - Método principal
├── createIdentifierWindow() - Cria janela por display  
├── generateIdentifierHTML() - Gera HTML personalizado
├── closeIdentifierWindows() - Limpa recursos
└── getDisplayInfo() - Retorna info dos displays
```

### **Recursos Técnicos**
- **Electron BrowserWindow** - Janelas transparentes
- **screen.getAllDisplays()** - Detecção automática
- **CSS Animation** - Efeito pulsante
- **Auto-positioning** - Cada janela na tela correta
- **Resource cleanup** - Fecha automaticamente

## 🎨 Customização Avançada

### **Estilos Personalizados**
Edite `host-agent/src/services/display-identifier.ts` para:

```typescript
// Cores temáticas
const themes = {
  office: 'rgba(0, 100, 200, 0.9)',     // Azul corporativo
  alert: 'rgba(200, 50, 50, 0.9)',      // Vermelho alerta
  success: 'rgba(50, 200, 50, 0.8)',    // Verde sucesso
  minimal: 'rgba(0, 0, 0, 0.1)'         // Quase transparente
};

// Animações customizadas
const animations = {
  pulse: 'pulse 1.5s ease-in-out infinite alternate',
  bounce: 'bounce 2s ease-in-out infinite',
  fade: 'fadeInOut 3s ease-in-out infinite'
};
```

### **Informações Adicionais**
Modifique o HTML para mostrar:
- **Hostname** da máquina
- **IP Address** da rede
- **Status** de conexão
- **Uptime** do sistema

## 💡 Dicas de Uso

### **Melhores Práticas**
- ⚡ **Duração**: 3-5 segundos é ideal (não muito longo)
- 🎨 **Contraste**: Use cores que contrastem com o conteúdo atual
- 📊 **Tamanho**: 150-250px funciona bem na maioria dos casos
- 🔄 **Frequência**: Evite usar muito frequentemente

### **Troubleshooting**
- **Números não aparecem**: Verifique se há outras janelas full-screen
- **Posição errada**: Displays podem ter coordenadas negativas
- **Não fecha automaticamente**: Verifique se não há erros JavaScript
- **Performance**: Com muitos displays, reduza fontSize/duração

## 🚀 Integração com Web Controller

Em breve será adicionado um botão no web controller para identificar displays diretamente da interface web!

---

**🎉 Display Identifier implementado e funcionando!** Use para configurar seu office TV com precisão! 📺
