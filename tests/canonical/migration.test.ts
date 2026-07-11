import { beforeAll, describe, expect, it } from "vitest";
import { migrate, verify } from "../../scripts/canonical";
import { adminClient } from "./helpers";

/** Migration test: apply everything to the live DB and prove the conventions. */
describe("canonical schema — migrations", () => {
  beforeAll(async () => {
    await migrate(); // idempotent — re-applying is a no-op
  });

  it("applies 100% of migrations and is re-runnable", async () => {
    const second = await migrate();
    expect(second.every((m) => m.status === "already applied")).toBe(true);
  });

  it("creates every table demanded by the canonical model", async () => {
    const required = [
      // identity
      "profiles",
      "roles",
      "permissions",
      "role_permissions",
      "user_roles",
      "organizations",
      "organization_members",
      "organization_invitations",
      "sessions",
      "devices",
      "oauth_accounts",
      "login_history",
      "api_keys",
      "service_accounts",
      // customers
      "customers",
      "customer_addresses",
      "households",
      "family_members",
      "subscriptions",
      "subscription_items",
      "subscription_deliveries",
      "payment_methods",
      "payment_attempts",
      "wallets",
      "credits",
      "referrals",
      "referral_rewards",
      // group ordering
      "group_orders",
      "group_order_members",
      "group_order_items",
      "group_order_events",
      "drop_locations",
      "delivery_clusters",
      // wholesale
      "business_accounts",
      "business_locations",
      "wholesale_accounts",
      "standing_orders",
      "standing_order_items",
      "rebates",
      "sla_credits",
      // suppliers
      "suppliers",
      "supplier_users",
      "supplier_products",
      "supplier_forecasts",
      "purchase_orders",
      "purchase_order_items",
      "supplier_shipments",
      "supplier_invoices",
      // catalog
      "products",
      "product_categories",
      "product_variants",
      "inventory",
      "inventory_movements",
      "price_books",
      "pricing_rules",
      "country_pricing",
      // orders
      "orders",
      "order_items",
      "shipments",
      "shipment_items",
      "tracking_events",
      "delivery_windows",
      "returns",
      "refunds",
      // payments
      "payments",
      "payment_events",
      "invoices",
      "invoice_items",
      "credit_notes",
      "tax_rates",
      "currencies",
      "exchange_rates",
      // pos
      "pos_integrations",
      "pos_events",
      "sell_through_events",
      "forecast_inputs",
      // supply chain
      "warehouses",
      "warehouse_inventory",
      "containers",
      "container_items",
      "import_shipments",
      "customs_documents",
      "carrier_rates",
      "delivery_routes",
      // forecasting
      "forecast_models",
      "forecast_runs",
      "forecast_metrics",
      "forecast_results",
      "forecast_overrides",
      // event store
      "events",
      "event_handlers",
      "event_failures",
      "event_replays",
      "dead_letter_queue",
      // auditing
      "audit_logs",
      "activity_logs",
      "security_events",
      "admin_actions",
      // notifications
      "notifications",
      "notification_templates",
      "notification_preferences",
      "email_queue",
      "sms_queue",
      "push_queue",
      // files
      "files",
      "documents",
      "media_assets",
      "avatars",
      // marketing
      "campaigns",
      "promo_codes",
      "discounts",
      "landing_pages",
      "waitlists",
      // analytics
      "daily_metrics",
      "weekly_metrics",
      "monthly_metrics",
      "kpi_snapshots",
      "customer_ltv",
      "cohort_analysis",
      // admin
      "feature_flags",
      "system_settings",
      "background_jobs",
      "scheduled_tasks",
    ];
    const c = await adminClient();
    const rows = (
      await c.query(`select tablename from pg_tables where schemaname='public'`)
    ).rows.map((r) => r.tablename);
    await c.end();
    const missing = required.filter((t) => !rows.includes(t));
    expect(missing).toEqual([]);
    expect(required.length).toBeGreaterThanOrEqual(118);
  });

  it("upholds every convention: columns, triggers, RLS, FK indexes", async () => {
    const r = await verify();
    expect(r.missingStandardColumns).toEqual([]);
    expect(r.missingUpdatedAtTrigger).toEqual([]);
    expect(r.rlsDisabled).toEqual([]);
    expect(r.unindexedFks).toEqual([]);
    expect(r.views).toBeGreaterThanOrEqual(3);
    expect(r.matviews).toBeGreaterThanOrEqual(1);
    expect(r.seededRoles).toBe(8);
  });

  it("enforces optimistic locking and updated_at via triggers", async () => {
    const c = await adminClient();
    const org = await c.query(
      `insert into public.organizations (name, slug, kind)
       values ('Trig Test','trig-'||substr(md5(random()::text),1,8),'household') returning id`,
    );
    const cust = await c.query(
      `insert into public.customers (organization_id, display_name, email)
       values ($1,'T','trig@test.gaarii') returning id`,
      [org.rows[0].id],
    );
    const sub = await c.query(
      `insert into public.subscriptions (organization_id, customer_id, plan, price_cents)
       values ($1,$2,'FAMILY',6400) returning id, version, updated_at`,
      [org.rows[0].id, cust.rows[0].id],
    );
    const before = sub.rows[0];
    const after = await c.query(
      `update public.subscriptions set status='paused' where id=$1 returning version, updated_at`,
      [before.id],
    );
    expect(after.rows[0].version).toBe(before.version + 1);
    expect(new Date(after.rows[0].updated_at).getTime()).toBeGreaterThanOrEqual(
      new Date(before.updated_at).getTime(),
    );
    await c.query(`delete from public.subscriptions where id=$1`, [before.id]);
    await c.query(`delete from public.customers where id=$1`, [
      cust.rows[0].id,
    ]);
    await c.query(`delete from public.organizations where id=$1`, [
      org.rows[0].id,
    ]);
    await c.end();
  });

  it("audits sensitive-table changes into audit_logs", async () => {
    const c = await adminClient();
    const org = await c.query(
      `insert into public.organizations (name, slug, kind)
       values ('Audit Test','aud-'||substr(md5(random()::text),1,8),'household') returning id`,
    );
    const logs = await c.query(
      `select action from public.audit_logs where table_name='organizations' and row_id=$1`,
      [org.rows[0].id],
    );
    expect(logs.rows.map((r) => r.action)).toContain("insert");
    await c.query(`delete from public.organizations where id=$1`, [
      org.rows[0].id,
    ]);
    await c.end();
  });
});
