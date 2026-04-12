import { LogLevel, SystemLog } from '../types';

interface LoggerConfig {
  service?: string;
  level?: LogLevel;
}

class Logger {
  private service: string;
  private level: LogLevel;

  private levelPriority: Record<LogLevel, number> = {
    [LogLevel.DEBUG]: 0,
    [LogLevel.INFO]: 1,
    [LogLevel.WARN]: 2,
    [LogLevel.ERROR]: 3,
    [LogLevel.FATAL]: 4
  };

  constructor(config: string | LoggerConfig) {
    if (typeof config === 'string') {
      this.service = config;
      this.level = LogLevel.INFO;
    } else {
      this.service = config.service || 'unknown';
      this.level = config.level || LogLevel.INFO;
    }
  }

  private shouldLog(level: LogLevel): boolean {
    return this.levelPriority[level] >= this.levelPriority[this.level];
  }

  private log(level: LogLevel, message: string, metadata?: Record<string, unknown>): void {
    if (!this.shouldLog(level)) return;

    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      service: this.service,
      level,
      message,
      metadata,
      traceId: metadata?.traceId as string || this.generateTraceId()
    };

    // Console output with colors
    const colorCode = this.getColorCode(level);
    const formattedMessage = `[${timestamp}] [${this.service}] [${level}] ${message}`;
    
    switch (level) {
      case LogLevel.DEBUG:
        console.debug(`\x1b[90m%s\x1b[0m`, formattedMessage, metadata || '');
        break;
      case LogLevel.INFO:
        console.info(`\x1b[36m%s\x1b[0m`, formattedMessage, metadata || '');
        break;
      case LogLevel.WARN:
        console.warn(`\x1b[33m%s\x1b[0m`, formattedMessage, metadata || '');
        break;
      case LogLevel.ERROR:
      case LogLevel.FATAL:
        console.error(`\x1b[31m%s\x1b[0m`, formattedMessage, metadata || '');
        break;
    }

    // Store in database if configured
    this.persistLog(logEntry).catch(() => {
      // Silent fail - don't block execution
    });
  }

  private getColorCode(level: LogLevel): string {
    switch (level) {
      case LogLevel.DEBUG: return '\x1b[90m';  // Gray
      case LogLevel.INFO: return '\x1b[36m';  // Cyan
      case LogLevel.WARN: return '\x1b[33m';  // Yellow
      case LogLevel.ERROR: return '\x1b[31m'; // Red
      case LogLevel.FATAL: return '\x1b[35m'; // Magenta
      default: return '\x1b[0m';
    }
  }

  private async persistLog(logEntry: {
    timestamp: string;
    service: string;
    level: LogLevel;
    message: string;
    metadata?: Record<string, unknown>;
    traceId: string;
  }): Promise<void> {
    // This would persist to database in production
    // For now, we just log to console
  }

  private generateTraceId(): string {
    return `trace-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  debug(message: string, metadata?: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, message, metadata);
  }

  info(message: string, metadata?: Record<string, unknown>): void {
    this.log(LogLevel.INFO, message, metadata);
  }

  warn(message: string, metadata?: Record<string, unknown>): void {
    this.log(LogLevel.WARN, message, metadata);
  }

  error(message: string, metadata?: Record<string, unknown>): void {
    this.log(LogLevel.ERROR, message, metadata);
  }

  fatal(message: string, metadata?: Record<string, unknown>): void {
    this.log(LogLevel.FATAL, message, metadata);
  }

  child(metadata: Record<string, unknown>): Logger {
    return new Logger({
      service: this.service,
      level: this.level
    });
  }
}

export { Logger };
export default Logger;
