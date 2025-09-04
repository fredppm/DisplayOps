// Client-side fallback logger
const createClientLogger = () => ({
  error: (message: string, meta?: any) => console.error(message, meta),
  warn: (message: string, meta?: any) => console.warn(message, meta),
  info: (message: string, meta?: any) => console.info(message, meta),
  debug: (message: string, meta?: any) => console.debug(message, meta),
  child: () => createClientLogger()
});

// Server-side winston import
let winston: any = null;
if (typeof window === 'undefined') {
  winston = require('winston');
}

import { globalThrottler } from './log-throttler';

// Environment-based log level configuration
const getLogLevel = () => {
  const level = process.env.LOG_LEVEL || 'info';
  if (process.env.NODE_ENV === 'production' && level === 'debug') {
    return 'info'; // Prevent debug in production unless explicitly set
  }
  return level;
};

// Context-specific log level overrides for web-controller
const getContextLogLevel = (context: string): string => {
  const contextLevels: Record<string, string> = {
    discovery: process.env.LOG_DISCOVERY === 'false' ? 'silent' : 
               process.env.LOG_DISCOVERY_LEVEL || 'info',
    grpc: process.env.LOG_GRPC_LEVEL || 'info',
    'auto-register': process.env.LOG_AUTO_REGISTER_LEVEL || 'info',
    'auto-init': process.env.LOG_AUTO_INIT_LEVEL || 'info',
    'dashboard-manager': process.env.LOG_DASHBOARD_MANAGER_LEVEL || 'info',
    'auth-manager': process.env.LOG_AUTH_MANAGER_LEVEL || 'info',
    'extension-dropdown': process.env.LOG_EXTENSION_DROPDOWN_LEVEL || 'info',
  };
  
  return contextLevels[context] || getLogLevel();
};

// Create logger instance
const logger = winston ? winston.createLogger({
  level: getLogLevel(),
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { 
    service: 'web-controller'
  },
  transports: [
    // Console with enhanced format for development
    new winston.transports.Console({
      level: getLogLevel(),
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp({ format: 'HH:mm:ss' }),
        winston.format.printf(({ timestamp, level, message, context, ...meta }) => {
          const contextStr = context ? `[${context}]` : '';
          const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
          return `${timestamp} ${level}${contextStr}: ${message}${metaStr}`;
        })
      )
    }),
    
    // Write logs to files
    new winston.transports.File({ 
      filename: 'logs/error.log', 
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    new winston.transports.File({ 
      filename: 'logs/combined.log',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    })
  ],
  
  // Don't exit on uncaught exceptions
  exitOnError: false
}) : createClientLogger();

// Handle uncaught exceptions and unhandled rejections (server-side only)
if (typeof window === 'undefined' && winston) {
  logger.exceptions.handle(
    new winston.transports.File({ filename: 'logs/exceptions.log' })
  );
}

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', { promise, reason });
});

// Level priority mapping for comparisons
const levelPriority: Record<string, number> = {
  silent: -1,
  error: 0,
  warn: 1,
  info: 2,
  debug: 3
};

// Check if a level should be logged based on current logger level
const shouldLogLevel = (targetLevel: string, contextLevel: string): boolean => {
  if (contextLevel === 'silent') return false;
  
  const currentPriority = levelPriority[getLogLevel()] || 2;
  const targetPriority = levelPriority[targetLevel] || 2;
  const contextPriority = levelPriority[contextLevel] || 2;
  
  // Use the more restrictive of global or context level
  const effectivePriority = Math.min(currentPriority, contextPriority);
  
  return targetPriority <= effectivePriority;
};

// Context-aware logging functions
const createContextLogger = (context: string) => {
  const contextLevel = getContextLogLevel(context);
  
  return {
    debug: (message: string, meta?: any) => {
      if (shouldLogLevel('debug', contextLevel)) {
        const key = `${context}:debug:${message}`;
        if (globalThrottler.shouldLog(key, message, meta)) {
          logger.debug(message, { context, ...meta });
        }
      }
    },
    info: (message: string, meta?: any) => {
      if (shouldLogLevel('info', contextLevel)) {
        const key = `${context}:info:${message}`;
        if (globalThrottler.shouldLog(key, message, meta)) {
          logger.info(message, { context, ...meta });
        }
      }
    },
    warn: (message: string, meta?: any) => {
      if (shouldLogLevel('warn', contextLevel)) {
        logger.warn(message, { context, ...meta });
      }
    },
    error: (message: string, meta?: any) => {
      if (shouldLogLevel('error', contextLevel)) {
        logger.error(message, { context, ...meta });
      }
    }
  };
};

// Throttled logging for repetitive events
const throttledLog = {
  info: (key: string, message: string, meta?: any) => {
    if (globalThrottler.shouldLog(key, message, meta)) {
      logger.info(message, meta);
    }
  },
  debug: (key: string, message: string, meta?: any) => {
    if (globalThrottler.shouldLog(key, message, meta)) {
      logger.debug(message, meta);
    }
  },
  warn: (key: string, message: string, meta?: any) => {
    if (globalThrottler.shouldLog(key, message, meta)) {
      logger.warn(message, meta);
    }
  }
};

export { logger, createContextLogger, throttledLog, getContextLogLevel };
export default logger;