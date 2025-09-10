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

  shouldLog(key: string, message: string, data?: any): boolean {
    const now = Date.now();
    const entry = this.entries.get(key);

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

    if (now - entry.lastLogged >= this.intervalMs) {
      entry.lastLogged = now;
      entry.count = 1;
      return true;
    }

    return false;
  }

  getStats(): { key: string; count: number; message: string }[] {
    return Array.from(this.entries.entries()).map(([key, entry]) => ({
      key,
      count: entry.count,
      message: entry.message
    }));
  }

  private startSummaryTimer() {
    this.summaryTimer = setInterval(() => {
      this.logSummary();
    }, this.intervalMs);
  }

  private logSummary() {
    const suppressedLogs = Array.from(this.entries.entries())
      .filter(([_, entry]) => entry.count > 1)
      .map(([key, entry]) => `${key}: ${entry.count} times`);

    if (suppressedLogs.length > 0) {
      const { logger } = require('./logger');
      logger.debug('Suppressed repeated logs in last interval', {
        interval: `${this.intervalMs}ms`,
        suppressedLogs
      });
    }

    // Reset counts
    this.entries.forEach(entry => {
      entry.count = 0;
    });
  }

  destroy() {
    if (this.summaryTimer) {
      clearInterval(this.summaryTimer);
    }
  }
}

// Global throttler instance
const globalThrottler = new LogThrottler({
  intervalMs: 30000, // 30 seconds
  enableSummary: process.env.NODE_ENV !== 'production'
});

export { LogThrottler, globalThrottler };
export default globalThrottler;