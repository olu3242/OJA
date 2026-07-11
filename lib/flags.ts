import { canonicalPool } from "@/lib/canonical-db";

/**
 * Feature-flag reader for the convergence rollout. Resolution order:
 *   1. Env override `FLAG_<KEY>` ("1"/"true" on, else off) — deterministic for
 *      tests and emergency kill-switch.
 *   2. Canonical `feature_flags.enabled` (30s cache) — the runtime toggle.
 * Any failure resolves to OFF, so a missing/unreachable canonical DB can never
 * silently enable dual-write or a read cutover.
 */
const cache = new Map<string, { value: boolean; at: number }>();
const TTL_MS = 30_000;

export async function isFlagEnabled(key: string): Promise<boolean> {
  const override = process.env[`FLAG_${key.toUpperCase()}`];
  if (override != null) return override === "1" || override === "true";

  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;
  try {
    const r = await canonicalPool.query(
      `select enabled from public.feature_flags where key = $1`,
      [key],
    );
    const value = r.rows[0]?.enabled ?? false;
    cache.set(key, { value, at: Date.now() });
    return value;
  } catch {
    return false;
  }
}

export const canonicalDualWriteEnabled = () =>
  isFlagEnabled("canonical_dual_write");
export const canonicalReadEnabled = () => isFlagEnabled("canonical_read");

/** Test/ops helper — clears the flag cache so a toggle takes effect at once. */
export function clearFlagCache() {
  cache.clear();
}
