// Server-side helper functions for getServerSideProps
// Reads directly from JSON files for Server-Side Rendering
// Note: Cannot make HTTP calls to ourselves during SSR, so we read files directly

// System stats para admin dashboard
export async function getSystemStats() {
  // Dados simples - pode evoluir depois para integrar com banco/APIs reais
  return {
    totalUsers: 4,
    totalSites: 2, 
    totalControllers: 3,
    systemStatus: 'Online',
    timestamp: new Date().toISOString()
  };
}

// Performance metrics iniciais 
export async function getPerformanceMetrics() {
  // Dados de exemplo - na real integração pode chamar APIs internas
  return {
    uptime: 86400, // 1 day in seconds
    system: {
      cpuUsage: 45.2,
      memoryUsage: 62.8,
      loadAverage: 1.2,
    },
    api: {
      averageResponseTime: 120,
      totalRequests: 1543,
      errorRate: 0.8,
      requestsPerMinute: 45,
    },
    application: {
      activeSessions: 23,
      activeConnections: 8,
      errorRate: 0.2,
      requestsPerMinute: 42,
    },
    timestamp: Date.now()
  };
}

// Active alerts iniciais
export async function getActiveAlerts() {
  // Dados de exemplo com alertas simulados
  const sampleAlerts = [
    {
      id: 'alert-1',
      ruleId: 'rule-1',
      ruleName: 'High CPU Usage',
      message: 'CPU usage has exceeded 80% for over 5 minutes',
      severity: 'high' as 'low' | 'medium' | 'high' | 'critical',
      metric: 'system.cpu.usage',
      currentValue: 85.2,
      threshold: 80,
      timestamp: new Date(Date.now() - 300000).toISOString(), // 5 min ago
      acknowledged: false,
      resolved: false
    },
    {
      id: 'alert-2', 
      ruleId: 'rule-2',
      ruleName: 'API Response Time',
      message: 'API response time is above acceptable limits',
      severity: 'medium' as 'low' | 'medium' | 'high' | 'critical',
      metric: 'api.response_time',
      currentValue: 1250,
      threshold: 1000,
      timestamp: new Date(Date.now() - 180000).toISOString(), // 3 min ago
      acknowledged: true,
      acknowledgedBy: 'admin@displayops.com',
      acknowledgedAt: new Date(Date.now() - 120000).toISOString(), // 2 min ago
      resolved: false
    }
  ];

  const sampleRules = [
    {
      id: 'rule-1',
      name: 'High CPU Usage',
      description: 'Alert when CPU usage exceeds threshold',
      metric: 'system.cpu.usage',
      condition: 'greater_than' as 'greater_than' | 'less_than' | 'equals',
      threshold: 80,
      severity: 'high' as 'low' | 'medium' | 'high' | 'critical',
      enabled: true,
      cooldownMinutes: 5,
      notificationChannels: ['email', 'slack'],
      createdAt: new Date(Date.now() - 86400000).toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'rule-2',
      name: 'API Response Time',
      description: 'Monitor API performance',
      metric: 'api.response_time',
      condition: 'greater_than' as 'greater_than' | 'less_than' | 'equals',
      threshold: 1000,
      severity: 'medium' as 'low' | 'medium' | 'high' | 'critical',
      enabled: true,
      cooldownMinutes: 10,
      notificationChannels: ['email'],
      createdAt: new Date(Date.now() - 172800000).toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'rule-3',
      name: 'Disk Space Low',
      description: 'Alert when disk space is running low',
      metric: 'system.disk.usage',
      condition: 'greater_than' as 'greater_than' | 'less_than' | 'equals',
      threshold: 90,
      severity: 'critical' as 'low' | 'medium' | 'high' | 'critical',
      enabled: false,
      cooldownMinutes: 15,
      notificationChannels: ['email', 'slack', 'webhook'],
      createdAt: new Date(Date.now() - 259200000).toISOString(),
      updatedAt: new Date(Date.now() - 3600000).toISOString()
    }
  ];

  return {
    activeAlerts: sampleAlerts,
    stats: {
      totalRules: sampleRules.length,
      activeRules: sampleRules.filter(r => r.enabled).length,
      activeAlerts: sampleAlerts.filter(a => !a.resolved).length,
      criticalAlerts: sampleAlerts.filter(a => a.severity === 'critical' && !a.resolved).length,
      recentAlerts24h: sampleAlerts.filter(a => new Date(a.timestamp) > new Date(Date.now() - 86400000)).length
    },
    alertHistory: {
      alerts: sampleAlerts,
      totalCount: sampleAlerts.length,
      unacknowledgedCount: sampleAlerts.filter(a => !a.acknowledged).length,
      criticalCount: sampleAlerts.filter(a => a.severity === 'critical').length,
      highCount: sampleAlerts.filter(a => a.severity === 'high').length,
      mediumCount: sampleAlerts.filter(a => a.severity === 'medium').length,
      lowCount: sampleAlerts.filter(a => a.severity === 'low').length
    },
    alertRules: sampleRules,
    timestamp: new Date().toISOString()
  };
}

// Monitoring dashboard data
export async function getMonitoringData() {
  return {
    metrics: {
      overview: {
        uptime: '2d 14h 32m',
        totalRequests: 15430,
        averageResponseTime: 125,
        errorRate: 0.8,
        currentLoad: 1.2
      },
      realtime: {
        requestsPerMinute: 45,
        activeConnections: 8,
        activeSessions: 23,
        memoryUsage: 62.8,
        cpuUsage: 45.2
      },
      topEndpoints: [
        {
          endpoint: '/api/hosts',
          method: 'GET',
          requests: 2340,
          averageTime: 95,
          errorRate: 0.2
        },
        {
          endpoint: '/api/dashboards',
          method: 'GET', 
          requests: 1892,
          averageTime: 132,
          errorRate: 0.5
        }
      ],
      systemHealth: 'healthy' as 'healthy' | 'warning' | 'critical'
    },
    alerts: [],
    alertStats: {
      totalRules: 12,
      activeRules: 8,
      activeAlerts: 0,
      criticalAlerts: 0,
      recentAlerts24h: 3
    },
    timestamp: new Date().toISOString()
  };
}

// Type definitions for server-side props
export interface SystemStatsProps {
  totalUsers: number;
  totalSites: number;
  totalControllers: number;
  systemStatus: string;
  timestamp: string;
}

export interface PerformanceMetricsProps {
  uptime: number;
  system: {
    cpuUsage: number;
    memoryUsage: number;
    loadAverage: number;
  };
  api: {
    averageResponseTime: number;
    totalRequests: number;
    errorRate: number;
    requestsPerMinute: number;
  };
  application: {
    activeSessions: number;
    activeConnections: number;
    errorRate: number;
    requestsPerMinute: number;
  };
  timestamp: number;
}

// Controllers data
export async function getControllers() {
  // For server-side rendering, read hosts directly and convert to controllers format
  // Cannot make HTTP calls to ourselves during SSR
  const fs = await import('fs/promises');
  const path = await import('path');
  
  try {
    const HOSTS_FILE = path.join(process.cwd(), 'data', 'hosts.json');
    const data = await fs.readFile(HOSTS_FILE, 'utf-8');
    const hostsData = JSON.parse(data);
    
    // Convert hosts to controllers format
    const controllers = hostsData.hosts.map((host: any) => ({
      id: host.id,
      siteId: host.siteId,
      name: host.name,
      localNetwork: `${host.ip}/24`, // Assume /24 network
      mdnsService: '_displayops._tcp.local.',
      controllerUrl: `http://${host.ip}:3000`,
      status: host.status,
      lastSync: host.lastSeen,
      version: '1.2.3' // Default version
    }));
    
    return {
      controllers: controllers || [],
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error reading controllers data:', error);
    return {
      controllers: [],
      timestamp: new Date().toISOString()
    };
  }
}

// Sites data 
export async function getSites() {
  // For server-side rendering, we need to read directly from file
  // Cannot make HTTP calls to ourselves during SSR
  const fs = await import('fs/promises');
  const path = await import('path');
  
  try {
    const SITES_FILE = path.join(process.cwd(), 'data', 'sites.json');
    const fileData = await fs.readFile(SITES_FILE, 'utf-8');
    const sitesData = JSON.parse(fileData);
    
    return {
      sites: sitesData.sites || [],
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error reading sites data:', error);
    return {
      sites: [],
      timestamp: new Date().toISOString()
    };
  }
}

// Função auxiliar para simular delay (opcional, para testar loading states)
export function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}