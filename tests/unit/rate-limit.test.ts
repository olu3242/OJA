import { describe, expect, it } from "vitest";
import {
  rateLimit,
  clientKey,
  rateLimitHeaders,
  type RateLimitStore,
} from "@/lib/rate-limit";

// Fresh in-memory store per test so the default singleton isn't shared.
function freshStore(): RateLimitStore {
  const windows = new Map<string, { count: number; resetAt: number }>();
  return {
    hit(key, windowMs, now) {
      const w = windows.get(key);
      if (!w || now >= w.resetAt) {
        const fresh = { count: 1, resetAt: now + windowMs };
        windows.set(key, fresh);
        return fresh;
      }
      w.count += 1;
      return w;
    },
    clear() {
      windows.clear();
    },
  };
}

describe("rateLimit", () => {
  const opts = { limit: 3, windowMs: 1000 };

  it("allows up to the limit then blocks within the window", () => {
    const store = freshStore();
    const results = [0, 0, 0, 0].map((_, i) =>
      rateLimit("k", { ...opts, now: 100 + i }, store),
    );
    expect(results.map((r) => r.allowed)).toEqual([true, true, true, false]);
    expect(results[2].remaining).toBe(0);
    expect(results[3].remaining).toBe(0);
  });

  it("resets after the window elapses", () => {
    const store = freshStore();
    for (let i = 0; i < 3; i++) rateLimit("k", { ...opts, now: 0 }, store);
    expect(rateLimit("k", { ...opts, now: 500 }, store).allowed).toBe(false);
    // window resets at 1000
    const after = rateLimit("k", { ...opts, now: 1000 }, store);
    expect(after.allowed).toBe(true);
    expect(after.remaining).toBe(2);
  });

  it("tracks keys independently", () => {
    const store = freshStore();
    for (let i = 0; i < 3; i++) rateLimit("a", { ...opts, now: 0 }, store);
    expect(rateLimit("a", { ...opts, now: 0 }, store).allowed).toBe(false);
    expect(rateLimit("b", { ...opts, now: 0 }, store).allowed).toBe(true);
  });

  it("derives the client key from x-forwarded-for", () => {
    const req = new Request("http://x/api", {
      headers: { "x-forwarded-for": "203.0.113.7, 10.0.0.1" },
    });
    expect(clientKey(req)).toBe("203.0.113.7");
    expect(clientKey(new Request("http://x/api"))).toBe("unknown");
  });

  it("emits standard rate-limit headers with Retry-After", () => {
    const h = rateLimitHeaders({
      allowed: false,
      limit: 3,
      remaining: 0,
      resetMs: 2500,
    });
    expect(h["RateLimit-Limit"]).toBe("3");
    expect(h["RateLimit-Remaining"]).toBe("0");
    expect(h["Retry-After"]).toBe("3"); // ceil(2500/1000)
  });
});
