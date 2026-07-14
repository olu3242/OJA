/**
 * Resilience primitives (WS9): bounded retry with exponential backoff and a
 * hard timeout. Used to wrap flaky external calls (carrier/payment/POS adapters)
 * without pulling in a dependency. Deterministic-friendly: `sleep` is injectable
 * so tests can run without real delays.
 */
export class TimeoutError extends Error {
  constructor(ms: number) {
    super(`operation timed out after ${ms}ms`);
    this.name = "TimeoutError";
  }
}

export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new TimeoutError(ms)), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

export type RetryOptions = {
  retries?: number; // max attempts beyond the first (default 3)
  baseMs?: number; // first backoff delay (default 100)
  factor?: number; // backoff multiplier (default 2)
  timeoutMs?: number; // per-attempt timeout (optional)
  shouldRetry?: (error: unknown) => boolean; // default: always retry
  sleep?: (ms: number) => Promise<void>; // injectable for tests
};

const realSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: RetryOptions = {},
): Promise<T> {
  const {
    retries = 3,
    baseMs = 100,
    factor = 2,
    timeoutMs,
    shouldRetry = () => true,
    sleep = realSleep,
  } = opts;

  let attempt = 0;
  for (;;) {
    try {
      return timeoutMs ? await withTimeout(fn(), timeoutMs) : await fn();
    } catch (e) {
      if (attempt >= retries || !shouldRetry(e)) throw e;
      await sleep(baseMs * factor ** attempt);
      attempt++;
    }
  }
}
