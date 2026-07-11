import { convergeAccount } from "./convergence";
import { canonicalDualWriteEnabled } from "@/lib/flags";
import { captureError } from "@/lib/observability";

/**
 * Live dual-write mirror (convergence phase 3+). After a legacy commerce
 * mutation, reflect that account's state into the canonical schema — but only
 * when the `canonical_dual_write` flag is on, and never in a way that can break
 * the legacy (revenue-bearing) path: failures are captured, not thrown, and the
 * hourly `legacy_convergence` job reconciles any miss. `convergeAccount` is
 * idempotent, so the mirror is safe to call after every mutation.
 */
export async function mirrorAccount(accountId: string): Promise<void> {
  if (!(await canonicalDualWriteEnabled())) return;
  try {
    const report = await convergeAccount(accountId);
    if (report.orphans.length > 0) {
      captureError(new Error("dual-write orphans"), {
        mirror: accountId,
        orphans: report.orphans,
      });
    }
  } catch (e) {
    captureError(e, { mirror: accountId });
  }
}
