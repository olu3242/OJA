import { describe, expect, it } from "vitest";
import { runHealthChecks, checkDatabase } from "@/lib/health";
import { SECURITY_HEADERS, applySecurityHeaders } from "@/lib/security-headers";
import { NextResponse } from "next/server";

/**
 * Ops surface (WS7/WS10): health/readiness roll-up and the baseline security
 * headers. Runs against the live Postgres the rest of the suite uses.
 */
describe("health checks", () => {
  it("reports the database dependency as up with a latency", async () => {
    const check = await checkDatabase();
    expect(check).toMatchObject({
      name: "database",
      critical: true,
      status: "ok",
    });
    expect(check.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("rolls up to ready when the critical DB is reachable", async () => {
    const report = await runHealthChecks();
    expect(report.ready).toBe(true);
    // database is critical and up → overall ok or degraded (never down)
    expect(report.status).not.toBe("down");
    expect(report.checks.map((c) => c.name)).toContain("database");
    expect(report.uptimeSeconds).toBeGreaterThanOrEqual(0);
    expect(typeof report.timestamp).toBe("string");
  });

  it("treats the canonical DB as optional (degraded, not down)", async () => {
    const report = await runHealthChecks();
    const canonical = report.checks.find((c) => c.name === "canonical_db");
    expect(canonical?.critical).toBe(false);
    // even if canonical were down, ready must stay true because it's non-critical
    expect(report.ready).toBe(true);
  });
});

describe("security headers", () => {
  it("sets the full baseline header set on a response", () => {
    const res = applySecurityHeaders(NextResponse.next());
    for (const name of Object.keys(SECURITY_HEADERS)) {
      expect(res.headers.get(name)).toBe(SECURITY_HEADERS[name]);
    }
  });

  it("denies framing and forbids MIME sniffing", () => {
    const res = applySecurityHeaders(NextResponse.next());
    expect(res.headers.get("X-Frame-Options")).toBe("DENY");
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(res.headers.get("Content-Security-Policy")).toContain(
      "frame-ancestors 'none'",
    );
  });
});
