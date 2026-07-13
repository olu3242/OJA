import { db } from "@/lib/db";
import { canonicalPool } from "@/lib/canonical-db";

/**
 * Dependency health checks for the ops probes (/api/health, /ready, /live,
 * /status). Each dependency is timed and marked `critical` or not: the
 * revenue-bearing Prisma DB is critical (readiness fails if it's down), the
 * canonical/Supabase DB is optional (convergence is flag-gated, default off) so
 * its absence degrades rather than fails readiness.
 */
export type CheckStatus = "ok" | "down";
export type OverallStatus = "ok" | "degraded" | "down";

export type DependencyCheck = {
  name: string;
  critical: boolean;
  status: CheckStatus;
  latencyMs: number;
  detail?: string;
};

const startedAt = Date.now();

async function timed(
  name: string,
  critical: boolean,
  probe: () => Promise<unknown>,
): Promise<DependencyCheck> {
  const start = performance.now();
  try {
    await probe();
    return {
      name,
      critical,
      status: "ok",
      latencyMs: Math.round(performance.now() - start),
    };
  } catch (e) {
    return {
      name,
      critical,
      status: "down",
      latencyMs: Math.round(performance.now() - start),
      detail: e instanceof Error ? e.message : String(e),
    };
  }
}

export function checkDatabase(): Promise<DependencyCheck> {
  return timed("database", true, () => db.$queryRaw`select 1`);
}

export function checkCanonicalDatabase(): Promise<DependencyCheck> {
  return timed("canonical_db", false, () => canonicalPool.query("select 1"));
}

export type HealthReport = {
  status: OverallStatus;
  ready: boolean;
  uptimeSeconds: number;
  timestamp: string;
  version: string;
  checks: DependencyCheck[];
};

/** Run all dependency checks and roll them up into a single report. */
export async function runHealthChecks(): Promise<HealthReport> {
  const checks = await Promise.all([checkDatabase(), checkCanonicalDatabase()]);
  const criticalDown = checks.some((c) => c.critical && c.status === "down");
  const anyDown = checks.some((c) => c.status === "down");
  const status: OverallStatus = criticalDown
    ? "down"
    : anyDown
      ? "degraded"
      : "ok";
  return {
    status,
    ready: !criticalDown,
    uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
    timestamp: new Date().toISOString(),
    version:
      process.env.APP_VERSION ?? process.env.VERCEL_GIT_COMMIT_SHA ?? "dev",
    checks,
  };
}
