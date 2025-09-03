#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🧪 Executando Testes do Sistema Atual');
console.log('=====================================\n');

// Função para executar comando e capturar output
function runCommand(command, description) {
  console.log(`📋 ${description}...`);
  try {
    const output = execSync(command, { 
      encoding: 'utf8',
      cwd: path.join(__dirname, '..'),
      stdio: 'pipe'
    });
    console.log(`✅ ${description} - SUCESSO`);
    return { success: true, output };
  } catch (error) {
    console.log(`❌ ${description} - FALHOU`);
    console.log(`   Erro: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// Função para gerar relatório
function generateReport(results) {
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      total: Object.keys(results).length,
      passed: Object.values(results).filter(r => r.success).length,
      failed: Object.values(results).filter(r => !r.success).length,
    },
    results: results,
  };

  const reportPath = path.join(__dirname, '..', 'test-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  
  console.log(`\n📊 Relatório salvo em: ${reportPath}`);
  console.log(`📈 Resumo: ${report.summary.passed}/${report.summary.total} testes passaram`);
}

// Executar testes
const results = {};

// 1. Testes unitários
results.unitTests = runCommand(
  'npm run test -- --testPathPattern="tests/unit" --passWithNoTests',
  'Testes Unitários'
);

// 2. Testes de integração
results.integrationTests = runCommand(
  'npm run test -- --testPathPattern="tests/integration" --passWithNoTests',
  'Testes de Integração'
);

// 3. Testes de performance
results.performanceTests = runCommand(
  'npm run test -- --testPathPattern="tests/unit/performance" --passWithNoTests',
  'Testes de Performance'
);

// 4. Verificação de tipos
results.typeCheck = runCommand(
  'npm run type-check',
  'Verificação de Tipos TypeScript'
);

// 5. Linting
results.linting = runCommand(
  'npm run lint',
  'Verificação de Linting'
);

// Gerar relatório
generateReport(results);

// Resumo final
console.log('\n🎯 Resumo Final da Fase 0');
console.log('========================');
console.log(`✅ Testes Unitários: ${results.unitTests.success ? 'PASSOU' : 'FALHOU'}`);
console.log(`✅ Testes de Integração: ${results.integrationTests.success ? 'PASSOU' : 'FALHOU'}`);
console.log(`✅ Testes de Performance: ${results.performanceTests.success ? 'PASSOU' : 'FALHOU'}`);
console.log(`✅ Verificação de Tipos: ${results.typeCheck.success ? 'PASSOU' : 'FALHOU'}`);
console.log(`✅ Linting: ${results.linting.success ? 'PASSOU' : 'FALHOU'}`);

const totalPassed = Object.values(results).filter(r => r.success).length;
const totalTests = Object.keys(results).length;

if (totalPassed === totalTests) {
  console.log('\n🎉 TODOS OS TESTES PASSARAM! Sistema pronto para Fase 1.');
  process.exit(0);
} else {
  console.log(`\n⚠️  ${totalTests - totalPassed} teste(s) falharam. Revisar antes de prosseguir.`);
  process.exit(1);
}
