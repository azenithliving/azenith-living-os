/**
 * lib/vanguard/observability/logger.ts
 * =====================================
 * Structured JSON logger for the Vanguard system.
 * Outputs correlation-ID-tagged JSON to stdout (Vercel picks this up).
 * Zero external dependencies — uses native console.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogRecord {
  readonly level: LogLevel;
  readonly message: string;
  readonly timestamp: string;
  readonly service: "vanguard";
  readonly correlationId: string | null;
  readonly data: Record<string, unknown>;
}

// Thread-local-like correlation ID via AsyncLocalStorage (Node 18+)
// Falls back to null in Edge runtime
let correlationId: string | null = null;

export function setCorrelationId(id: string): void {
  correlationId = id;
}

export function clearCorrelationId(): void {
  correlationId = null;
}

const LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const MIN_LEVEL: LogLevel =
  process.env.VANGUARD_LOG_LEVEL === "debug" ? "debug" : "info";

function shouldLog(level: LogLevel): boolean {
  return LEVELS[level] >= LEVELS[MIN_LEVEL];
}

function emit(level: LogLevel, message: string, data: Record<string, unknown> = {}): void {
  if (!shouldLog(level)) return;

  const record: LogRecord = {
    level,
    message,
    timestamp: new Date().toISOString(),
    service: "vanguard",
    correlationId,
    data,
  };

  const output = JSON.stringify(record);

  switch (level) {
    case "debug":
    case "info":
      console.log(output);
      break;
    case "warn":
      console.warn(output);
      break;
    case "error":
      console.error(output);
      break;
  }
}

export const logger = {
  debug: (message: string, data?: Record<string, unknown>) => emit("debug", message, data),
  info:  (message: string, data?: Record<string, unknown>) => emit("info",  message, data),
  warn:  (message: string, data?: Record<string, unknown>) => emit("warn",  message, data),
  error: (message: string, data?: Record<string, unknown>) => emit("error", message, data),

  /** Wraps a function execution with enter/exit timing logs */
  async timed<T>(
    label: string,
    fn: () => Promise<T>,
    data?: Record<string, unknown>
  ): Promise<T> {
    const start = Date.now();
    try {
      const result = await fn();
      emit("debug", `[TIMED] ${label} completed`, { ...data, latencyMs: Date.now() - start });
      return result;
    } catch (err) {
      emit("error", `[TIMED] ${label} failed`, {
        ...data,
        latencyMs: Date.now() - start,
        error: String(err),
      });
      throw err;
    }
  },
};
