# Decisões Arquiteturais - Sistema Multi-Site

## Decisão: DNS Fixo no Web-Admin vs Controller

### Contexto
Durante o planejamento da arquitetura multi-site, foi necessário decidir onde posicionar o DNS fixo: no Web-Admin central ou nos Controllers locais.

### Decisão Tomada
**DNS fixo será no Web-Admin central**, não nos Controllers locais.

### Justificativa

#### ✅ **Vantagens do DNS Fixo no Web-Admin:**

1. **Simplicidade de Configuração**
   - Apenas um endpoint fixo para configurar: `admin.displayops.com`
   - Controllers não precisam de DNS próprio
   - Host-agents podem usar fallback direto para web-admin

2. **Centralização de Controle**
   - Web-Admin é o ponto único de verdade
   - Todos os componentes se conectam ao mesmo endpoint
   - Facilita monitoramento e auditoria

3. **Redundância e Escalabilidade**
   - Web-Admin pode ser load-balanced sem afetar controllers
   - Controllers podem ser adicionados/removidos sem mudar DNS
   - Facilita deploy em múltiplas regiões

4. **Segurança**
   - Certificados SSL centralizados no web-admin
   - Autenticação centralizada
   - Firewall rules mais simples

5. **Operação**
   - Controllers podem ser substituídos sem mudar configurações
   - Host-agents sempre sabem onde encontrar o admin
   - Backup e restore mais simples

#### ❌ **Desvantagens do DNS Fixo nos Controllers:**

1. **Complexidade de Configuração**
   - Cada controller precisaria de DNS próprio
   - Host-agents precisariam conhecer múltiplos endpoints
   - Configuração mais complexa

2. **Fragilidade**
   - Se um controller cair, host-agents ficam isolados
   - Dependência de múltiplos DNS
   - Mais pontos de falha

3. **Operação**
   - Substituir controller requer mudança de DNS
   - Backup mais complexo
   - Monitoramento distribuído

### Arquitetura Final

```
Web-Admin (Central) ←→ DNS fixo: admin.displayops.com
├── Site: Rio
│   ├── Controller Local (1º Andar) ←→ mDNS + Web-Admin
│   └── Controller Local (2º Andar) ←→ mDNS + Web-Admin
└── Site: NYC
    └── Controller Local (NYC) ←→ mDNS + Web-Admin

Host Agents (mDNS discovery local + fallback para Web-Admin)
```

### Fluxo de Comunicação

1. **Host-Agent → Controller Local** (via mDNS)
   - Descoberta automática na rede local
   - Baixa latência para comandos locais
   - Operação offline possível

2. **Controller Local → Web-Admin** (via DNS fixo)
   - Sincronização de configurações
   - Relatórios de status
   - Autenticação e autorização

3. **Host-Agent → Web-Admin** (fallback via DNS fixo)
   - Quando controller local não disponível
   - Para configurações críticas
   - Para auditoria e logs

### Configuração de Rede

```json
{
  "webAdmin": {
    "dns": "admin.displayops.com",
    "port": 443,
    "protocol": "https"
  },
  "controllers": [
    {
      "id": "rio-1f",
      "mdnsService": "_displayops._tcp.local",
      "localNetwork": "192.168.1.0/24",
      "webAdminUrl": "https://admin.displayops.com"
    }
  ]
}
```

### Benefícios Operacionais

1. **Deploy Simplificado**
   - Controllers podem ser deployados sem configuração de DNS
   - Web-Admin pode ser atualizado sem afetar controllers
   - Rollback mais simples

2. **Monitoramento**
   - Todos os componentes reportam para o mesmo endpoint
   - Logs centralizados
   - Métricas agregadas

3. **Segurança**
   - Certificados SSL centralizados
   - Autenticação unificada
   - Auditoria centralizada

4. **Escalabilidade**
   - Novos sites podem ser adicionados sem mudar DNS
   - Controllers podem ser replicados facilmente
   - Load balancing no web-admin

### Considerações de Implementação

1. **Resiliência**
   - Controllers devem ter cache local de configurações
   - Host-agents devem funcionar offline
   - Retry automático para web-admin

2. **Performance**
   - mDNS para descoberta local (rápida)
   - DNS fixo apenas para sincronização
   - Cache local para reduzir latência

3. **Segurança**
   - mTLS entre todos os componentes
   - Certificados auto-gerados
   - Autenticação baseada em tokens

### Conclusão

A decisão de manter o DNS fixo no Web-Admin central oferece uma arquitetura mais simples, robusta e escalável, facilitando a operação e manutenção do sistema multi-site.
