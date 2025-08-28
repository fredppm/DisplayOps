# 📝 Guia de Edição de Dashboards

## ✅ Funcionalidade Implementada

Agora você pode **editar, adicionar e remover dashboards** diretamente na interface "Available Dashboards"!

## 🎯 Como Usar

### **1. Editando um Dashboard Existente**

1. **Localize o dashboard** na seção "Available Dashboards"
2. **Clique no ícone de lápis** (Edit3) no canto superior direito do card
3. **O dashboard entra em modo de edição** com todos os campos editáveis:
   - ✏️ **Nome**: Nome do dashboard
   - 🔗 **URL**: URL completa do dashboard  
   - 📝 **Descrição**: Descrição opcional
   - ⏱️ **Refresh Interval**: Intervalo de refresh em segundos (30-3600)
   - 📂 **Categoria**: Categoria do dashboard (Monitoring, BI, Analytics, Custom)
   - 🔒 **Requires Authentication**: Checkbox se requer autenticação

4. **Salve as alterações** clicando no botão "Save" ou **cancele** com "Cancel"

### **2. Adicionando um Novo Dashboard**

1. **Clique no botão "Add Dashboard"** no canto superior direito
2. **Um novo dashboard é criado** automaticamente em modo de edição
3. **Configure todos os campos** necessários
4. **Salve** para adicionar à lista

### **3. Removendo um Dashboard**

1. **Clique no ícone da lixeira** (Trash2) no canto do dashboard
2. **Se o dashboard não estiver atribuído** a nenhuma TV, será removido imediatamente
3. **Se estiver atribuído**, você receberá um aviso para remover as atribuições primeiro

## 🔧 Campos de Configuração

### **Nome** (obrigatório)
- Nome exibido na interface
- Usado nas notificações e logs
- Deve ser único e descritivo

### **URL** (obrigatório)  
- URL completa do dashboard (https://exemplo.com/dashboard)
- Será validada antes do deployment
- Testada para conectividade

### **Descrição** (opcional)
- Descrição detalhada do dashboard
- Aparece abaixo do nome na interface
- Útil para documentar o propósito

### **Refresh Interval** (30-3600 segundos)
- Frequência de refresh automático
- Mínimo: 30 segundos
- Máximo: 1 hora (3600 segundos)
- Padrão: 300 segundos (5 minutos)

### **Categoria** (opcional)
- **Monitoring**: Dashboards de monitoramento de sistema
- **Business Intelligence**: Dashboards de BI e relatórios
- **Analytics**: Dashboards de análise de dados
- **Custom**: Dashboards customizados

### **Requires Authentication** (checkbox)
- Indica se o dashboard requer login
- Usado para planejamento da Phase 3 (Cookie Sync)
- Mostra ícone de alerta na interface

## 🎨 Interface Visual

### **Modo Visualização**
- Card com borda cinza normal
- Informações do dashboard visíveis
- Botões de ação no canto: ✏️ Edit, 🗑️ Delete, 🔗 Open

### **Modo Edição**
- Card com **borda azul** indicando edição ativa
- Formulário completo com todos os campos
- Botões "Save" e "Cancel" no topo
- Validação em tempo real

### **Estados Visuais**
- 🔵 **Azul**: Dashboard em edição
- 🟢 **Verde**: Dashboard selecionado (expandido)
- ⚪ **Cinza**: Dashboard normal

## 🔔 Notificações

### **Edição**
- 🔵 **Info**: "Editing Dashboard: [nome]"
- ✅ **Success**: "Dashboard Updated: [nome] has been updated successfully"
- ❌ **Error**: "Validation Error: [detalhes]"
- 🔵 **Info**: "Edit Cancelled: Dashboard editing cancelled"

### **Adição**
- ✅ **Success**: "Dashboard Created: New dashboard created. Configure it now."

### **Remoção**
- ✅ **Success**: "Dashboard Deleted: [nome] has been removed"
- ⚠️ **Warning**: "Cannot Delete Dashboard: [nome] is currently assigned to TVs"

## ✅ Validações

### **Campos Obrigatórios**
- ❌ Nome vazio: "Dashboard name is required"
- ❌ URL vazia: "Dashboard URL is required"

### **Formato de URL**
- ❌ URL inválida: "Invalid URL format"
- ✅ Aceita: `http://` e `https://`

### **Refresh Interval**
- 🔢 Apenas números entre 30 e 3600
- ⚠️ Valores fora do range são ajustados automaticamente

### **Proteção contra Remoção**
- 🛡️ Dashboards atribuídos a TVs não podem ser removidos
- 📍 Mostra aviso com orientação para remover atribuições primeiro

## 📁 Exemplo de Uso Prático

### **Editando o Grafana Dashboard para funcionar:**

1. **Clique no ícone de edição** no "Grafana Main Dashboard"
2. **Mude a URL** de:
   ```
   https://grafana.company.com/d/main
   ```
   Para:
   ```
   https://grafana.com
   ou
   http://localhost:3001/d/your-dashboard-id
   ```
3. **Ajuste outros campos** se necessário
4. **Clique "Save"**
5. **Teste o deployment** - agora deve funcionar!

### **Adicionando um Dashboard Local:**

1. **Clique "Add Dashboard"**
2. **Configure os campos:**
   - Nome: "Local Grafana"
   - URL: "http://localhost:3001"
   - Descrição: "Grafana local development"
   - Categoria: "Monitoring"
3. **Salve e teste**

## 🔄 Persistência

### **Estado Local**
- 📱 Dashboards são mantidos no estado do React
- 🔄 Persistem durante a sessão
- ⚠️ **Resetam ao recarregar a página**

### **Próximas Melhorias**
- 💾 Salvamento automático no LocalStorage
- ☁️ Sincronização com backend
- 📤 Import/Export de configurações
- 🔄 Backup automático

## 🎯 Benefícios

- ✅ **Edição In-line**: Não precisa sair da página
- 🎨 **Interface Intuitiva**: Visualmente clara sobre o que está sendo editado
- 🔔 **Feedback Imediato**: Notificações para todas as ações
- 🛡️ **Validação Robusta**: Previne configurações inválidas
- ⚡ **Resposta Rápida**: Edição instantânea sem recarregamento

---

## 🚀 Como Testar

1. **Inicie os serviços:**
   ```bash
   cd web-controller && npm run dev
   ```

2. **Abra a interface:**
   - http://localhost:3000
   - Vá para "Dashboard Management"

3. **Teste a edição:**
   - Clique no ícone de lápis em qualquer dashboard
   - Faça alterações
   - Observe as notificações
   - Salve ou cancele

4. **Teste a adição:**
   - Clique "Add Dashboard"
   - Configure um novo dashboard
   - Teste o deployment

**✅ EDIÇÃO DE DASHBOARDS IMPLEMENTADA!** Agora você pode gerenciar completamente seus dashboards através da interface. 🎉
