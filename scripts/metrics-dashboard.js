#!/usr/bin/env node

/**
 * Dashboard de métricas para visualizar performance do sistema atual
 * Combina dados de performance, uptime e recursos
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const url = require('url');

class MetricsDashboard {
  constructor() {
    this.config = {
      port: parseInt(process.env.DASHBOARD_PORT) || 8081,
      performanceFile: process.env.PERFORMANCE_FILE || 'data/performance/baseline-*.json',
      uptimeFile: process.env.UPTIME_FILE || 'uptime-metrics.json',
      resourceFile: process.env.RESOURCE_FILE || 'resource-metrics.json'
    };
    
    this.metrics = {
      performance: null,
      uptime: null,
      resources: null,
      lastUpdate: null
    };
  }

  loadMetrics() {
    try {
      // Carregar métricas de performance
      const performanceFiles = this.findPerformanceFiles();
      if (performanceFiles.length > 0) {
        const latestFile = performanceFiles[performanceFiles.length - 1];
        const data = fs.readFileSync(latestFile, 'utf8');
        this.metrics.performance = JSON.parse(data);
      }
      
      // Carregar métricas de uptime
      if (fs.existsSync(this.config.uptimeFile)) {
        const data = fs.readFileSync(this.config.uptimeFile, 'utf8');
        this.metrics.uptime = JSON.parse(data);
      }
      
      // Carregar métricas de recursos
      if (fs.existsSync(this.config.resourceFile)) {
        const data = fs.readFileSync(this.config.resourceFile, 'utf8');
        this.metrics.resources = JSON.parse(data);
      }
      
      this.metrics.lastUpdate = new Date().toISOString();
    } catch (error) {
      console.error('Erro ao carregar métricas:', error.message);
    }
  }

  findPerformanceFiles() {
    const dir = path.dirname(this.config.performanceFile);
    const pattern = path.basename(this.config.performanceFile);
    
    if (!fs.existsSync(dir)) {
      return [];
    }
    
    const files = fs.readdirSync(dir)
      .filter(file => file.match(/baseline-.*\.json$/))
      .map(file => path.join(dir, file))
      .sort();
    
    return files;
  }

  generateHTML() {
    const performance = this.metrics.performance;
    const uptime = this.metrics.uptime;
    const resources = this.metrics.resources;
    
    return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>DisplayOps - Dashboard de Métricas</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #f5f5f5;
            color: #333;
            line-height: 1.6;
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
        }
        
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            border-radius: 10px;
            margin-bottom: 30px;
            text-align: center;
        }
        
        .header h1 {
            font-size: 2.5em;
            margin-bottom: 10px;
        }
        
        .header p {
            font-size: 1.2em;
            opacity: 0.9;
        }
        
        .metrics-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        
        .metric-card {
            background: white;
            padding: 25px;
            border-radius: 10px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            transition: transform 0.2s;
        }
        
        .metric-card:hover {
            transform: translateY(-2px);
        }
        
        .metric-header {
            display: flex;
            align-items: center;
            margin-bottom: 20px;
        }
        
        .metric-icon {
            font-size: 2em;
            margin-right: 15px;
        }
        
        .metric-title {
            font-size: 1.3em;
            font-weight: 600;
            color: #333;
        }
        
        .metric-value {
            font-size: 2.5em;
            font-weight: 700;
            margin-bottom: 10px;
        }
        
        .metric-label {
            color: #666;
            font-size: 0.9em;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        
        .metric-details {
            margin-top: 15px;
            padding-top: 15px;
            border-top: 1px solid #eee;
        }
        
        .detail-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 8px;
        }
        
        .detail-label {
            color: #666;
        }
        
        .detail-value {
            font-weight: 600;
        }
        
        .status-indicator {
            display: inline-block;
            width: 12px;
            height: 12px;
            border-radius: 50%;
            margin-right: 8px;
        }
        
        .status-good { background: #10b981; }
        .status-warning { background: #f59e0b; }
        .status-error { background: #ef4444; }
        
        .chart-container {
            background: white;
            padding: 25px;
            border-radius: 10px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            margin-bottom: 20px;
        }
        
        .chart-title {
            font-size: 1.3em;
            font-weight: 600;
            margin-bottom: 20px;
            color: #333;
        }
        
        .chart {
            height: 200px;
            background: #f8f9fa;
            border-radius: 5px;
            display: flex;
            align-items: end;
            padding: 20px;
            gap: 2px;
        }
        
        .chart-bar {
            flex: 1;
            background: linear-gradient(to top, #667eea, #764ba2);
            border-radius: 2px 2px 0 0;
            min-height: 10px;
        }
        
        .footer {
            text-align: center;
            color: #666;
            margin-top: 40px;
            padding: 20px;
        }
        
        .refresh-button {
            background: #667eea;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 5px;
            cursor: pointer;
            font-size: 1em;
            margin-top: 20px;
        }
        
        .refresh-button:hover {
            background: #5a67d8;
        }
        
        @media (max-width: 768px) {
            .metrics-grid {
                grid-template-columns: 1fr;
            }
            
            .header h1 {
                font-size: 2em;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📊 Dashboard de Métricas</h1>
            <p>DisplayOps Management System - Performance e Monitoramento</p>
            <p>Última atualização: ${this.metrics.lastUpdate || 'N/A'}</p>
        </div>
        
        <div class="metrics-grid">
            ${this.generatePerformanceCard(performance)}
            ${this.generateUptimeCard(uptime)}
            ${this.generateResourceCard(resources)}
            ${this.generateSystemCard()}
        </div>
        
        ${this.generateCharts()}
        
        <div class="footer">
            <button class="refresh-button" onclick="location.reload()">🔄 Atualizar</button>
            <p>DisplayOps Management System - ${new Date().getFullYear()}</p>
        </div>
    </div>
    
    <script>
        // Auto-refresh a cada 30 segundos
        setTimeout(() => {
            location.reload();
        }, 30000);
    </script>
</body>
</html>
    `;
  }

  generatePerformanceCard(performance) {
    if (!performance) {
      return `
        <div class="metric-card">
            <div class="metric-header">
                <div class="metric-icon">⚡</div>
                <div class="metric-title">Performance</div>
            </div>
            <div class="metric-value">N/A</div>
            <div class="metric-label">Dados não disponíveis</div>
        </div>
      `;
    }
    
    const tests = performance.tests;
    const discoveryLatency = tests.discoveryLatency?.averageLatency || 0;
    const commandLatency = tests.commandLatency?.averageLatency || 0;
    const throughput = tests.throughput?.throughput || 0;
    
    return `
        <div class="metric-card">
            <div class="metric-header">
                <div class="metric-icon">⚡</div>
                <div class="metric-title">Performance</div>
            </div>
            <div class="metric-value">${discoveryLatency.toFixed(1)}ms</div>
            <div class="metric-label">Latência de Descoberta</div>
            <div class="metric-details">
                <div class="detail-row">
                    <span class="detail-label">Comandos:</span>
                    <span class="detail-value">${commandLatency.toFixed(1)}ms</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Throughput:</span>
                    <span class="detail-value">${throughput.toFixed(1)} req/s</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Testes:</span>
                    <span class="detail-value">${Object.keys(tests).length}</span>
                </div>
            </div>
        </div>
    `;
  }

  generateUptimeCard(uptime) {
    if (!uptime) {
      return `
        <div class="metric-card">
            <div class="metric-header">
                <div class="metric-icon">⏱️</div>
                <div class="metric-title">Uptime</div>
            </div>
            <div class="metric-value">N/A</div>
            <div class="metric-label">Dados não disponíveis</div>
        </div>
      `;
    }
    
    const summary = uptime.summary;
    const uptimePercentage = summary.uptimePercentage || 0;
    const avgResponse = summary.averageResponseTime || 0;
    
    const statusClass = uptimePercentage >= 99 ? 'status-good' : 
                       uptimePercentage >= 95 ? 'status-warning' : 'status-error';
    
    return `
        <div class="metric-card">
            <div class="metric-header">
                <div class="metric-icon">⏱️</div>
                <div class="metric-title">Uptime</div>
            </div>
            <div class="metric-value">
                <span class="status-indicator ${statusClass}"></span>
                ${uptimePercentage.toFixed(2)}%
            </div>
            <div class="metric-label">Disponibilidade</div>
            <div class="metric-details">
                <div class="detail-row">
                    <span class="detail-label">Resposta Média:</span>
                    <span class="detail-value">${avgResponse.toFixed(0)}ms</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Total Checks:</span>
                    <span class="detail-value">${summary.totalChecks}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Falhas:</span>
                    <span class="detail-value">${summary.failedChecks}</span>
                </div>
            </div>
        </div>
    `;
  }

  generateResourceCard(resources) {
    if (!resources) {
      return `
        <div class="metric-card">
            <div class="metric-header">
                <div class="metric-icon">💾</div>
                <div class="metric-title">Recursos</div>
            </div>
            <div class="metric-value">N/A</div>
            <div class="metric-label">Dados não disponíveis</div>
        </div>
      `;
    }
    
    const summary = resources.summary;
    const avgCpu = summary.averageCpu || 0;
    const avgMemory = summary.averageMemory || 0;
    
    const cpuStatusClass = avgCpu <= 50 ? 'status-good' : 
                          avgCpu <= 80 ? 'status-warning' : 'status-error';
    const memoryStatusClass = avgMemory <= 70 ? 'status-good' : 
                             avgMemory <= 85 ? 'status-warning' : 'status-error';
    
    return `
        <div class="metric-card">
            <div class="metric-header">
                <div class="metric-icon">💾</div>
                <div class="metric-title">Recursos</div>
            </div>
            <div class="metric-value">
                <span class="status-indicator ${cpuStatusClass}"></span>
                ${avgCpu.toFixed(1)}%
            </div>
            <div class="metric-label">CPU Médio</div>
            <div class="metric-details">
                <div class="detail-row">
                    <span class="detail-label">CPU Pico:</span>
                    <span class="detail-value">${summary.peakCpu?.toFixed(1) || 0}%</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">RAM Média:</span>
                    <span class="detail-value">
                        <span class="status-indicator ${memoryStatusClass}"></span>
                        ${avgMemory.toFixed(1)}%
                    </span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">RAM Pico:</span>
                    <span class="detail-value">${summary.peakMemory?.toFixed(1) || 0}%</span>
                </div>
            </div>
        </div>
    `;
  }

  generateSystemCard() {
    const system = this.metrics.performance?.system || {};
    const platform = system.platform || 'Unknown';
    const nodeVersion = system.nodeVersion || 'Unknown';
    const cores = system.cpu?.cores || 0;
    
    return `
        <div class="metric-card">
            <div class="metric-header">
                <div class="metric-icon">🖥️</div>
                <div class="metric-title">Sistema</div>
            </div>
            <div class="metric-value">${platform}</div>
            <div class="metric-label">Plataforma</div>
            <div class="metric-details">
                <div class="detail-row">
                    <span class="detail-label">Node.js:</span>
                    <span class="detail-value">${nodeVersion}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">CPU Cores:</span>
                    <span class="detail-value">${cores}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Arquitetura:</span>
                    <span class="detail-value">${system.arch || 'Unknown'}</span>
                </div>
            </div>
        </div>
    `;
  }

  generateCharts() {
    const uptime = this.metrics.uptime;
    const resources = this.metrics.resources;
    
    if (!uptime && !resources) {
      return '';
    }
    
    let chartsHTML = '<div class="chart-container">';
    chartsHTML += '<div class="chart-title">📈 Histórico de Performance</div>';
    
    if (uptime) {
      const hourlyStats = this.analyzeHourlyStats(uptime.checks);
      chartsHTML += '<h3>Uptime por Hora</h3>';
      chartsHTML += '<div class="chart">';
      hourlyStats.forEach(stat => {
        const height = (stat.uptime / 100) * 100;
        chartsHTML += `<div class="chart-bar" style="height: ${height}%" title="${stat.hour}: ${stat.uptime.toFixed(1)}%"></div>`;
      });
      chartsHTML += '</div>';
    }
    
    if (resources) {
      const hourlyStats = this.analyzeResourceStats(resources.samples);
      chartsHTML += '<h3>CPU por Hora</h3>';
      chartsHTML += '<div class="chart">';
      hourlyStats.forEach(stat => {
        const height = (stat.avgCpu / 100) * 100;
        chartsHTML += `<div class="chart-bar" style="height: ${height}%" title="${stat.hour}: ${stat.avgCpu.toFixed(1)}%"></div>`;
      });
      chartsHTML += '</div>';
    }
    
    chartsHTML += '</div>';
    return chartsHTML;
  }

  analyzeHourlyStats(checks) {
    if (!checks || !Array.isArray(checks)) return [];
    
    const hourlyData = {};
    checks.forEach(check => {
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
        uptime: (data.success / data.total) * 100
      }))
      .sort((a, b) => a.hour.localeCompare(b.hour));
  }

  analyzeResourceStats(samples) {
    if (!samples || !Array.isArray(samples)) return [];
    
    const hourlyData = {};
    samples.forEach(sample => {
      const hour = new Date(sample.timestamp).getHours();
      if (!hourlyData[hour]) {
        hourlyData[hour] = { cpu: [] };
      }
      hourlyData[hour].cpu.push(sample.cpu.usage);
    });
    
    return Object.entries(hourlyData)
      .map(([hour, data]) => ({
        hour: `${hour.padStart(2, '0')}:00`,
        avgCpu: data.cpu.reduce((a, b) => a + b, 0) / data.cpu.length
      }))
      .sort((a, b) => a.hour.localeCompare(b.hour));
  }

  start() {
    const server = http.createServer((req, res) => {
      const parsedUrl = url.parse(req.url, true);
      
      if (parsedUrl.pathname === '/') {
        this.loadMetrics();
        const html = this.generateHTML();
        
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(html);
      } else if (parsedUrl.pathname === '/api/metrics') {
        this.loadMetrics();
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(this.metrics, null, 2));
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
      }
    });
    
    server.listen(this.config.port, () => {
      console.log(`🚀 Dashboard de métricas rodando em http://localhost:${this.config.port}`);
      console.log(`📊 API de métricas disponível em http://localhost:${this.config.port}/api/metrics`);
    });
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  const dashboard = new MetricsDashboard();
  dashboard.start();
}

module.exports = MetricsDashboard;
