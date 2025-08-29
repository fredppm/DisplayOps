export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3
}

class Logger {
  private level: LogLevel;

  constructor() {
    // Get log level from environment variable, default to INFO
    const envLevel = process.env.LOG_LEVEL?.toUpperCase();
    this.level = envLevel ? LogLevel[envLevel as keyof typeof LogLevel] || LogLevel.INFO : LogLevel.INFO;
  }

  private shouldLog(level: LogLevel): boolean {
    return level <= this.level;
  }

  private formatMessage(level: string, message: string, ...args: any[]): string {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    return `[${timestamp}] [${level}] ${message}`;
  }

  error(message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      console.error(this.formatMessage('ERROR', message), ...args);
    }
  }

  warn(message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.WARN)) {
      console.warn(this.formatMessage('WARN', message), ...args);
    }
  }

  info(message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.INFO)) {
      console.log(this.formatMessage('INFO', message), ...args);
    }
  }

  debug(message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.log(this.formatMessage('DEBUG', message), ...args);
    }
  }

  // Special method for important system messages (always shown)
  system(message: string, ...args: any[]): void {
    console.log(`🚀 ${message}`, ...args);
  }

  // Special method for success messages (always shown)
  success(message: string, ...args: any[]): void {
    console.log(`✅ ${message}`, ...args);
  }

  // Special method for error messages (always shown)
  critical(message: string, ...args: any[]): void {
    console.error(`❌ ${message}`, ...args);
  }
}

export const logger = new Logger();
