// Scheduled legacy→canonical sync (scheduled_tasks key `legacy_convergence`,
// hourly). Runs the idempotent incremental backfill, then a parity check;
// exits non-zero on orphans or drift so the scheduler surfaces the failure.
import "dotenv/config";
import { convergeLegacyData } from "../server/repositories/convergence";
import { parityCheck } from "../server/repositories/reporting";
import { db } from "../lib/db";
import { canonicalPool } from "../lib/canonical-db";

async function main() {
  const report = await convergeLegacyData();
  if (report.orphans.length > 0) {
    console.error("convergence orphans — rolled back:", report.orphans);
    process.exitCode = 1;
    return;
  }
  const parity = await parityCheck();
  console.log(
    JSON.stringify({
      converged: report,
      parity: { inParity: parity.inParity, drift: parity.drift },
    }),
  );
  if (!parity.inParity) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
    await canonicalPool.end();
  });
