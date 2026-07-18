import { randomUUID } from "node:crypto";

/**
 * Structured logging with correlation IDs (WS9 observability). Every line is a
 * single JSON object so a log pipeline can index by `level`, `correlationId`,
 * and arbitrary fields. A correlation id threads a request across the webhook →
 * idempotency → ledger hops so a failure can be traced end to end. The sink is
 * injectable for tests.
 */
export type LogLevel = "info" | "warn" | "error";
export type LogFields = Record<string, unknown>;

export interface LogSink {
  write(line: string): void;
}

export const consoleSink: LogSink = {
  write: (line) => process.stdout.write(line + "\n"),
};

export function logEvent(
  level: LogLevel,
  message: string,
  fields: LogFields = {},
  sink: LogSink = consoleSink,
): void {
  sink.write(
    JSON.stringify({
      level,
      message,
      ...fields,
      at: new Date().toISOString(),
    }),
  );
}

export const logger = {
  info: (message: string, fields?: LogFields) =>
    logEvent("info", message, fields),
  warn: (message: string, fields?: LogFields) =>
    logEvent("warn", message, fields),
  error: (message: string, fields?: LogFields) =>
    logEvent("error", message, fields),
};

/** Generate a fresh correlation id. */
export function correlationId(): string {
  return randomUUID();
}

/** Read an inbound `x-correlation-id`, or mint one so every request has a trace. */
export function correlationIdFrom(req: Request): string {
  return req.headers.get("x-correlation-id") ?? randomUUID();
}
