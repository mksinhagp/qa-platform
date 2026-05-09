// Structured logging types and utilities
// Correlation ID propagation across services

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  correlation_id?: string;
  service: string;
  timestamp: string;
  level: LogLevel;
}

export interface LogEntry extends LogContext {
  message: string;
  data?: Record<string, unknown>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

export class Logger {
  private service: string;

  constructor(service: string) {
    this.service = service;
  }

  private baseContext(correlationId?: string): LogContext {
    return {
      correlation_id: correlationId,
      service: this.service,
      timestamp: new Date().toISOString(),
      level: 'info',
    };
  }

  private log(level: LogLevel, message: string, data?: Record<string, unknown>, error?: Error, correlationId?: string): void {
    const entry: LogEntry = {
      ...this.baseContext(correlationId),
      level,
      message,
      data,
      ...(error && {
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack,
        },
      }),
    };

    const output = JSON.stringify(entry);
    switch (level) {
      case 'debug': console.debug(output); break;
      case 'warn':  console.warn(output);  break;
      case 'error': console.error(output); break;
      default:      console.log(output);   break;
    }
  }

  debug(message: string, data?: Record<string, unknown>, correlationId?: string): void {
    this.log('debug', message, data, undefined, correlationId);
  }

  info(message: string, data?: Record<string, unknown>, correlationId?: string): void {
    this.log('info', message, data, undefined, correlationId);
  }

  warn(message: string, data?: Record<string, unknown>, correlationId?: string): void {
    this.log('warn', message, data, undefined, correlationId);
  }

  error(message: string, error?: Error, data?: Record<string, unknown>, correlationId?: string): void {
    this.log('error', message, data, error, correlationId);
  }
}

export function generateCorrelationId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}
