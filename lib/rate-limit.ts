/**
 * Fixed-window rate limiter (Execution 10 / WS7). In-memory by default so it
 * needs no external service; the `RateLimitStore` seam lets a Redis/Upstash
 * backend slot in for multi-instance deployments without touching call sites.
 * The clock is injectable for deterministic tests.
 */
export type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetMs: number; // ms until the current window resets
};

export type RateLimitOptions = {
  limit: number;
  windowMs: number;
  now?: number;
};

type Window = { count: number; resetAt: number };

export interface RateLimitStore {
  hit(key: string, windowMs: number, now: number): Window;
  clear(): void;
}

class MemoryStore implements RateLimitStore {
  private windows = new Map<string, Window>();

  hit(key: string, windowMs: number, now: number): Window {
    const existing = this.windows.get(key);
    if (!existing || now >= existing.resetAt) {
      const fresh = { count: 1, resetAt: now + windowMs };
      this.windows.set(key, fresh);
      return fresh;
    }
    existing.count += 1;
    return existing;
  }

  clear() {
    this.windows.clear();
  }
}

const defaultStore = new MemoryStore();

export function rateLimit(
  key: string,
  opts: RateLimitOptions,
  store: RateLimitStore = defaultStore,
): RateLimitResult {
  const now = opts.now ?? Date.now();
  const window = store.hit(key, opts.windowMs, now);
  const remaining = Math.max(0, opts.limit - window.count);
  return {
    allowed: window.count <= opts.limit,
    limit: opts.limit,
    remaining,
    resetMs: Math.max(0, window.resetAt - now),
  };
}

/** Test/ops helper — reset the default in-memory store. */
export function clearRateLimits() {
  defaultStore.clear();
}

/** Best-effort client key from proxy headers, falling back to a constant. */
export function clientKey(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

/** Build the standard 429 headers for a limited response. */
export function rateLimitHeaders(
  result: RateLimitResult,
): Record<string, string> {
  return {
    "RateLimit-Limit": String(result.limit),
    "RateLimit-Remaining": String(result.remaining),
    "Retry-After": String(Math.ceil(result.resetMs / 1000)),
  };
}
