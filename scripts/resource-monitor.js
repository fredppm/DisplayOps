#!/usr/bin/env node

/**
 * Script para monitorar uso de recursos do sistema atual
 * Coleta métricas de CPU, memória, disco e rede
 */

const os = require('os');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

class ResourceMonitor {
  constructor() {
    this.config = {
      interval: parseInt(process.env.MONITOR_INTERVAL) || 5000, // 5 segundos
      logFile: process.env.RESOURCE_LOG_FILE || 'resource-monitor.log',
      metricsFile: process.env.RESOURCE_METRICS_FILE || 'resource-metrics.json',
      maxHistory: parseInt(process.env.MAX_HISTORY) || 1000
    };
    
    this.metrics = {
      startTime: new Date().toISOString(),
      samples: [],
      summary: {
        totalSamples: 0,
        averageCpu: 0,
        averageMemory: 0,
        peakCpu: 0,
        peakMemory: 0,
        lastSample: null
      }
    };
    
    this.isRunning = false;
    this.lastCpuUsage = this.getCpuUsage();
  }

  getCpuUsage() {
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;
    
    cpus.forEach(cpu => {
      for (const type in cpu.times) {
        totalTick += cpu.times[type];
      }
      totalIdle += cpu.times.idle;
    });
    
    return {
      idle: totalIdle,
      total: totalTick
    };
  }

  calculateCpuUsage(currentCpu) {
    const idle = currentCpu.idle - this.lastCpuUsage.idle;
    const total = currentCpu.total - this.lastCpuUsage.total;
    const percentage = 100 - (100 * idle / total);
    
    this.lastCpuUsage = currentCpu;
    return Math.round(percentage * 100) / 100;
  }

  getMemoryUsage() {
    const total = os.totalmem();
    const free = os.freemem();
    const used = total - free;
    const percentage = (used / total) * 100;
    
    return {
      total: total,
      used: used,
      free: free,
      percentage: Math.round(percentage * 100) / 100
    };
  }

  async getDiskUsage() {
    try {
      const { stdout } = await execAsync('df -h /');
      const lines = stdout.trim().split('\n');
      const dataLine = lines[1];
      const parts = dataLine.split(/\s+/);
      
      return {
        total: parts[1],
        used: parts[2],
        available: parts[3],
        percentage: parseInt(parts[4].replace('%', ''))
      };
    } catch (error) {
      return {
        error: error.message
      };
    }
  }

  async getNetworkUsage() {
    try {
      const { stdout } = await execAsync('netstat -i');
      const lines = stdout.trim().split('\n');
      const eth0Line = lines.find(line => line.includes('eth0') || line.includes('en0'));
      
      if (eth0Line) {
        const parts = eth0Line.split(/\s+/);
        return {
          interface: parts[0],
          packetsIn: parseInt(parts[3]) || 0,
          packetsOut: parseInt(parts[7]) || 0,
          errors: parseInt(parts[5]) || 0
        };
      }
      
      return {
        error: 'Interface de rede não encontrada'
      };
    } catch (error) {
      return {
        error: error.message
      };
    }
  }

  async getProcessInfo() {
    try {
      const { stdout } = await execAsync('ps aux | grep -E "(node|electron)" | grep -v grep');
      const lines = stdout.trim().split('\n');
      
      return lines.map(line => {
        const parts = line.split(/\s+/);
        return {
          pid: parts[1],
          cpu: parseFloat(parts[2]) || 0,
          memory: parseFloat(parts[3]) || 0,
          command: parts.slice(10).join(' ')
        };
      });
    } catch (error) {
      return [];
    }
  }

  async collectSample() {
    const timestamp = new Date().toISOString();
    const currentCpu = this.getCpuUsage();
    const cpuUsage = this.calculateCpuUsage(currentCpu);
    const memoryUsage = this.getMemoryUsage();
    const diskUsage = await this.getDiskUsage();
    const networkUsage = await this.getNetworkUsage();
    const processes = await this.getProcessInfo();
    
    const sample = {
      timestamp,
      cpu: {
        usage: cpuUsage,
        loadAverage: os.loadavg(),
        cores: os.cpus().length
      },
      memory: memoryUsage,
      disk: diskUsage,
      network: networkUsage,
      processes: processes,
      uptime: os.uptime()
    };
    
    return sample;
  }

  updateMetrics(sample) {
    this.metrics.samples.push(sample);
    
    // Manter apenas os últimos samples
    if (this.metrics.samples.length > this.config.maxHistory) {
      this.metrics.samples = this.metrics.samples.slice(-this.config.maxHistory);
    }
    
    // Atualizar resumo
    const cpuValues = this.metrics.samples.map(s => s.cpu.usage);
    const memoryValues = this.metrics.samples.map(s => s.memory.percentage);
    
    this.metrics.summary = {
      totalSamples: this.metrics.samples.length,
      averageCpu: cpuValues.length > 0 ? cpuValues.reduce((a, b) => a + b, 0) / cpuValues.length : 0,
      averageMemory: memoryValues.length > 0 ? memoryValues.reduce((a, b) => a + b, 0) / memoryValues.length : 0,
      peakCpu: Math.max(...cpuValues),
      peakMemory: Math.max(...memoryValues),
      lastSample: sample.timestamp
    };
  }

  logSample(sample) {
    const logEntry = {
      timestamp: sample.timestamp,
      cpu: sample.cpu.usage,
      memory: sample.memory.percentage,
      disk: sample.disk.percentage || 0,
      uptime: sample.uptime
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

  printStatus(sample) {
    const cpu = sample.cpu.usage.toFixed(1);
    const memory = sample.memory.percentage.toFixed(1);
    const disk = sample.disk.percentage || 0;
    const uptime = Math.floor(sample.uptime / 3600);
    
    console.log(`[${new Date().toISOString()}] CPU: ${cpu}% | RAM: ${memory}% | Disk: ${disk}% | Uptime: ${uptime}h`);
  }

  async start() {
    if (this.isRunning) {
      console.log('Monitor já está rodando');
      return;
    }
    
    this.isRunning = true;
    console.log('🚀 Iniciando monitor de recursos...');
    console.log(`📊 Intervalo de coleta: ${this.config.interval}ms`);
    console.log(`📝 Log file: ${this.config.logFile}`);
    console.log(`📈 Metrics file: ${this.config.metricsFile}`);
    console.log('');
    
    while (this.isRunning) {
      try {
        const sample = await this.collectSample();
        this.updateMetrics(sample);
        this.logSample(sample);
        this.saveMetrics();
        this.printStatus(sample);
        
        await this.sleep(this.config.interval);
      } catch (error) {
        console.error('❌ Erro durante coleta:', error.message);
        await this.sleep(this.config.interval);
      }
    }
  }

  stop() {
    console.log('\n🛑 Parando monitor de recursos...');
    this.isRunning = false;
    this.saveMetrics();
    console.log('✅ Monitor parado');
  }

  generateReport() {
    const summary = this.metrics.summary;
    const runtime = Date.now() - new Date(this.metrics.startTime).getTime();
    const runtimeHours = runtime / (1000 * 60 * 60);
    
    console.log('\n📊 RELATÓRIO DE RECURSOS');
    console.log('========================');
    console.log(`Período: ${this.metrics.startTime} até ${new Date().toISOString()}`);
    console.log(`Tempo total: ${runtimeHours.toFixed(2)} horas`);
    console.log(`Total de amostras: ${summary.totalSamples}`);
    console.log(`CPU médio: ${summary.averageCpu.toFixed(2)}%`);
    console.log(`CPU pico: ${summary.peakCpu.toFixed(2)}%`);
    console.log(`Memória média: ${summary.averageMemory.toFixed(2)}%`);
    console.log(`Memória pico: ${summary.peakMemory.toFixed(2)}%`);
    console.log(`Última amostra: ${summary.lastSample}`);
    
    // Análise por hora
    const hourlyStats = this.analyzeHourlyStats();
    console.log('\n📈 ESTATÍSTICAS POR HORA');
    console.log('========================');
    hourlyStats.forEach(stat => {
      console.log(`${stat.hour}: CPU ${stat.avgCpu.toFixed(1)}% | RAM ${stat.avgMemory.toFixed(1)}%`);
    });
    
    // Alertas
    this.generateAlerts();
  }

  analyzeHourlyStats() {
    const hourlyData = {};
    
    this.metrics.samples.forEach(sample => {
      const hour = new Date(sample.timestamp).getHours();
      if (!hourlyData[hour]) {
        hourlyData[hour] = { cpu: [], memory: [] };
      }
      hourlyData[hour].cpu.push(sample.cpu.usage);
      hourlyData[hour].memory.push(sample.memory.percentage);
    });
    
    return Object.entries(hourlyData)
      .map(([hour, data]) => ({
        hour: `${hour.padStart(2, '0')}:00`,
        avgCpu: data.cpu.reduce((a, b) => a + b, 0) / data.cpu.length,
        avgMemory: data.memory.reduce((a, b) => a + b, 0) / data.memory.length,
        samples: data.cpu.length
      }))
      .sort((a, b) => a.hour.localeCompare(b.hour));
  }

  generateAlerts() {
    console.log('\n⚠️  ALERTAS DE RECURSOS');
    console.log('======================');
    
    const summary = this.metrics.summary;
    
    if (summary.averageCpu > 80) {
      console.log(`🔴 CPU médio alto: ${summary.averageCpu.toFixed(2)}%`);
    } else if (summary.averageCpu > 60) {
      console.log(`🟡 CPU médio moderado: ${summary.averageCpu.toFixed(2)}%`);
    }
    
    if (summary.averageMemory > 85) {
      console.log(`🔴 Memória média alta: ${summary.averageMemory.toFixed(2)}%`);
    } else if (summary.averageMemory > 70) {
      console.log(`🟡 Memória média moderada: ${summary.averageMemory.toFixed(2)}%`);
    }
    
    if (summary.peakCpu > 95) {
      console.log(`🔴 Pico de CPU muito alto: ${summary.peakCpu.toFixed(2)}%`);
    }
    
    if (summary.peakMemory > 95) {
      console.log(`🔴 Pico de memória muito alto: ${summary.peakMemory.toFixed(2)}%`);
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Tratamento de sinais para parada graciosa
process.on('SIGINT', () => {
  console.log('\n🛑 Recebido SIGINT, parando...');
  if (global.resourceMonitor) {
    global.resourceMonitor.stop();
  }
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Recebido SIGTERM, parando...');
  if (global.resourceMonitor) {
    global.resourceMonitor.stop();
  }
  process.exit(0);
});

// Executar se chamado diretamente
if (require.main === module) {
  const monitor = new ResourceMonitor();
  global.resourceMonitor = monitor;
  
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

module.exports = ResourceMonitor;
