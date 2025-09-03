#!/usr/bin/env node

/**
 * Script para health checks básicos do sistema atual
 * Verifica a saúde de todos os componentes
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const os = require('os');

class HealthCheck {
  constructor() {
    this.config = {
      webControllerUrl: process.env.WEB_CONTROLLER_URL || 'http://localhost:3000',
      hostAgentUrl: process.env.HOST_AGENT_URL || 'http://localhost:8080',
      timeout: parseInt(process.env.HEALTH_TIMEOUT) || 5000,
      outputFile: process.env.HEALTH_OUTPUT || 'health-check.json'
    };
    
    this.results = {
      timestamp: new Date().toISOString(),
      system: this.getSystemInfo(),
      checks: {},
      summary: {
        total: 0,
        passed: 0,
        failed: 0,
        overall: 'unknown'
      }
    };
  }

  getSystemInfo() {
    return {
      platform: os.platform(),
      arch: os.arch(),
      nodeVersion: process.version,
      uptime: os.uptime(),
      memory: {
        total: os.totalmem(),
        free: os.freemem(),
        used: os.totalmem() - os.freemem()
      },
      cpu: {
        cores: os.cpus().length,
        load: os.loadavg()
      }
    };
  }

  async checkWebController() {
    const checks = {};
    
    // Check 1: Basic connectivity
    try {
      const start = Date.now();
      const response = await axios.get(`${this.config.webControllerUrl}/api/discovery/hosts`, {
        timeout: this.config.timeout
      });
      const responseTime = Date.now() - start;
      
      checks.connectivity = {
        status: 'passed',
        responseTime: responseTime,
        statusCode: response.status,
        message: 'Web Controller is responding'
      };
    } catch (error) {
      checks.connectivity = {
        status: 'failed',
        error: error.message,
        message: 'Web Controller is not responding'
      };
    }
    
    // Check 2: Discovery API
    try {
      const response = await axios.get(`${this.config.webControllerUrl}/api/discovery/hosts`, {
        timeout: this.config.timeout
      });
      
      const hosts = response.data.hosts || [];
      checks.discovery = {
        status: 'passed',
        hostsCount: hosts.length,
        message: `Found ${hosts.length} hosts`
      };
    } catch (error) {
      checks.discovery = {
        status: 'failed',
        error: error.message,
        message: 'Discovery API is not working'
      };
    }
    
    // Check 3: Dashboards API
    try {
      const response = await axios.get(`${this.config.webControllerUrl}/api/dashboards`, {
        timeout: this.config.timeout
      });
      
      const dashboards = response.data.dashboards || [];
      checks.dashboards = {
        status: 'passed',
        dashboardsCount: dashboards.length,
        message: `Found ${dashboards.length} dashboards`
      };
    } catch (error) {
      checks.dashboards = {
        status: 'failed',
        error: error.message,
        message: 'Dashboards API is not working'
      };
    }
    
    // Check 4: Configuration files
    const configFiles = [
      'web-controller/data/dashboards.json',
      'web-controller/data/cookies.json'
    ];
    
    checks.configFiles = {};
    configFiles.forEach(file => {
      if (fs.existsSync(file)) {
        try {
          const stats = fs.statSync(file);
          const data = fs.readFileSync(file, 'utf8');
          const json = JSON.parse(data);
          
          checks.configFiles[file] = {
            status: 'passed',
            size: stats.size,
            lastModified: stats.mtime.toISOString(),
            isValid: true,
            message: 'Configuration file is valid'
          };
        } catch (error) {
          checks.configFiles[file] = {
            status: 'failed',
            error: error.message,
            message: 'Configuration file is invalid'
          };
        }
      } else {
        checks.configFiles[file] = {
          status: 'failed',
          message: 'Configuration file not found'
        };
      }
    });
    
    return checks;
  }

  async checkHostAgent() {
    const checks = {};
    
    // Check 1: Basic connectivity
    try {
      const start = Date.now();
      const response = await axios.get(`${this.config.hostAgentUrl}/api/health`, {
        timeout: this.config.timeout
      });
      const responseTime = Date.now() - start;
      
      checks.connectivity = {
        status: 'passed',
        responseTime: responseTime,
        statusCode: response.status,
        message: 'Host Agent is responding'
      };
    } catch (error) {
      checks.connectivity = {
        status: 'failed',
        error: error.message,
        message: 'Host Agent is not responding'
      };
    }
    
    // Check 2: Configuration files
    const configFiles = [
      'host-agent/data/config.json',
      'host-agent/data/display-state.json'
    ];
    
    checks.configFiles = {};
    configFiles.forEach(file => {
      if (fs.existsSync(file)) {
        try {
          const stats = fs.statSync(file);
          const data = fs.readFileSync(file, 'utf8');
          const json = JSON.parse(data);
          
          checks.configFiles[file] = {
            status: 'passed',
            size: stats.size,
            lastModified: stats.mtime.toISOString(),
            isValid: true,
            message: 'Configuration file is valid'
          };
        } catch (error) {
          checks.configFiles[file] = {
            status: 'failed',
            error: error.message,
            message: 'Configuration file is invalid'
          };
        }
      } else {
        checks.configFiles[file] = {
          status: 'failed',
          message: 'Configuration file not found'
        };
      }
    });
    
    return checks;
  }

  async checkNetwork() {
    const checks = {};
    
    // Check 1: mDNS service
    try {
      const { exec } = require('child_process');
      const { promisify } = require('util');
      const execAsync = promisify(exec);
      
      const { stdout } = await execAsync('dns-sd -B _displayops._tcp.local');
      checks.mdns = {
        status: 'passed',
        message: 'mDNS service is working',
        output: stdout.substring(0, 200) + '...'
      };
    } catch (error) {
      checks.mdns = {
        status: 'failed',
        error: error.message,
        message: 'mDNS service is not working'
      };
    }
    
    // Check 2: Port availability
    const ports = [3000, 8080, 8082];
    checks.ports = {};
    
    for (const port of ports) {
      try {
        const net = require('net');
        const socket = new net.Socket();
        
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            socket.destroy();
            reject(new Error('Connection timeout'));
          }, 2000);
          
          socket.connect(port, 'localhost', () => {
            clearTimeout(timeout);
            socket.destroy();
            resolve();
          });
          
          socket.on('error', (error) => {
            clearTimeout(timeout);
            reject(error);
          });
        });
        
        checks.ports[port] = {
          status: 'passed',
          message: `Port ${port} is open`
        };
      } catch (error) {
        checks.ports[port] = {
          status: 'failed',
          error: error.message,
          message: `Port ${port} is not accessible`
        };
      }
    }
    
    return checks;
  }

  async checkSystemResources() {
    const checks = {};
    
    // Check 1: Memory usage
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    const memoryUsage = (usedMemory / totalMemory) * 100;
    
    checks.memory = {
      status: memoryUsage < 90 ? 'passed' : 'warning',
      usage: memoryUsage.toFixed(2),
      total: (totalMemory / 1024 / 1024 / 1024).toFixed(2) + ' GB',
      free: (freeMemory / 1024 / 1024 / 1024).toFixed(2) + ' GB',
      message: `Memory usage: ${memoryUsage.toFixed(2)}%`
    };
    
    // Check 2: CPU load
    const loadAvg = os.loadavg();
    const cpuCores = os.cpus().length;
    const cpuUsage = (loadAvg[0] / cpuCores) * 100;
    
    checks.cpu = {
      status: cpuUsage < 80 ? 'passed' : 'warning',
      loadAverage: loadAvg,
      cores: cpuCores,
      usage: cpuUsage.toFixed(2),
      message: `CPU load: ${cpuUsage.toFixed(2)}%`
    };
    
    // Check 3: Disk space
    try {
      const { exec } = require('child_process');
      const { promisify } = require('util');
      const execAsync = promisify(exec);
      
      const { stdout } = await execAsync('df -h /');
      const lines = stdout.trim().split('\n');
      const dataLine = lines[1];
      const parts = dataLine.split(/\s+/);
      const diskUsage = parseInt(parts[4].replace('%', ''));
      
      checks.disk = {
        status: diskUsage < 90 ? 'passed' : 'warning',
        usage: diskUsage,
        total: parts[1],
        used: parts[2],
        available: parts[3],
        message: `Disk usage: ${diskUsage}%`
      };
    } catch (error) {
      checks.disk = {
        status: 'failed',
        error: error.message,
        message: 'Could not check disk usage'
      };
    }
    
    // Check 4: System uptime
    const uptime = os.uptime();
    const uptimeHours = uptime / 3600;
    
    checks.uptime = {
      status: 'passed',
      uptime: uptime,
      hours: uptimeHours.toFixed(2),
      message: `System uptime: ${uptimeHours.toFixed(2)} hours`
    };
    
    return checks;
  }

  async checkProcesses() {
    const checks = {};
    
    try {
      const { exec } = require('child_process');
      const { promisify } = require('util');
      const execAsync = promisify(exec);
      
      // Check for Node.js processes
      const { stdout: nodeProcesses } = await execAsync('ps aux | grep node | grep -v grep');
      const nodeCount = nodeProcesses.trim().split('\n').filter(line => line.length > 0).length;
      
      checks.nodeProcesses = {
        status: nodeCount > 0 ? 'passed' : 'warning',
        count: nodeCount,
        message: `Found ${nodeCount} Node.js processes`
      };
      
      // Check for Electron processes (Host Agent)
      const { stdout: electronProcesses } = await execAsync('ps aux | grep electron | grep -v grep');
      const electronCount = electronProcesses.trim().split('\n').filter(line => line.length > 0).length;
      
      checks.electronProcesses = {
        status: electronCount > 0 ? 'passed' : 'warning',
        count: electronCount,
        message: `Found ${electronCount} Electron processes`
      };
      
    } catch (error) {
      checks.processes = {
        status: 'failed',
        error: error.message,
        message: 'Could not check processes'
      };
    }
    
    return checks;
  }

  async runAllChecks() {
    console.log('🔍 Iniciando health checks...\n');
    
    try {
      // Web Controller checks
      console.log('📊 Verificando Web Controller...');
      this.results.checks.webController = await this.checkWebController();
      
      // Host Agent checks
      console.log('🖥️  Verificando Host Agent...');
      this.results.checks.hostAgent = await this.checkHostAgent();
      
      // Network checks
      console.log('🌐 Verificando rede...');
      this.results.checks.network = await this.checkNetwork();
      
      // System resources
      console.log('💾 Verificando recursos do sistema...');
      this.results.checks.systemResources = await this.checkSystemResources();
      
      // Processes
      console.log('⚙️  Verificando processos...');
      this.results.checks.processes = await this.checkProcesses();
      
      this.updateSummary();
      this.saveResults();
      this.printResults();
      
    } catch (error) {
      console.error('❌ Erro durante health checks:', error.message);
      this.results.error = error.message;
      this.saveResults();
    }
  }

  updateSummary() {
    let total = 0;
    let passed = 0;
    let failed = 0;
    
    Object.values(this.results.checks).forEach(category => {
      Object.values(category).forEach(check => {
        if (typeof check === 'object' && check.status) {
          total++;
          if (check.status === 'passed') {
            passed++;
          } else if (check.status === 'failed') {
            failed++;
          }
        }
      });
    });
    
    this.results.summary = {
      total,
      passed,
      failed,
      overall: failed === 0 ? 'healthy' : failed < total * 0.2 ? 'warning' : 'unhealthy'
    };
  }

  saveResults() {
    const outputDir = path.dirname(this.config.outputFile);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    fs.writeFileSync(this.config.outputFile, JSON.stringify(this.results, null, 2));
    console.log(`\n💾 Resultados salvos em: ${this.config.outputFile}`);
  }

  printResults() {
    console.log('\n📊 RESULTADOS DOS HEALTH CHECKS');
    console.log('================================');
    
    const summary = this.results.summary;
    const overallStatus = summary.overall === 'healthy' ? '✅' : 
                          summary.overall === 'warning' ? '⚠️' : '❌';
    
    console.log(`${overallStatus} Status Geral: ${summary.overall.toUpperCase()}`);
    console.log(`📈 Total: ${summary.total} | ✅ Passou: ${summary.passed} | ❌ Falhou: ${summary.failed}\n`);
    
    Object.entries(this.results.checks).forEach(([category, checks]) => {
      console.log(`\n${this.getCategoryIcon(category)} ${category.toUpperCase()}:`);
      console.log('-'.repeat(category.length + 2));
      
      Object.entries(checks).forEach(([checkName, check]) => {
        if (typeof check === 'object' && check.status) {
          const statusIcon = check.status === 'passed' ? '✅' : 
                           check.status === 'warning' ? '⚠️' : '❌';
          console.log(`${statusIcon} ${checkName}: ${check.message}`);
        } else if (typeof check === 'object') {
          // Handle nested objects (like configFiles)
          Object.entries(check).forEach(([subCheckName, subCheck]) => {
            if (typeof subCheck === 'object' && subCheck.status) {
              const statusIcon = subCheck.status === 'passed' ? '✅' : 
                               subCheck.status === 'warning' ? '⚠️' : '❌';
              console.log(`  ${statusIcon} ${subCheckName}: ${subCheck.message}`);
            }
          });
        }
      });
    });
    
    console.log('\n🎯 RECOMENDAÇÕES:');
    this.printRecommendations();
  }

  getCategoryIcon(category) {
    const icons = {
      webController: '📊',
      hostAgent: '🖥️',
      network: '🌐',
      systemResources: '💾',
      processes: '⚙️'
    };
    return icons[category] || '🔍';
  }

  printRecommendations() {
    const checks = this.results.checks;
    const recommendations = [];
    
    // Web Controller recommendations
    if (checks.webController?.connectivity?.status === 'failed') {
      recommendations.push('• Verificar se o Web Controller está rodando (npm start)');
    }
    
    if (checks.webController?.discovery?.status === 'failed') {
      recommendations.push('• Verificar configuração de mDNS e firewall');
    }
    
    // Host Agent recommendations
    if (checks.hostAgent?.connectivity?.status === 'failed') {
      recommendations.push('• Verificar se o Host Agent está rodando');
    }
    
    // Network recommendations
    if (checks.network?.mdns?.status === 'failed') {
      recommendations.push('• Instalar/configurar Avahi/Bonjour para mDNS');
    }
    
    if (checks.network?.ports?.['3000']?.status === 'failed') {
      recommendations.push('• Verificar se a porta 3000 está livre');
    }
    
    // System recommendations
    if (checks.systemResources?.memory?.status === 'warning') {
      recommendations.push('• Considerar aumentar RAM ou otimizar uso de memória');
    }
    
    if (checks.systemResources?.cpu?.status === 'warning') {
      recommendations.push('• Verificar processos que estão consumindo muito CPU');
    }
    
    if (checks.systemResources?.disk?.status === 'warning') {
      recommendations.push('• Limpar espaço em disco');
    }
    
    if (recommendations.length === 0) {
      console.log('✅ Sistema está saudável!');
    } else {
      recommendations.forEach(rec => console.log(rec));
    }
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  const healthCheck = new HealthCheck();
  healthCheck.runAllChecks();
}

module.exports = HealthCheck;
