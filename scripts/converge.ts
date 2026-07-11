// Convergence runner (production-readiness C5, step 1):
//   npx tsx scripts/converge.ts
// Backfills legacy Prisma commerce data into the canonical schema,
// idempotently, and prints the verification report. Exits non-zero if any
// orphaned records are detected (in which case nothing is committed).
import "dotenv/config";
import { convergeLegacyData } from "../server/repositories/convergence";
import { db } from "../lib/db";
import { canonicalPool } from "../lib/canonical-db";

convergeLegacyData()
  .then((report) => {
    console.table([report]);
    if (report.orphans.length > 0) {
      console.error(
        "ORPHANS DETECTED — transaction rolled back:",
        report.orphans,
      );
      process.exitCode = 1;
    } else {
      console.log("convergence complete — no orphaned records");
    }
  })
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
    await canonicalPool.end();
  });
