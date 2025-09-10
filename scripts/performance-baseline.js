#!/usr/bin/env node

/**
 * Script para medir baseline de performance do sistema atual
 * Executa testes de latência, throughput e uso de recursos
 */

const axios = require('axios');
const { performance } = require('perf_hooks');
const os = require('os');
const fs = require('fs');
const path = require('path');

class PerformanceBaseline {
  constructor() {
    this.results = {
      timestamp: new Date().toISOString(),
      system: this.getSystemInfo(),
      tests: {}
    };
    
    this.webControllerUrl = process.env.WEB_CONTROLLER_URL || 'http://localhost:3000';
    this.hostAgentUrl = process.env.HOST_AGENT_URL || 'http://localhost:8080';
  }

  getSystemInfo() {
    return {
      platform: os.platform(),
      arch: os.arch(),
      nodeVersion: process.version,
      cpu: {
        model: os.cpus()[0].model,
        cores: os.cpus().length,
        load: os.loadavg()
      },
      memory: {
        total: os.totalmem(),
        free: os.freemem(),
        used: os.totalmem() - os.freemem()
      },
      uptime: os.uptime()
    };
  }

  async measureLatency(endpoint, method = 'GET', data = null) {
    const start = performance.now();
    try {
      const response = await axios({
        method,
        url: endpoint,
        data,
        timeout: 10000
      });
      const end = performance.now();
      return {
        success: true,
        latency: end - start,
        status: response.status,
        dataSize: JSON.stringify(response.data).length
      };
    } catch (error) {
      const end = performance.now();
      return {
        success: false,
        latency: end - start,
        error: error.message,
        status: error.response?.status
      };
    }
  }

  async testDiscoveryLatency() {
    console.log('🔍 Testando latência de descoberta...');
    
    const results = [];
    for (let i = 0; i < 10; i++) {
      const result = await this.measureLatency(`${this.webControllerUrl}/api/discovery/hosts`);
      results.push(result);
      await this.sleep(100);
    }

    const successfulResults = results.filter(r => r.success);
    const avgLatency = successfulResults.length > 0 
      ? successfulResults.reduce((sum, r) => sum + r.latency, 0) / successfulResults.length 
      : 0;

    this.results.tests.discoveryLatency = {
      description: 'Latência de descoberta de hosts via mDNS',
      iterations: 10,
      successful: successfulResults.length,
      failed: results.length - successfulResults.length,
      averageLatency: avgLatency,
      minLatency: Math.min(...successfulResults.map(r => r.latency)),
      maxLatency: Math.max(...successfulResults.map(r => r.latency)),
      results
    };

    console.log(`✅ Descoberta: ${avgLatency.toFixed(2)}ms (média)`);
  }

  async testCommandLatency() {
    console.log('⚡ Testando latência de comandos...');
    
    // Primeiro, obter lista de hosts
    const hostsResponse = await axios.get(`${this.webControllerUrl}/api/discovery/hosts`);
    const hosts = hostsResponse.data.hosts || [];
    
    if (hosts.length === 0) {
      console.log('⚠️  Nenhum host encontrado para teste de comandos');
      this.results.tests.commandLatency = {
        description: 'Latência de comandos gRPC',
        error: 'Nenhum host disponível para teste'
      };
      return;
    }

    const hostId = hosts[0].id;
    const results = [];
    
    for (let i = 0; i < 5; i++) {
      const result = await this.measureLatency(
        `${this.webControllerUrl}/api/host/${hostId}/command`,
        'POST',
        {
          command: 'ping',
          params: {}
        }
      );
      results.push(result);
      await this.sleep(500);
    }

    const successfulResults = results.filter(r => r.success);
    const avgLatency = successfulResults.length > 0 
      ? successfulResults.reduce((sum, r) => sum + r.latency, 0) / successfulResults.length 
      : 0;

    this.results.tests.commandLatency = {
      description: 'Latência de comandos gRPC',
      hostId,
      iterations: 5,
      successful: successfulResults.length,
      failed: results.length - successfulResults.length,
      averageLatency: avgLatency,
      minLatency: Math.min(...successfulResults.map(r => r.latency)),
      maxLatency: Math.max(...successfulResults.map(r => r.latency)),
      results
    };

    console.log(`✅ Comandos: ${avgLatency.toFixed(2)}ms (média)`);
  }

  async testHealthCheckLatency() {
    console.log('💓 Testando latência de health check...');
    
    const results = [];
    for (let i = 0; i < 20; i++) {
      const result = await this.measureLatency(`${this.webControllerUrl}/api/discovery/hosts`);
      results.push(result);
      await this.sleep(50);
    }

    const successfulResults = results.filter(r => r.success);
    const avgLatency = successfulResults.length > 0 
      ? successfulResults.reduce((sum, r) => sum + r.latency, 0) / successfulResults.length 
      : 0;

    this.results.tests.healthCheckLatency = {
      description: 'Latência de health check',
      iterations: 20,
      successful: successfulResults.length,
      failed: results.length - successfulResults.length,
      averageLatency: avgLatency,
      minLatency: Math.min(...successfulResults.map(r => r.latency)),
      maxLatency: Math.max(...successfulResults.map(r => r.latency)),
      results
    };

    console.log(`✅ Health Check: ${avgLatency.toFixed(2)}ms (média)`);
  }

  async testThroughput() {
    console.log('🚀 Testando throughput...');
    
    const start = performance.now();
    const promises = [];
    
    // Simular 50 requisições simultâneas
    for (let i = 0; i < 50; i++) {
      promises.push(this.measureLatency(`${this.webControllerUrl}/api/discovery/hosts`));
    }
    
    const results = await Promise.all(promises);
    const end = performance.now();
    
    const successfulResults = results.filter(r => r.success);
    const totalTime = end - start;
    const throughput = successfulResults.length / (totalTime / 1000); // requests per second

    this.results.tests.throughput = {
      description: 'Throughput - requisições simultâneas',
      concurrentRequests: 50,
      successful: successfulResults.length,
      failed: results.length - successfulResults.length,
      totalTime: totalTime,
      throughput: throughput,
      averageLatency: successfulResults.reduce((sum, r) => sum + r.latency, 0) / successfulResults.length,
      results
    };

    console.log(`✅ Throughput: ${throughput.toFixed(2)} req/s`);
  }

  async testResourceUsage() {
    console.log('💾 Medindo uso de recursos...');
    
    const startMemory = process.memoryUsage();
    const startCpu = os.loadavg();
    
    // Simular carga
    const promises = [];
    for (let i = 0; i < 100; i++) {
      promises.push(this.measureLatency(`${this.webControllerUrl}/api/discovery/hosts`));
    }
    await Promise.all(promises);
    
    const endMemory = process.memoryUsage();
    const endCpu = os.loadavg();
    
    this.results.tests.resourceUsage = {
      description: 'Uso de recursos durante carga',
      memory: {
        start: {
          rss: startMemory.rss,
          heapUsed: startMemory.heapUsed,
          heapTotal: startMemory.heapTotal,
          external: startMemory.external
        },
        end: {
          rss: endMemory.rss,
          heapUsed: endMemory.heapUsed,
          heapTotal: endMemory.heapTotal,
          external: endMemory.external
        },
        delta: {
          rss: endMemory.rss - startMemory.rss,
          heapUsed: endMemory.heapUsed - startMemory.heapUsed,
          heapTotal: endMemory.heapTotal - startMemory.heapTotal,
          external: endMemory.external - startMemory.external
        }
      },
      cpu: {
        start: startCpu,
        end: endCpu,
        delta: endCpu.map((end, i) => end - startCpu[i])
      }
    };

    console.log(`✅ Recursos: RSS +${(endMemory.rss - startMemory.rss) / 1024 / 1024:.2f}MB`);
  }

  async testUptime() {
    console.log('⏱️  Testando uptime...');
    
    const start = performance.now();
    const results = [];
    
    // Testar por 30 segundos
    const testDuration = 30000;
    const interval = 1000; // 1 segundo
    
    while (performance.now() - start < testDuration) {
      const result = await this.measureLatency(`${this.webControllerUrl}/api/discovery/hosts`);
      results.push({
        ...result,
        timestamp: new Date().toISOString()
      });
      await this.sleep(interval);
    }
    
    const successfulResults = results.filter(r => r.success);
    const uptimePercentage = (successfulResults.length / results.length) * 100;
    
    this.results.tests.uptime = {
      description: 'Teste de uptime por 30 segundos',
      duration: testDuration,
      totalRequests: results.length,
      successful: successfulResults.length,
      failed: results.length - successfulResults.length,
      uptimePercentage: uptimePercentage,
      averageLatency: successfulResults.reduce((sum, r) => sum + r.latency, 0) / successfulResults.length,
      results
    };

    console.log(`✅ Uptime: ${uptimePercentage.toFixed(2)}%`);
  }

  async runAllTests() {
    console.log('🚀 Iniciando baseline de performance...\n');
    
    try {
      await this.testDiscoveryLatency();
      await this.testCommandLatency();
      await this.testHealthCheckLatency();
      await this.testThroughput();
      await this.testResourceUsage();
      await this.testUptime();
      
      this.saveResults();
      this.printSummary();
      
    } catch (error) {
      console.error('❌ Erro durante os testes:', error.message);
      this.results.error = error.message;
      this.saveResults();
    }
  }

  saveResults() {
    const outputDir = path.join(__dirname, '..', 'data', 'performance');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const filename = `baseline-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    const filepath = path.join(outputDir, filename);
    
    fs.writeFileSync(filepath, JSON.stringify(this.results, null, 2));
    console.log(`\n💾 Resultados salvos em: ${filepath}`);
  }

  printSummary() {
    console.log('\n📊 RESUMO DO BASELINE DE PERFORMANCE');
    console.log('=====================================');
    
    const tests = this.results.tests;
    
    if (tests.discoveryLatency) {
      console.log(`🔍 Descoberta: ${tests.discoveryLatency.averageLatency.toFixed(2)}ms (${tests.discoveryLatency.successful}/${tests.discoveryLatency.iterations})`);
    }
    
    if (tests.commandLatency) {
      console.log(`⚡ Comandos: ${tests.commandLatency.averageLatency.toFixed(2)}ms (${tests.commandLatency.successful}/${tests.commandLatency.iterations})`);
    }
    
    if (tests.healthCheckLatency) {
      console.log(`💓 Health Check: ${tests.healthCheckLatency.averageLatency.toFixed(2)}ms (${tests.healthCheckLatency.successful}/${tests.healthCheckLatency.iterations})`);
    }
    
    if (tests.throughput) {
      console.log(`🚀 Throughput: ${tests.throughput.throughput.toFixed(2)} req/s`);
    }
    
    if (tests.uptime) {
      console.log(`⏱️  Uptime: ${tests.uptime.uptimePercentage.toFixed(2)}%`);
    }
    
    if (tests.resourceUsage) {
      const memDelta = tests.resourceUsage.memory.delta.rss / 1024 / 1024;
      console.log(`💾 Memória: +${memDelta.toFixed(2)}MB`);
    }
    
    console.log('\n✅ Baseline de performance concluído!');
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  const baseline = new PerformanceBaseline();
  baseline.runAllTests();
}

module.exports = PerformanceBaseline;
