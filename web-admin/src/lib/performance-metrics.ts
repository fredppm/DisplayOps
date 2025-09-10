import { NextApiRequest, NextApiResponse } from 'next';
import os from 'os';

/**
 * Performance metrics interfaces
 */
export interface ApiMetrics {
  endpoint: string;
  method: string;
  responseTime: number;
  statusCode: number;
  timestamp: number;
  userAgent?: string;
  ip?: string;
}

export interface SystemMetrics {
  cpu: {
    usage: number;
    loadAverage: number[];
  };
  memory: {
    total: number;
    used: number;
    free: number;
    percentage: number;
  };
  uptime: number;
  timestamp: number;
}

export interface ApplicationMetrics {
  activeSessions: number;
  activeConnections: number;
  errors: {
    total: number;
    rate: number;
    last24h: number;
  };
  requests: {
    total: number;
    perMinute: number;
    last24h: number;
  };
  timestamp: number;
}

export interface PerformanceStats {
  api: {
    endpoints: Map<string, ApiMetrics[]>;
    summary: {
      averageResponseTime: number;
      totalRequests: number;
      errorRate: number;
      requestsPerMinute: number;
    };
  };
  system: SystemMetrics;
  application: ApplicationMetrics;
  startTime: number;
}

/**
 * Performance metrics collector
 */
class PerformanceMetricsCollector {
  private metrics: PerformanceStats;
  private maxEntries: number = 1000;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.metrics = {
      api: {
        endpoints: new Map(),
        summary: {
          averageResponseTime: 0,
          totalRequests: 0,
          errorRate: 0,
          requestsPerMinute: 0
        }
      },
      system: this.getSystemMetrics(),
      application: {
        activeSessions: 0,
        activeConnections: 0,
        errors: { total: 0, rate: 0, last24h: 0 },
        requests: { total: 0, perMinute: 0, last24h: 0 },
        timestamp: Date.now()
      },
      startTime: Date.now()
    };

    // Auto-cleanup old metrics every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }

  /**
   * Record API metrics
   */
  recordApiCall(metrics: ApiMetrics): void {
    const key = `${metrics.method} ${metrics.endpoint}`;
    
    if (!this.metrics.api.endpoints.has(key)) {
      this.metrics.api.endpoints.set(key, []);
    }

    const endpointMetrics = this.metrics.api.endpoints.get(key)!;
    endpointMetrics.push(metrics);

    // Keep only recent entries per endpoint
    if (endpointMetrics.length > this.maxEntries) {
      endpointMetrics.splice(0, endpointMetrics.length - this.maxEntries);
    }

    // Update application metrics
    this.metrics.application.requests.total++;
    this.metrics.application.timestamp = Date.now();

    if (metrics.statusCode >= 400) {
      this.metrics.application.errors.total++;
    }

    this.updateSummaryMetrics();
  }

  /**
   * Get current system metrics
   */
  getSystemMetrics(): SystemMetrics {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;

    return {
      cpu: {
        usage: this.getCpuUsage(),
        loadAverage: os.loadavg()
      },
      memory: {
        total: totalMem,
        used: usedMem,
        free: freeMem,
        percentage: (usedMem / totalMem) * 100
      },
      uptime: os.uptime(),
      timestamp: Date.now()
    };
  }

  /**
   * Update session count
   */
  updateSessionCount(count: number): void {
    this.metrics.application.activeSessions = count;
    this.metrics.application.timestamp = Date.now();
  }

  /**
   * Update connection count
   */
  updateConnectionCount(count: number): void {
    this.metrics.application.activeConnections = count;
    this.metrics.application.timestamp = Date.now();
  }

  /**
   * Get all metrics
   */
  getMetrics(): PerformanceStats {
    // Update system metrics
    this.metrics.system = this.getSystemMetrics();
    
    // Calculate rates
    this.calculateRates();
    
    return JSON.parse(JSON.stringify(this.metrics));
  }

  /**
   * Get endpoint-specific metrics
   */
  getEndpointMetrics(method: string, endpoint: string): ApiMetrics[] {
    const key = `${method} ${endpoint}`;
    return this.metrics.api.endpoints.get(key) || [];
  }

  /**
   * Get metrics summary
   */
  getSummary() {
    const now = Date.now();
    const uptime = now - this.metrics.startTime;
    
    return {
      uptime: Math.floor(uptime / 1000),
      system: {
        cpuUsage: this.metrics.system.cpu.usage,
        memoryUsage: this.metrics.system.memory.percentage,
        loadAverage: this.metrics.system.cpu.loadAverage[0]
      },
      api: this.metrics.api.summary,
      application: {
        activeSessions: this.metrics.application.activeSessions,
        activeConnections: this.metrics.application.activeConnections,
        errorRate: this.metrics.api.summary.errorRate,
        requestsPerMinute: this.metrics.api.summary.requestsPerMinute
      },
      timestamp: now
    };
  }

  /**
   * Clean up old metrics
   */
  cleanup(): void {
    const cutoff = Date.now() - (24 * 60 * 60 * 1000); // 24 hours ago
    
    this.metrics.api.endpoints.forEach((metrics, key) => {
      const filtered = metrics.filter(m => m.timestamp > cutoff);
      if (filtered.length === 0) {
        this.metrics.api.endpoints.delete(key);
      } else {
        this.metrics.api.endpoints.set(key, filtered);
      }
    });
    
    this.updateSummaryMetrics();
  }

  /**
   * Update summary metrics
   */
  private updateSummaryMetrics(): void {
    let totalRequests = 0;
    let totalResponseTime = 0;
    let errorCount = 0;
    const now = Date.now();
    const oneMinuteAgo = now - (60 * 1000);

    this.metrics.api.endpoints.forEach(metrics => {
      metrics.forEach(metric => {
        totalRequests++;
        totalResponseTime += metric.responseTime;
        
        if (metric.statusCode >= 400) {
          errorCount++;
        }
      });
    });

    // Calculate requests per minute
    let recentRequests = 0;
    this.metrics.api.endpoints.forEach(metrics => {
      recentRequests += metrics.filter(m => m.timestamp > oneMinuteAgo).length;
    });

    this.metrics.api.summary = {
      averageResponseTime: totalRequests > 0 ? totalResponseTime / totalRequests : 0,
      totalRequests,
      errorRate: totalRequests > 0 ? (errorCount / totalRequests) * 100 : 0,
      requestsPerMinute: recentRequests
    };

    // Update application rates
    const last24h = now - (24 * 60 * 60 * 1000);
    this.metrics.application.requests.last24h = totalRequests;
    this.metrics.application.errors.last24h = errorCount;
    this.metrics.application.requests.perMinute = recentRequests;
    this.metrics.application.errors.rate = this.metrics.api.summary.errorRate;
  }

  /**
   * Calculate rates for the last period
   */
  private calculateRates(): void {
    const now = Date.now();
    const oneMinuteAgo = now - (60 * 1000);
    const oneHourAgo = now - (60 * 60 * 1000);

    // Calculate requests and errors in the last minute and hour
    let requestsLastMinute = 0;
    let errorsLastMinute = 0;

    this.metrics.api.endpoints.forEach(metrics => {
      metrics.forEach(metric => {
        if (metric.timestamp > oneMinuteAgo) {
          requestsLastMinute++;
          if (metric.statusCode >= 400) {
            errorsLastMinute++;
          }
        }
      });
    });

    this.metrics.application.requests.perMinute = requestsLastMinute;
    this.metrics.application.errors.rate = requestsLastMinute > 0 ? 
      (errorsLastMinute / requestsLastMinute) * 100 : 0;
  }

  /**
   * Get CPU usage (simplified)
   */
  private getCpuUsage(): number {
    // This is a simplified CPU usage calculation
    // In production, you might want to use a more accurate method
    const cpus = os.cpus();
    let user = 0;
    let nice = 0;
    let sys = 0;
    let idle = 0;
    let irq = 0;
    
    cpus.forEach(cpu => {
      user += cpu.times.user;
      nice += cpu.times.nice;
      sys += cpu.times.sys;
      idle += cpu.times.idle;
      irq += cpu.times.irq;
    });
    
    const total = user + nice + sys + idle + irq;
    const usage = 100 - (100 * idle / total);
    
    return isNaN(usage) ? 0 : Math.round(usage * 100) / 100;
  }

  /**
   * Destroy the collector
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}

// Global instance
const performanceCollector = new PerformanceMetricsCollector();

/**
 * Middleware to collect API performance metrics
 */
export function withPerformanceMetrics<T = any>(
  handler: (req: NextApiRequest, res: NextApiResponse<T>) => Promise<void> | void
) {
  return async (req: NextApiRequest, res: NextApiResponse<T>) => {
    const startTime = Date.now();
    
    // Override res.end to capture metrics
    const originalEnd = res.end;
    let endCalled = false;
    
    res.end = function(chunk?: any, encoding?: any) {
      if (!endCalled) {
        endCalled = true;
        const endTime = Date.now();
        const responseTime = endTime - startTime;
        
        // Record the API call metrics
        performanceCollector.recordApiCall({
          endpoint: req.url || '',
          method: req.method || 'GET',
          responseTime,
          statusCode: res.statusCode,
          timestamp: startTime,
          userAgent: req.headers['user-agent'],
          ip: (req.headers['x-forwarded-for'] as string)?.split(',')[0] || 
              req.connection?.remoteAddress
        });
      }
      
      return originalEnd.call(this, chunk, encoding);
    };
    
    try {
      await handler(req, res);
    } catch (error) {
      // Ensure metrics are recorded even if handler throws
      if (!endCalled) {
        res.statusCode = 500;
        res.end();
      }
      throw error;
    }
  };
}

export { performanceCollector };