import { Client } from "pg";

export const CANONICAL_URL =
  process.env.SUPABASE_DB_URL ??
  "postgresql://oja@127.0.0.1:5433/oja_canonical";

export async function adminClient(url = CANONICAL_URL) {
  const c = new Client({ connectionString: url });
  await c.connect();
  return c;
}

/**
 * Run queries as Supabase's `authenticated` role with a specific user's JWT
 * claims — RLS applies exactly as it does behind PostgREST. This impersonates
 * the database role; it does not mock application authentication.
 */
export async function asUser<T>(
  userId: string | null,
  fn: (c: Client) => Promise<T>,
): Promise<T> {
  const c = await adminClient();
  try {
    await c.query("begin");
    await c.query(`select set_config('request.jwt.claim.sub', $1, true)`, [
      userId ?? "",
    ]);
    await c.query(`set local role ${userId ? "authenticated" : "anon"}`);
    const out = await fn(c);
    await c.query("rollback"); // tests never persist as end users
    return out;
  } finally {
    await c.end();
  }
}

/** Seed an auth user + profile + org + membership directly (service path). */
export async function seedUser(
  c: Client,
  {
    email,
    name,
    admin = false,
  }: { email: string; name: string; admin?: boolean },
) {
  const u = await c.query(
    `insert into auth.users (email) values ($1) returning id`,
    [email],
  );
  const userId: string = u.rows[0].id;
  await c.query(
    `insert into public.profiles (id, email, full_name, created_by) values ($1,$2,$3,$1)`,
    [userId, email, name],
  );
  const o = await c.query(
    `insert into public.organizations (name, slug, kind, created_by)
     values ($1, $2 || substr(md5(random()::text),1,8), 'personal', $3) returning id`,
    [name, email.split("@")[0] + "-", userId],
  );
  const orgId: string = o.rows[0].id;
  await c.query(
    `insert into public.organization_members (organization_id, user_id, member_role, created_by)
     values ($1,$2,'owner',$2)`,
    [orgId, userId],
  );
  if (admin) {
    await c.query(
      `insert into public.user_roles (user_id, role_id, organization_id, created_by)
       select $1, id, $2, $1 from public.roles where key='platform_admin'`,
      [userId, orgId],
    );
  }
  return { userId, orgId };
}
