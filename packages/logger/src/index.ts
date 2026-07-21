import pino from 'pino';

const isDev = process.env.NODE_ENV !== 'production';

/**
 * Structured JSON logger using Pino.
 * In development: pretty-prints with colors.
 * In production: outputs structured JSON for log aggregation (Loki).
 */
export const createLogger = (service: string) => {
  return pino({
    name: service,
    level: process.env.LOG_LEVEL || 'info',
    base: {
      service,
      env: process.env.NODE_ENV || 'development',
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    transport: isDev
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss',
            ignore: 'pid,hostname',
          },
        }
      : undefined,
  });
};

export type Logger = ReturnType<typeof createLogger>;

/**
 * Log context for HTTP requests — use in middleware.
 */
export interface RequestLogContext {
  requestId: string;
  method: string;
  path: string;
  ip: string;
  userId?: string;
  userAgent?: string;
}

/**
 * Log context for Kafka events.
 */
export interface EventLogContext {
  eventId: string;
  eventType: string;
  topic: string;
  source: string;
}
