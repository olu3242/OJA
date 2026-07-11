import { Pool } from "pg";

// Canonical (Supabase) Postgres pool. On Supabase this is the project DB
// (use the pooled connection string); locally it's the oja_canonical database.
const url =
  process.env.SUPABASE_DB_URL ??
  "postgresql://oja@127.0.0.1:5433/oja_canonical";

const globalForPool = globalThis as unknown as { canonicalPool?: Pool };
export const canonicalPool =
  globalForPool.canonicalPool ?? new Pool({ connectionString: url, max: 5 });
if (process.env.NODE_ENV !== "production")
  globalForPool.canonicalPool = canonicalPool;
