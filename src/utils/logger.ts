
import { Request, Response } from 'express';

export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug',
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  service: string;
  userId?: string;
  requestId?: string;
  metadata?: Record<string, any>;
}

class Logger {
  private service: string;

  constructor(service: string = 'BrillPrime-API') {
    this.service = service;
  }

  private formatLog(level: LogLevel, message: string, metadata?: Record<string, any>): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      service: this.service,
      metadata,
    };
  }

  private write(logEntry: LogEntry): void {
    const logString = JSON.stringify(logEntry);
    
    // In production, you might want to send logs to external services
    if (process.env.NODE_ENV === 'production') {
      // TODO: Send to external logging service (e.g., CloudWatch, Datadog)
      console.log(logString);
    } else {
      // Development logging with colors
      const colors = {
        [LogLevel.ERROR]: '\x1b[31m', // Red
        [LogLevel.WARN]: '\x1b[33m',  // Yellow
        [LogLevel.INFO]: '\x1b[36m',  // Cyan
        [LogLevel.DEBUG]: '\x1b[37m', // White
      };
      const reset = '\x1b[0m';
      
      console.log(
        `${colors[logEntry.level]}[${logEntry.level.toUpperCase()}]${reset} ` +
        `${logEntry.timestamp} - ${logEntry.message}` +
        (logEntry.metadata ? ` | ${JSON.stringify(logEntry.metadata)}` : '')
      );
    }
  }

  error(message: string, metadata?: Record<string, any>): void {
    this.write(this.formatLog(LogLevel.ERROR, message, metadata));
  }

  warn(message: string, metadata?: Record<string, any>): void {
    this.write(this.formatLog(LogLevel.WARN, message, metadata));
  }

  info(message: string, metadata?: Record<string, any>): void {
    this.write(this.formatLog(LogLevel.INFO, message, metadata));
  }

  debug(message: string, metadata?: Record<string, any>): void {
    if (process.env.NODE_ENV === 'development') {
      this.write(this.formatLog(LogLevel.DEBUG, message, metadata));
    }
  }

  // Request logging middleware
  requestLogger() {
    return (req: Request, res: Response, next: Function) => {
      const startTime = Date.now();
      const requestId = Math.random().toString(36).substring(7);
      
      // Add request ID to request object
      (req as any).requestId = requestId;

      this.info('Request started', {
        requestId,
        method: req.method,
        url: req.url,
        userAgent: req.get('User-Agent'),
        ip: req.ip,
      });

      // Log response when finished
      res.on('finish', () => {
        const duration = Date.now() - startTime;
        const level = res.statusCode >= 400 ? LogLevel.ERROR : LogLevel.INFO;
        
        this.write(this.formatLog(level, 'Request completed', {
          requestId,
          method: req.method,
          url: req.url,
          statusCode: res.statusCode,
          duration: `${duration}ms`,
        }));
      });

      next();
    };
  }
}

// Export singleton logger instance
export const logger = new Logger();

// Helper function for error logging
export const logError = (error: Error, context?: Record<string, any>) => {
  logger.error(error.message, {
    stack: error.stack,
    name: error.name,
    ...context,
  });
};
