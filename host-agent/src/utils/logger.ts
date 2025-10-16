import log from 'electron-log';

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3
}

export interface LogEntry {
  id: string;
  timestamp: Date;
  level: string;
  category: string;
  message: string;
  details?: string;
}

class Logger {
  private level: LogLevel;
  private logs: LogEntry[] = [];
  private maxLogs: number = 1000; // Keep last 1000 logs in memory
  private logCounter: number = 0;

  constructor() {
    // Get log level from environment variable, default to INFO
    const envLevel = process.env.LOG_LEVEL?.toUpperCase();
    this.level = envLevel ? LogLevel[envLevel as keyof typeof LogLevel] || LogLevel.INFO : LogLevel.INFO;
    
    // Configure electron-log to write everything
    log.transports.file.level = 'debug';
    log.transports.console.level = 'debug';
  }

  private shouldLog(level: LogLevel): boolean {
    return level <= this.level;
  }

  private formatMessage(level: string, message: string, ...args: any[]): string {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    return `[${timestamp}] [${level}] ${message}`;
  }

  private addLog(level: string, category: string, message: string, ...args: any[]): void {
    this.logCounter++;
    const logEntry: LogEntry = {
      id: `log_${this.logCounter}_${Date.now()}`,
      timestamp: new Date(),
      level,
      category,
      message,
      details: args.length > 0 ? JSON.stringify(args) : undefined
    };

    this.logs.push(logEntry);

    // Keep only the last N logs (circular buffer)
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }
  }

  public getLogs(limit?: number, levelFilter?: string, since?: Date): LogEntry[] {
    let filteredLogs = this.logs;

    // Filter by level
    if (levelFilter && levelFilter !== 'ALL') {
      filteredLogs = filteredLogs.filter(log => log.level === levelFilter);
    }

    // Filter by timestamp
    if (since) {
      filteredLogs = filteredLogs.filter(log => log.timestamp >= since);
    }

    // Return most recent logs first, limited by count
    const result = filteredLogs.slice();
    result.reverse();
    return limit ? result.slice(0, limit) : result;
  }

  public clearLogs(): void {
    this.logs = [];
    this.logCounter = 0;
  }

  error(message: string, ...args: any[]): void {
    this.addLog('ERROR', 'system', message, ...args);
    if (this.shouldLog(LogLevel.ERROR)) {
      log.error(message, ...args);
    }
  }

  warn(message: string, ...args: any[]): void {
    this.addLog('WARN', 'system', message, ...args);
    if (this.shouldLog(LogLevel.WARN)) {
      log.warn(message, ...args);
    }
  }

  info(message: string, ...args: any[]): void {
    this.addLog('INFO', 'system', message, ...args);
    if (this.shouldLog(LogLevel.INFO)) {
      log.info(message, ...args);
    }
  }

  debug(message: string, ...args: any[]): void {
    this.addLog('DEBUG', 'system', message, ...args);
    if (this.shouldLog(LogLevel.DEBUG)) {
      log.debug(message, ...args);
    }
  }

  // Special method for important system messages (always shown)
  system(message: string, ...args: any[]): void {
    this.addLog('INFO', 'system', `🚀 ${message}`, ...args);
    log.info(`🚀 ${message}`, ...args);
  }

  // Special method for success messages (always shown)
  success(message: string, ...args: any[]): void {
    this.addLog('INFO', 'system', `✅ ${message}`, ...args);
    log.info(`✅ ${message}`, ...args);
  }

  // Special method for error messages (always shown)
  critical(message: string, ...args: any[]): void {
    this.addLog('ERROR', 'system', `❌ ${message}`, ...args);
    log.error(`❌ ${message}`, ...args);
  }
}

export const logger = new Logger();
