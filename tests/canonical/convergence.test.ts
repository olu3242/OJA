import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { migrate } from "../../scripts/canonical";
import { adminClient } from "./helpers";
import { resetDb } from "../helpers";
import { convergeLegacyData } from "@/server/repositories/convergence";
import { subscribe } from "@/server/services/subscriptions";
import { confirmCycle, skipCycle } from "@/server/services/cycles";

/**
 * Convergence step 1 (C5): legacy Prisma commerce → canonical schema.
 * Seeds real legacy data through the production services, converges, and
 * proves parity + idempotency + zero orphans.
 */
describe("legacy → canonical convergence", () => {
  let legacyAccountId: string;

  beforeAll(async () => {
    await migrate();
    const fx = await resetDb(); // fresh legacy Prisma DB with garri SKUs
    legacyAccountId = fx.household.id;

    // Legacy activity via the real services: subscribe → confirm; second
    // household subscribes and skips.
    const a = await subscribe({
      accountId: fx.household.id,
      plan: "FAMILY",
      variety: "WHITE_IJEBU",
      address: {
        line1: "12 Eba St",
        city: "Houston",
        state: "TX",
        zip: "77001",
      },
    });
    await confirmCycle(a.firstCycle.id);

    const other = await db.account.create({
      data: {
        email: `conv-tunde${Date.now()}@test.gaarii`,
        name: "Tunde",
        role: "HOUSEHOLD",
      },
    });
    const b = await subscribe({
      accountId: other.id,
      plan: "STARTER",
      variety: "YELLOW",
      address: { line1: "2 Eko St", city: "Austin", state: "TX", zip: "73301" },
    });
    await skipCycle(b.firstCycle.id);

    // Clear any prior convergence state in the canonical DB for a clean assert
    const c = await adminClient();
    await c.query(`delete from public.legacy_map`);
    await c.query(`delete from public.refunds`);
    await c.query(`delete from public.order_items`);
    await c.query(`update public.subscription_deliveries set order_id = null`);
    await c.query(`delete from public.orders`);
    await c.query(`delete from public.subscription_deliveries`);
    await c.query(`delete from public.subscription_items`);
    await c.query(`delete from public.subscriptions`);
    await c.query(`delete from public.customers`);
    await c.end();
  });

  it("backfills organizations, customers, subscriptions, deliveries, and orders", async () => {
    const report = await convergeLegacyData();
    expect(report.orphans).toEqual([]);
    expect(report.organizations).toBe(2);
    expect(report.customers).toBe(2);
    expect(report.subscriptions).toBe(2);
    expect(report.deliveries).toBe(2); // one confirmed→ordered, one skipped
    expect(report.orders).toBe(1);
    expect(report.orderItems).toBe(1);
  });

  it("lands parity data in the canonical schema with the delivery linked to its order", async () => {
    const c = await adminClient();
    const sub = await c.query(
      `select s.plan, s.status, s.price_cents, i.qty, v.sku
         from public.subscriptions s
         join public.subscription_items i on i.subscription_id = s.id
         join public.product_variants v on v.id = i.product_variant_id
        order by s.price_cents desc`,
    );
    expect(sub.rows[0]).toMatchObject({
      plan: "FAMILY",
      status: "active",
      price_cents: 6400,
      sku: "GAR-WHT-IJEBU",
    });
    expect(Number(sub.rows[0].qty)).toBe(12);

    const delivery = await c.query(
      `select d.status, o.status as order_status, o.total_cents
         from public.subscription_deliveries d
         join public.orders o on o.id = d.order_id
        where d.order_id is not null`,
    );
    expect(delivery.rowCount).toBe(1);
    expect(delivery.rows[0]).toMatchObject({
      status: "ordered",
      order_status: "paid",
      total_cents: Math.round(6400 * 0.9), // first-delivery discount preserved
    });

    const skipped = await c.query(
      `select count(*)::int n from public.subscription_deliveries where status='skipped'`,
    );
    expect(skipped.rows[0].n).toBe(1);
    await c.end();
  });

  it("is idempotent: re-running converges nothing new and duplicates nothing", async () => {
    const again = await convergeLegacyData();
    expect(again.organizations).toBe(0);
    expect(again.customers).toBe(0);
    expect(again.subscriptions).toBe(0);
    expect(again.deliveries).toBe(0);
    expect(again.orders).toBe(0);

    const c = await adminClient();
    const counts = await c.query(
      `select (select count(*)::int from public.customers) customers,
              (select count(*)::int from public.subscriptions) subs,
              (select count(*)::int from public.orders) orders`,
    );
    expect(counts.rows[0]).toEqual({ customers: 2, subs: 2, orders: 1 });
    await c.end();
  });

  it("records the legacy↔canonical bridge in legacy_map", async () => {
    const c = await adminClient();
    const mapped = await c.query(
      `select canonical_table from public.legacy_map where legacy_table='accounts' and legacy_id=$1`,
      [legacyAccountId],
    );
    expect(mapped.rows[0].canonical_table).toBe("customers");
    const total = await c.query(
      `select count(*)::int n from public.legacy_map`,
    );
    // 2 orgs + 2 customers + 2 subscriptions + 2 cycles + 1 order + 1 line
    expect(total.rows[0].n).toBe(10);
    await c.end();
  });
});
