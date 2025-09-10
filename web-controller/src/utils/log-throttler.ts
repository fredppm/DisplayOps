interface ThrottledLogEntry {
  message: string;
  lastLogged: number;
  count: number;
  data?: any;
}

interface ThrottlerOptions {
  intervalMs?: number;
  maxMessages?: number;
  enableSummary?: boolean;
}

class LogThrottler {
  private entries = new Map<string, ThrottledLogEntry>();
  private intervalMs: number;
  private maxMessages: number;
  private enableSummary: boolean;
  private summaryTimer?: NodeJS.Timeout;

  constructor(options: ThrottlerOptions = {}) {
    this.intervalMs = options.intervalMs || 30000; // 30 seconds default
    this.maxMessages = options.maxMessages || 1;
    this.enableSummary = options.enableSummary ?? true;
    
    if (this.enableSummary) {
      this.startSummaryTimer();
    }
  }

  // Context-based throttling intervals
  private getContextInterval(context: string): number {
    const intervals: Record<string, number> = {
      'api-discovery-events': 60000, // Heartbeats - 1 minute
      'grpc-client': 45000, // gRPC events - 45 seconds  
      'windows-discovery': 45000, // Discovery events - 45 seconds
      'mdns-discovery': 90000, // mDNS - 90 seconds (less frequent)
      'discovery': 30000, // General discovery - 30 seconds
      'app': 5000, // App events - 5 seconds (should be rare)
    };
    
    return intervals[context] || this.intervalMs;
  }

  shouldLog(key: string, message: string, data?: any): boolean {
    const now = Date.now();
    const entry = this.entries.get(key);
    
    // Extract context from key (format: "context:level:message")
    const context = key.split(':')[0] || 'default';
    const contextInterval = this.getContextInterval(context);

    if (!entry) {
      this.entries.set(key, {
        message,
        lastLogged: now,
        count: 1,
        data
      });
      return true;
    }

    entry.count++;
    entry.data = data; // Update with latest data

    if (now - entry.lastLogged >= contextInterval) {
      entry.lastLogged = now;
      entry.count = 1;
      return true;
    }

    return false;
  }


  private startSummaryTimer() {
    this.summaryTimer = setInterval(() => {
      this.logSummary();
    }, this.intervalMs);
  }

  private logSummary() {
    const suppressedByContext = new Map<string, Array<{key: string, count: number}>>();
    
    // Group suppressed logs by context
    Array.from(this.entries.entries())
      .filter(([_, entry]) => entry.count > 1)
      .forEach(([key, entry]) => {
        const context = key.split(':')[0] || 'default';
        if (!suppressedByContext.has(context)) {
          suppressedByContext.set(context, []);
        }
        suppressedByContext.get(context)!.push({ key, count: entry.count });
      });

    // Log summary per context (if any)
    if (suppressedByContext.size > 0) {
      suppressedByContext.forEach((logs, context) => {
        const { logger } = require('./logger');
        const suppressedLogs = logs.map(log => `${log.key}: ${log.count} times`);
        
        logger.debug(`[${context}] Suppressed repeated logs in last interval`, {
          interval: `${this.getContextInterval(context)}ms`,
          suppressedLogs
        });
      });
    }

    // Reset counts
    this.entries.forEach(entry => {
      entry.count = 0;
    });
  }

}

// Global throttler instance
const globalThrottler = new LogThrottler({
  intervalMs: 30000, // 30 seconds
  enableSummary: process.env.NODE_ENV !== 'production'
});

export { LogThrottler, globalThrottler };
export default globalThrottler;