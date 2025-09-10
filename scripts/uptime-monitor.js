#!/usr/bin/env node

/**
 * Script para monitorar uptime do sistema atual
 * Coleta métricas de disponibilidade e performance contínua
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const os = require('os');

class UptimeMonitor {
  constructor() {
    this.config = {
      webControllerUrl: process.env.WEB_CONTROLLER_URL || 'http://localhost:3000',
      hostAgentUrl: process.env.HOST_AGENT_URL || 'http://localhost:8080',
      checkInterval: parseInt(process.env.CHECK_INTERVAL) || 30000, // 30 segundos
      logFile: process.env.LOG_FILE || 'uptime-monitor.log',
      metricsFile: process.env.METRICS_FILE || 'uptime-metrics.json'
    };
    
    this.metrics = {
      startTime: new Date().toISOString(),
      checks: [],
      summary: {
        totalChecks: 0,
        successfulChecks: 0,
        failedChecks: 0,
        uptimePercentage: 0,
        averageResponseTime: 0,
        lastCheck: null,
        lastSuccess: null,
        lastFailure: null
      }
    };
    
    this.isRunning = false;
  }

  async checkService(url, serviceName) {
    const start = Date.now();
    try {
      const response = await axios.get(url, {
        timeout: 10000,
        validateStatus: () => true // Aceitar qualquer status code
      });
      
      const responseTime = Date.now() - start;
      const isSuccess = response.status >= 200 && response.status < 500;
      
      return {
        timestamp: new Date().toISOString(),
        service: serviceName,
        url: url,
        status: response.status,
        responseTime: responseTime,
        success: isSuccess,
        error: null
      };
    } catch (error) {
      const responseTime = Date.now() - start;
      return {
        timestamp: new Date().toISOString(),
        service: serviceName,
        url: url,
        status: null,
        responseTime: responseTime,
        success: false,
        error: error.message
      };
    }
  }

  async performCheck() {
    const checks = [];
    
    // Verificar Web Controller
    const webControllerCheck = await this.checkService(
      `${this.config.webControllerUrl}/api/discovery/hosts`,
      'web-controller'
    );
    checks.push(webControllerCheck);
    
    // Verificar Host Agent (se disponível)
    try {
      const hostAgentCheck = await this.checkService(
        `${this.config.hostAgentUrl}/api/health`,
        'host-agent'
      );
      checks.push(hostAgentCheck);
    } catch (error) {
      // Host agent pode não estar rodando, não é crítico
    }
    
    return checks;
  }

  updateMetrics(checks) {
    this.metrics.checks.push(...checks);
    
    // Manter apenas os últimos 1000 checks para evitar arquivo muito grande
    if (this.metrics.checks.length > 1000) {
      this.metrics.checks = this.metrics.checks.slice(-1000);
    }
    
    // Atualizar resumo
    const allChecks = this.metrics.checks.flat();
    const successfulChecks = allChecks.filter(check => check.success);
    const failedChecks = allChecks.filter(check => !check.success);
    
    this.metrics.summary = {
      totalChecks: allChecks.length,
      successfulChecks: successfulChecks.length,
      failedChecks: failedChecks.length,
      uptimePercentage: allChecks.length > 0 ? (successfulChecks.length / allChecks.length) * 100 : 0,
      averageResponseTime: successfulChecks.length > 0 
        ? successfulChecks.reduce((sum, check) => sum + check.responseTime, 0) / successfulChecks.length 
        : 0,
      lastCheck: new Date().toISOString(),
      lastSuccess: successfulChecks.length > 0 ? successfulChecks[successfulChecks.length - 1].timestamp : null,
      lastFailure: failedChecks.length > 0 ? failedChecks[failedChecks.length - 1].timestamp : null
    };
  }

  logCheck(checks) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      checks: checks.map(check => ({
        service: check.service,
        success: check.success,
        responseTime: check.responseTime,
        status: check.status,
        error: check.error
      }))
    };
    
    const logLine = JSON.stringify(logEntry) + '\n';
    fs.appendFileSync(this.config.logFile, logLine);
  }

  saveMetrics() {
    const metricsDir = path.dirname(this.config.metricsFile);
    if (!fs.existsSync(metricsDir)) {
      fs.mkdirSync(metricsDir, { recursive: true });
    }
    
    fs.writeFileSync(this.config.metricsFile, JSON.stringify(this.metrics, null, 2));
  }

  printStatus() {
    const summary = this.metrics.summary;
    const uptime = summary.uptimePercentage.toFixed(2);
    const avgResponse = summary.averageResponseTime.toFixed(0);
    
    console.log(`[${new Date().toISOString()}] Uptime: ${uptime}% | Avg Response: ${avgResponse}ms | Total: ${summary.totalChecks}`);
    
    if (summary.lastFailure) {
      console.log(`⚠️  Last failure: ${summary.lastFailure}`);
    }
  }

  async start() {
    if (this.isRunning) {
      console.log('Monitor já está rodando');
      return;
    }
    
    this.isRunning = true;
    console.log('🚀 Iniciando monitor de uptime...');
    console.log(`📊 Intervalo de verificação: ${this.config.checkInterval}ms`);
    console.log(`📝 Log file: ${this.config.logFile}`);
    console.log(`📈 Metrics file: ${this.config.metricsFile}`);
    console.log('');
    
    while (this.isRunning) {
      try {
        const checks = await this.performCheck();
        this.updateMetrics(checks);
        this.logCheck(checks);
        this.saveMetrics();
        this.printStatus();
        
        await this.sleep(this.config.checkInterval);
      } catch (error) {
        console.error('❌ Erro durante verificação:', error.message);
        await this.sleep(this.config.checkInterval);
      }
    }
  }

  stop() {
    console.log('\n🛑 Parando monitor de uptime...');
    this.isRunning = false;
    this.saveMetrics();
    console.log('✅ Monitor parado');
  }

  generateReport() {
    const summary = this.metrics.summary;
    const runtime = Date.now() - new Date(this.metrics.startTime).getTime();
    const runtimeHours = runtime / (1000 * 60 * 60);
    
    console.log('\n📊 RELATÓRIO DE UPTIME');
    console.log('======================');
    console.log(`Período: ${this.metrics.startTime} até ${new Date().toISOString()}`);
    console.log(`Tempo total: ${runtimeHours.toFixed(2)} horas`);
    console.log(`Total de verificações: ${summary.totalChecks}`);
    console.log(`Verificações bem-sucedidas: ${summary.successfulChecks}`);
    console.log(`Verificações falharam: ${summary.failedChecks}`);
    console.log(`Uptime: ${summary.uptimePercentage.toFixed(2)}%`);
    console.log(`Tempo de resposta médio: ${summary.averageResponseTime.toFixed(0)}ms`);
    console.log(`Última verificação: ${summary.lastCheck}`);
    
    if (summary.lastFailure) {
      console.log(`Última falha: ${summary.lastFailure}`);
    }
    
    // Análise por hora
    const hourlyStats = this.analyzeHourlyStats();
    console.log('\n📈 ESTATÍSTICAS POR HORA');
    console.log('========================');
    hourlyStats.forEach(stat => {
      console.log(`${stat.hour}: ${stat.uptime.toFixed(1)}% (${stat.checks} checks)`);
    });
  }

  analyzeHourlyStats() {
    const hourlyData = {};
    
    this.metrics.checks.forEach(check => {
      const hour = new Date(check.timestamp).getHours();
      if (!hourlyData[hour]) {
        hourlyData[hour] = { total: 0, success: 0 };
      }
      hourlyData[hour].total++;
      if (check.success) {
        hourlyData[hour].success++;
      }
    });
    
    return Object.entries(hourlyData)
      .map(([hour, data]) => ({
        hour: `${hour.padStart(2, '0')}:00`,
        uptime: (data.success / data.total) * 100,
        checks: data.total
      }))
      .sort((a, b) => a.hour.localeCompare(b.hour));
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Tratamento de sinais para parada graciosa
process.on('SIGINT', () => {
  console.log('\n🛑 Recebido SIGINT, parando...');
  if (global.uptimeMonitor) {
    global.uptimeMonitor.stop();
  }
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Recebido SIGTERM, parando...');
  if (global.uptimeMonitor) {
    global.uptimeMonitor.stop();
  }
  process.exit(0);
});

// Executar se chamado diretamente
if (require.main === module) {
  const monitor = new UptimeMonitor();
  global.uptimeMonitor = monitor;
  
  // Verificar argumentos de linha de comando
  const args = process.argv.slice(2);
  
  if (args.includes('--report')) {
    // Carregar métricas existentes e gerar relatório
    try {
      if (fs.existsSync(monitor.config.metricsFile)) {
        const data = fs.readFileSync(monitor.config.metricsFile, 'utf8');
        monitor.metrics = JSON.parse(data);
        monitor.generateReport();
      } else {
        console.log('❌ Arquivo de métricas não encontrado');
      }
    } catch (error) {
      console.error('❌ Erro ao carregar métricas:', error.message);
    }
  } else {
    // Iniciar monitoramento
    monitor.start();
  }
}

module.exports = UptimeMonitor;
