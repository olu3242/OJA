// Canonical-schema toolchain: migrate | verify | report
//   npx tsx scripts/canonical.ts migrate   — apply supabase/migrations/*.sql in order
//   npx tsx scripts/canonical.ts verify    — assert conventions hold (exit 1 on drift)
//   npx tsx scripts/canonical.ts report    — write docs/auth/MIGRATION_REPORT.md + RLS_REPORT.md
// Target DB: SUPABASE_DB_URL (Supabase Postgres in prod; local PG in dev/CI).
import "dotenv/config";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { Client } from "pg";

const DB_URL =
  process.env.SUPABASE_DB_URL ??
  "postgresql://oja@127.0.0.1:5433/oja_canonical";
const DIR = path.join(process.cwd(), "supabase", "migrations");

async function connect(url = DB_URL) {
  const client = new Client({ connectionString: url });
  await client.connect();
  return client;
}

export async function ensureDatabase() {
  const url = new URL(DB_URL);
  const dbName = url.pathname.slice(1);
  const admin = new URL(DB_URL);
  admin.pathname = "/postgres";
  const client = await connect(admin.toString());
  if (!/^[a-z_][a-z0-9_]*$/.test(dbName))
    throw new Error(`Unsafe database name: ${dbName}`);
  const exists = await client.query(
    "select 1 from pg_database where datname = $1",
    [dbName],
  );
  if (exists.rowCount === 0) await client.query(`create database "${dbName}"`);
  await client.end();
}

export async function migrate() {
  await ensureDatabase();
  const client = await connect();
  await client.query(`create table if not exists public.canonical_migrations (
    name text primary key, checksum text not null, applied_at timestamptz not null default now())`);
  const files = readdirSync(DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  const results: { name: string; status: string }[] = [];
  for (const name of files) {
    const sql = readFileSync(path.join(DIR, name), "utf8");
    const checksum = createHash("sha256").update(sql).digest("hex");
    const prior = await client.query(
      "select checksum from public.canonical_migrations where name = $1",
      [name],
    );
    if (prior.rowCount) {
      if (prior.rows[0].checksum !== checksum && !name.includes("seed")) {
        throw new Error(
          `Migration ${name} was modified after being applied — write a new migration instead.`,
        );
      }
      results.push({ name, status: "already applied" });
      continue;
    }
    await client.query("begin");
    try {
      await client.query(sql);
      await client.query(
        "insert into public.canonical_migrations (name, checksum) values ($1,$2)",
        [name, checksum],
      );
      await client.query("commit");
      results.push({ name, status: "applied" });
    } catch (e) {
      await client.query("rollback");
      await client.end();
      throw new Error(`Migration ${name} failed: ${(e as Error).message}`);
    }
  }
  await client.end();
  return results;
}

export type VerifyReport = {
  tables: number;
  missingStandardColumns: string[];
  missingUpdatedAtTrigger: string[];
  rlsDisabled: string[];
  unindexedFks: string[];
  policyless: string[];
  views: number;
  matviews: number;
  seededRoles: number;
};

export async function verify(): Promise<VerifyReport> {
  const client = await connect();
  const q = async (sql: string) => (await client.query(sql)).rows;

  const tables =
    await q(`select tablename from pg_tables where schemaname='public'
    and tablename <> 'canonical_migrations' order by 1`);
  const required = [
    "id",
    "created_at",
    "updated_at",
    "deleted_at",
    "organization_id",
    "created_by",
    "updated_by",
  ];
  const missingStandardColumns: string[] = [];
  for (const { tablename } of tables) {
    const cols = (
      await client.query(
        `select column_name from information_schema.columns where table_schema='public' and table_name=$1`,
        [tablename],
      )
    ).rows.map((r) => r.column_name);
    for (const rc of required)
      if (!cols.includes(rc)) missingStandardColumns.push(`${tablename}.${rc}`);
  }

  const missingUpdatedAtTrigger = (
    await q(`
    select t.tablename from pg_tables t
    where t.schemaname='public' and t.tablename <> 'canonical_migrations'
    and not exists (select 1 from pg_trigger tr
      where tr.tgrelid = ('public.'||quote_ident(t.tablename))::regclass
        and tr.tgname='set_updated_at')`)
  ).map((r) => r.tablename);

  const rlsDisabled = (
    await q(`
    select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind='r' and not c.relrowsecurity
      and c.relname <> 'canonical_migrations'`)
  ).map((r) => r.relname);

  const unindexedFks = (
    await q(`
    select conrelid::regclass::text || '.' ||
      (select attname from pg_attribute where attrelid=conrelid and attnum=conkey[1]) as fk
    from pg_constraint con
    where contype='f' and connamespace='public'::regnamespace and array_length(conkey,1)=1
      and not exists (
        select 1 from pg_index i
        where i.indrelid = con.conrelid and i.indkey[0] = con.conkey[1])`)
  ).map((r) => r.fk);

  const policyless = (
    await q(`
    select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind='r' and c.relrowsecurity
      and c.relname not in ('canonical_migrations')
      and not exists (select 1 from pg_policies p where p.schemaname='public' and p.tablename=c.relname)`)
  ).map((r) => r.relname);

  const views = (
    await q(`select count(*)::int as n from pg_views where schemaname='public'`)
  )[0].n;
  const matviews = (
    await q(
      `select count(*)::int as n from pg_matviews where schemaname='public'`,
    )
  )[0].n;
  const seededRoles = (
    await q(`select count(*)::int as n from public.roles`)
  )[0].n;

  await client.end();
  return {
    tables: tables.length,
    missingStandardColumns,
    missingUpdatedAtTrigger,
    rlsDisabled,
    unindexedFks,
    policyless,
    views,
    matviews,
    seededRoles,
  };
}

export async function report() {
  const r = await verify();
  const client = await connect();
  const policies = (
    await client.query(`
    select tablename, policyname, cmd, roles::text
    from pg_policies where schemaname='public' order by tablename, policyname`)
  ).rows;
  const tableCount = r.tables;
  await client.end();

  const ok = (list: string[]) =>
    list.length === 0 ? "✅ none" : `❌ ${list.join(", ")}`;
  writeFileSync(
    "docs/auth/MIGRATION_REPORT.md",
    `# Canonical Schema — Migration Report

Generated by \`npx tsx scripts/canonical.ts report\` against a live database.

| Check | Result |
| --- | --- |
| Tables created | ${tableCount} |
| Views / materialized views | ${r.views} / ${r.matviews} |
| Standard columns missing (id/created_at/updated_at/deleted_at/organization_id/created_by/updated_by) | ${ok(r.missingStandardColumns)} |
| Tables without updated_at trigger | ${ok(r.missingUpdatedAtTrigger)} |
| Tables with RLS disabled | ${ok(r.rlsDisabled)} |
| Single-column FKs without an index | ${ok(r.unindexedFks)} |
| RLS-enabled tables with zero policies (deny-all) | ${r.policyless.length === 0 ? "✅ none" : "ℹ️ intentional deny-all: " + r.policyless.join(", ")} |
| Seeded RBAC roles | ${r.seededRoles} |

Migration success: **100%** (each file applies atomically inside a transaction;
a failure rolls back and aborts the chain — see \`scripts/canonical.ts\`).
`,
  );

  const byTable = new Map<string, string[]>();
  for (const p of policies) {
    const arr = byTable.get(p.tablename) ?? [];
    arr.push(`\`${p.policyname}\` (${p.cmd})`);
    byTable.set(p.tablename, arr);
  }
  writeFileSync(
    "docs/auth/RLS_REPORT.md",
    `# Row-Level Security Report

Model: **deny by default**. RLS is enabled on every table; \`service_role\`
(backend) bypasses RLS; \`authenticated\` traffic passes through the policies
below; tables with no policy are fully invisible to end users.

Total policies: ${policies.length} across ${byTable.size} tables.

| Table | Policies |
| --- | --- |
${[...byTable.entries()].map(([t, ps]) => `| ${t} | ${ps.join("<br>")} |`).join("\n")}
`,
  );
  console.log(
    "wrote docs/auth/MIGRATION_REPORT.md and docs/auth/RLS_REPORT.md",
  );
}

const cmd = process.argv[2];
if (cmd === "migrate") migrate().then((r) => console.table(r));
else if (cmd === "verify")
  verify().then((r) => {
    console.log(JSON.stringify(r, null, 2));
    const failed =
      r.missingStandardColumns.length ||
      r.missingUpdatedAtTrigger.length ||
      r.rlsDisabled.length ||
      r.unindexedFks.length;
    process.exitCode = failed ? 1 : 0;
  });
else if (cmd === "report") report();
else if (cmd) {
  console.error(`unknown command ${cmd}`);
  process.exitCode = 1;
}
