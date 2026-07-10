// Error-capture adapter (task 3.4): structured logging now, Sentry when a DSN
// exists — call sites stay stable. Wire `initObservability` in instrumentation
// once the account is provisioned (see docs/runbooks/G3_PILOT_CHECKLIST.md).
export function captureError(
  error: unknown,
  context: Record<string, unknown> = {},
) {
  const err = error instanceof Error ? error : new Error(String(error));
  console.error(
    JSON.stringify({
      level: "error",
      message: err.message,
      stack: err.stack?.split("\n").slice(0, 5).join(" | "),
      ...context,
      at: new Date().toISOString(),
    }),
  );
}
