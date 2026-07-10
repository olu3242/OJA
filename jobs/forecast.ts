// Nightly forecast batch (task 2.5) — run via `npm run job:forecast`.
import "dotenv/config";
import { runForecast } from "../server/services/forecast";
import { db } from "../lib/db";

runForecast()
  .then((results) => {
    for (const r of results) {
      console.log(
        `${r.skuCode} @ ${r.warehouseId}: [${r.weeks.join(", ")}] lb/week`,
      );
    }
    console.log("forecast complete");
  })
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
