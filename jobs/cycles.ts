// Cycle-generation cron (task 2.8) — run via `npm run job:cycles`.
import "dotenv/config";
import { generateUpcomingCycles } from "../server/services/cycles";
import { db } from "../lib/db";

generateUpcomingCycles()
  .then(({ created }) =>
    console.log(`created ${created} upcoming cycle(s), nudges sent`),
  )
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
