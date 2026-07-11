import { beforeAll, afterAll, describe, expect, it } from "vitest";
import type { Client } from "pg";
import { migrate } from "../../scripts/canonical";
import { adminClient, asUser, seedUser } from "./helpers";

/**
 * RLS tests — executed as the `authenticated` Postgres role with impersonated
 * JWT claims, exactly how Supabase evaluates policies in production.
 */
describe("canonical schema — row-level security", () => {
  let svc: Client;
  let alice: { userId: string; orgId: string };
  let bob: { userId: string; orgId: string };
  let admin: { userId: string; orgId: string };
  let aliceCustomerId: string;

  beforeAll(async () => {
    await migrate();
    svc = await adminClient();
    const stamp = Date.now();
    alice = await seedUser(svc, {
      email: `alice${stamp}@rls.gaarii`,
      name: "Alice",
    });
    bob = await seedUser(svc, { email: `bob${stamp}@rls.gaarii`, name: "Bob" });
    admin = await seedUser(svc, {
      email: `root${stamp}@rls.gaarii`,
      name: "Root",
      admin: true,
    });
    const cust = await svc.query(
      `insert into public.customers (organization_id, display_name, email, created_by)
       values ($1,'Alice','alice${stamp}@rls.gaarii',$2) returning id`,
      [alice.orgId, alice.userId],
    );
    aliceCustomerId = cust.rows[0].id;
    await svc.query(
      `insert into public.subscriptions (organization_id, customer_id, plan, price_cents, created_by)
       values ($1,$2,'FAMILY',6400,$3)`,
      [alice.orgId, aliceCustomerId, alice.userId],
    );
  });

  afterAll(async () => {
    await svc.end();
  });

  it("isolates tenants: Alice sees her subscription, Bob sees nothing", async () => {
    const mine = await asUser(alice.userId, (c) =>
      c.query(`select id from public.subscriptions`),
    );
    expect(mine.rowCount).toBe(1);

    const theirs = await asUser(bob.userId, (c) =>
      c.query(`select id from public.subscriptions`),
    );
    expect(theirs.rowCount).toBe(0);
  });

  it("hides soft-deleted rows from tenants", async () => {
    await svc.query(
      `update public.subscriptions set deleted_at = now() where customer_id = $1`,
      [aliceCustomerId],
    );
    const mine = await asUser(alice.userId, (c) =>
      c.query(`select id from public.subscriptions`),
    );
    expect(mine.rowCount).toBe(0);
    await svc.query(
      `update public.subscriptions set deleted_at = null where customer_id = $1`,
      [aliceCustomerId],
    );
  });

  it("blocks cross-tenant writes at the policy layer", async () => {
    await expect(
      asUser(bob.userId, (c) =>
        c.query(
          `insert into public.customers (organization_id, display_name, email)
           values ($1,'Intruder','intruder@rls.gaarii')`,
          [alice.orgId],
        ),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("restricts profiles to self", async () => {
    const own = await asUser(alice.userId, (c) =>
      c.query(`select id from public.profiles`),
    );
    expect(own.rows.map((r) => r.id)).toEqual([alice.userId]);
  });

  it("prevents self-service role escalation (user_roles writes are admin-only)", async () => {
    await expect(
      asUser(bob.userId, (c) =>
        c.query(
          `insert into public.user_roles (user_id, role_id, organization_id)
           select $1, id, $2 from public.roles where key='platform_admin'`,
          [bob.userId, bob.orgId],
        ),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("grants platform admins read escalation across tenants", async () => {
    const all = await asUser(admin.userId, (c) =>
      c.query(`select id from public.subscriptions`),
    );
    expect(all.rowCount).toBeGreaterThanOrEqual(1);
    const audit = await asUser(admin.userId, (c) =>
      c.query(`select count(*)::int as n from public.audit_logs`),
    );
    expect(audit.rows[0].n).toBeGreaterThan(0);
    // Non-admins cannot read the audit trail at all
    const denied = await asUser(bob.userId, (c) =>
      c.query(`select count(*)::int as n from public.audit_logs`),
    );
    expect(denied.rows[0].n).toBe(0);
  });

  it("exposes catalog as public reference data, and waitlists accept anon inserts", async () => {
    const products = await asUser(bob.userId, (c) =>
      c.query(`select code from public.products`),
    );
    expect(products.rows.map((r) => r.code)).toContain("GARRI");

    const joined = await asUser(null, (c) =>
      c.query(
        // no RETURNING: reading the row back would require a SELECT policy,
        // which anon intentionally does not have.
        `insert into public.waitlists (kind, email) values ('household', $1)`,
        [`anon${Date.now()}@rls.gaarii`],
      ),
    );
    expect(joined.rowCount).toBe(1);
    // ...but anon cannot read the waitlist back
    const read = await asUser(null, (c) =>
      c.query(`select * from public.waitlists`),
    );
    expect(read.rowCount).toBe(0);
  });

  it("scopes v_my_organizations to the caller (security invoker view)", async () => {
    const orgs = await asUser(alice.userId, (c) =>
      c.query(`select id from public.v_my_organizations`),
    );
    expect(orgs.rows.map((r) => r.id)).toEqual([alice.orgId]);
  });
});
