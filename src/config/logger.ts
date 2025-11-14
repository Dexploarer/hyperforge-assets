/**
 * Logger Configuration
 * Using @bogeychan/elysia-logger with Pino for high-performance structured logging
 */

import type { LoggerOptions } from "pino";

const isProduction = process.env.NODE_ENV === "production";
const isDevelopment = !isProduction;

/**
 * Base Pino logger options
 * Production: JSON output for log aggregation
 * Development: Pretty-printed with colors for readability
 */
export const pinoConfig: LoggerOptions = {
  level: process.env.LOG_LEVEL || (isProduction ? "info" : "debug"),

  // Production: Structured JSON output ONLY (no pino-pretty)
  // Development: Pretty-printed with colors
  ...(isDevelopment && typeof window === "undefined" && {
    transport: {
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "HH:MM:ss.l",
        ignore: "pid,hostname",
        singleLine: false,
        levelFirst: true,
      },
    },
  }),

  // Custom formatters for production JSON logs
  ...(isProduction && {
    formatters: {
      level: (label) => {
        return { level: label };
      },
      bindings: (bindings) => {
        return {
          pid: bindings.pid,
          hostname: bindings.hostname,
          node_version: process.version,
        };
      },
    },
  }),

  // Serializers for common objects
  serializers: {
    req: (req) => ({
      method: req.method,
      url: req.url,
      headers: {
        host: req.headers.host,
        "user-agent": req.headers["user-agent"],
        "content-type": req.headers["content-type"],
      },
      remoteAddress: req.remoteAddress,
    }),
    res: (res) => ({
      statusCode: res.statusCode,
      headers: res.headers,
    }),
    err: (err) => ({
      type: err.type,
      message: err.message,
      stack: err.stack,
      ...(err.code && { code: err.code }),
      ...(err.statusCode && { statusCode: err.statusCode }),
    }),
  },

  // Timestamp in ISO format
  timestamp: () => `,"time":"${new Date().toISOString()}"`,

  // Base log fields
  base: {
    env: process.env.NODE_ENV || "development",
    app: "asset-forge-cdn",
  },
};

/**
 * Elysia logger configuration
 * Integrates with Elysia's lifecycle for automatic request logging
 */
export const elysiaLoggerConfig = {
  level: pinoConfig.level,

  // Custom stream for file logging (optional)
  ...(process.env.LOG_FILE && {
    stream: {
      write: (msg: string) => {
        // This would integrate with pino.destination() for file logging
        // For now, we'll use stdout
        process.stdout.write(msg);
      },
    },
  }),

  // Auto-log requests/responses
  autoLogging: {
    ignore: (context: any) => {
      // Don't log health checks and metrics endpoints (reduce noise)
      return ["/api/health", "/api/health/ready", "/metrics"].includes(
        context.request.url
      );
    },
  },

  // Custom log message format for requests
  customProps: (context: any) => ({
    // Add custom context properties to every log
    request_id: context.request.headers.get("x-request-id"),
    user_agent: context.request.headers.get("user-agent"),
    ip: context.request.headers.get("x-forwarded-for") ||
        context.request.headers.get("x-real-ip") ||
        "unknown",
  }),
};

/**
 * Log levels:
 * - fatal (60): The service is going to stop or become unusable
 * - error (50): Fatal for a particular request, but the service continues
 * - warn (40): A note on something that should probably be looked at
 * - info (30): Detail on regular operation (default in production)
 * - debug (20): Anything that might be useful for debugging (default in dev)
 * - trace (10): Very detailed application logging
 */

export const LOG_LEVELS = {
  FATAL: "fatal",
  ERROR: "error",
  WARN: "warn",
  INFO: "info",
  DEBUG: "debug",
  TRACE: "trace",
} as const;
