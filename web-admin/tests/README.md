# Testes do Web-Controller

Este diretório contém todos os testes automatizados para o sistema web-controller.

## Estrutura de Testes

```
tests/
├── unit/                    # Testes unitários
│   ├── components/         # Testes de componentes React
│   ├── lib/               # Testes de utilitários e serviços
│   └── pages/             # Testes de páginas
├── integration/           # Testes de integração
│   ├── api/              # Testes de APIs
│   └── e2e/              # Testes end-to-end
├── fixtures/              # Dados de teste
└── mocks/                 # Mocks e stubs
```

## Tipos de Teste

### 1. Testes Unitários (TASK-000)
- **Componentes React**: Testes de renderização e interações
- **Serviços**: Testes de lógica de negócio
- **Utilitários**: Testes de funções auxiliares

### 2. Testes de Integração (TASK-001)
- **Web-Controller ↔ Host-Agent**: Comunicação gRPC
- **APIs**: Endpoints do Next.js
- **mDNS Discovery**: Descoberta de hosts

### 3. Testes de mDNS Discovery (TASK-002)
- Descoberta de hosts na rede local
- Registro de serviços
- Resolução de nomes

### 4. Testes de gRPC Communication (TASK-003)
- Comunicação entre web-controller e host-agent
- Serialização/deserialização de mensagens
- Tratamento de erros

### 5. Testes de Dashboard Assignment (TASK-004)
- Atribuição de dashboards a hosts
- Configuração de displays
- Persistência de configurações

### 6. Testes de Cookie Synchronization (TASK-005)
- Sincronização de cookies entre hosts
- Persistência de estado
- Recuperação de falhas

### 7. Testes de Browser Extension Integration (TASK-006)
- Comunicação com extensão do navegador
- Injeção de scripts
- Sincronização de estado

### 8. Testes de Auto-Restore Functionality (TASK-007)
- Restauração automática de configurações
- Detecção de falhas
- Recuperação de estado

### 9. Testes de Performance Baseline (TASK-008)
- Latência de comandos
- Uso de recursos
- Tempo de resposta

### 10. Testes de Error Handling (TASK-009)
- Tratamento de erros de rede
- Fallbacks e recuperação
- Logs de erro

## Executando Testes

```bash
# Executar todos os testes
npm test

# Executar testes em modo watch
npm run test:watch

# Executar testes com cobertura
npm run test:coverage

# Executar testes em CI
npm run test:ci
```

## Convenções

1. **Nomenclatura**: `*.test.ts` ou `*.test.tsx`
2. **Organização**: Um arquivo de teste por arquivo fonte
3. **Cobertura**: Mínimo 80% de cobertura de código
4. **Mocks**: Usar mocks para dependências externas
5. **Fixtures**: Usar dados de teste consistentes

## Próximos Passos

1. Implementar testes unitários básicos
2. Criar testes de integração para APIs
3. Implementar testes de mDNS discovery
4. Adicionar testes de gRPC communication
5. Criar testes de performance baseline
