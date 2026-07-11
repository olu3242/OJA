import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { migrate } from "../../scripts/canonical";
import { adminClient } from "./helpers";
import { resetDb } from "../helpers";
import { clearFlagCache } from "@/lib/flags";
import { parityCheck } from "@/server/repositories/reporting";
import {
  readSubscriptions,
  readOrders,
} from "@/server/repositories/canonical-read";
import { subscribe, pause, resume } from "@/server/services/subscriptions";
import { confirmCycle } from "@/server/services/cycles";
import { refundOrder } from "@/server/services/fulfillment";
import { createStandingOrder } from "@/server/services/wholesale";
import {
  createGroupOrder,
  joinGroupOrder,
  closeGroupOrder,
} from "@/server/services/group";

/**
 * Convergence phases 3–5: live dual-write (subscription lifecycle + cycle/order)
 * and the parity-gated read cutover. Driven through the real production
 * services with the `canonical_dual_write` / `canonical_read` flags toggled via
 * env override — no batch converge is called; parity must hold from live writes
 * alone.
 */
describe("live dual-write + read cutover", () => {
  let household: { id: string };

  beforeAll(async () => {
    await migrate();
    const fx = await resetDb();
    household = fx.household;
    // Clean canonical commerce so parity reflects only live dual-writes.
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
    process.env.FLAG_CANONICAL_DUAL_WRITE = "1";
    clearFlagCache();
  });

  afterAll(() => {
    delete process.env.FLAG_CANONICAL_DUAL_WRITE;
    delete process.env.FLAG_CANONICAL_READ;
    clearFlagCache();
  });

  it("mirrors a new subscription into canonical on write (phase 3)", async () => {
    const { subscription } = await subscribe({
      accountId: household.id,
      plan: "FAMILY",
      variety: "WHITE_IJEBU",
      address: {
        line1: "12 Eba St",
        city: "Houston",
        state: "TX",
        zip: "77001",
      },
    });
    expect(subscription.status).toBe("ACTIVE");

    const c = await adminClient();
    const canon = await c.query(
      `select s.status, s.price_cents, i.qty, v.variant
         from public.subscriptions s
         join public.subscription_items i on i.subscription_id = s.id
         join public.product_variants v on v.id = i.product_variant_id`,
    );
    await c.end();
    expect(canon.rowCount).toBe(1);
    expect(canon.rows[0]).toMatchObject({
      status: "active",
      price_cents: 6400,
      variant: "WHITE_IJEBU",
    });
    expect(Number(canon.rows[0].qty)).toBe(12);
  });

  it("mirrors lifecycle transitions with no batch converge (phase 3)", async () => {
    const sub = await db.subscription.findFirstOrThrow({
      where: { accountId: household.id },
    });
    await pause(sub.id);
    let c = await adminClient();
    let row = await c.query(`select status from public.subscriptions`);
    await c.end();
    expect(row.rows[0].status).toBe("paused");

    await resume(sub.id);
    c = await adminClient();
    row = await c.query(`select status from public.subscriptions`);
    await c.end();
    expect(row.rows[0].status).toBe("active");
  });

  it("mirrors the confirmed cycle → order live, and parity holds (phase 4)", async () => {
    const cycle = await db.cycle.findFirstOrThrow({
      where: { subscription: { accountId: household.id }, status: "UPCOMING" },
    });
    await confirmCycle(cycle.id);

    const c = await adminClient();
    const order = await c.query(
      `select o.status, o.total_cents, d.status as delivery_status
         from public.orders o
         join public.subscription_deliveries d on d.order_id = o.id`,
    );
    await c.end();
    expect(order.rowCount).toBe(1);
    expect(order.rows[0]).toMatchObject({
      status: "paid",
      total_cents: Math.round(6400 * 0.9),
      delivery_status: "ordered",
    });

    // Live writes alone kept the two schemas in parity — no converge() called.
    const parity = await parityCheck();
    expect(parity.inParity).toBe(true);
  });

  it("mirrors a refund: order → refunded + canonical refund row, parity holds (refunds)", async () => {
    const order = await db.order.findFirstOrThrow({
      where: { accountId: household.id },
    });
    await refundOrder(order.id, "FRESHNESS");

    const c = await adminClient();
    const canon = await c.query(
      `select o.status, r.amount_cents, r.reason_code
         from public.orders o
         join public.refunds r on r.order_id = o.id`,
    );
    await c.end();
    expect(canon.rowCount).toBe(1);
    expect(canon.rows[0]).toMatchObject({
      status: "refunded",
      reason_code: "FRESHNESS",
    });
    expect(canon.rows[0].amount_cents).toBe(order.totalCents);

    // Refund count now matches on both sides; revenue unaffected → still parity.
    const parity = await parityCheck();
    expect(parity.inParity).toBe(true);
  });

  it("mirrors a wholesale standing order as WHOLESALE_STANDING (standing orders)", async () => {
    const store = await db.account.create({
      data: {
        email: `store${Date.now()}@test.gaarii`,
        name: "Lagos Market",
        businessName: "Lagos Market",
        role: "STORE",
        b2bVerified: true,
        b2bVerifiedAt: new Date(),
      },
    });
    await createStandingOrder({
      accountId: store.id,
      variety: "WHITE_IJEBU",
      qtyLbs: 100,
    });

    const c = await adminClient();
    const canon = await c.query(
      `select s.plan, s.cadence_days, s.status, i.qty
         from public.subscriptions s
         join public.legacy_map m on m.canonical_id = s.customer_id
           and m.legacy_table = 'accounts' and m.legacy_id = $1
         join public.subscription_items i on i.subscription_id = s.id`,
      [store.id],
    );
    await c.end();
    expect(canon.rowCount).toBe(1);
    expect(canon.rows[0]).toMatchObject({
      plan: "WHOLESALE_STANDING",
      cadence_days: 7,
      status: "active",
    });
    expect(Number(canon.rows[0].qty)).toBe(100);

    // Fully mirrored store account (+1 customer, +1 active sub both sides).
    const parity = await parityCheck();
    expect(parity.inParity).toBe(true);
  });

  it("mirrors an aggregated group order onto the creator's tenant (group buying)", async () => {
    const creator = await db.account.create({
      data: {
        email: `creator${Date.now()}@test.gaarii`,
        name: "Host",
        role: "COMMUNITY",
      },
    });
    const group = await createGroupOrder(creator.id, {
      line1: "9 Drop Rd",
      city: "Houston",
      state: "TX",
      zip: "77002",
    });
    const m1 = await db.account.create({
      data: {
        email: `gm1${Date.now()}@test.gaarii`,
        name: "M1",
        role: "HOUSEHOLD",
      },
    });
    const m2 = await db.account.create({
      data: {
        email: `gm2${Date.now()}@test.gaarii`,
        name: "M2",
        role: "HOUSEHOLD",
      },
    });
    await joinGroupOrder(group.code, m1.id, "FAMILY", "WHITE_IJEBU");
    await joinGroupOrder(group.code, m2.id, "FAMILY", "WHITE_IJEBU");
    const { order } = await closeGroupOrder(group.code);

    const c = await adminClient();
    const canon = await c.query(
      `select o.status, o.total_cents, sum(i.qty)::int as qty
         from public.orders o
         join public.order_items i on i.order_id = o.id
         join public.legacy_map m on m.canonical_id = o.customer_id
           and m.legacy_table = 'accounts' and m.legacy_id = $1
        group by o.id, o.status, o.total_cents`,
      [creator.id],
    );
    await c.end();
    expect(canon.rowCount).toBe(1);
    expect(canon.rows[0].status).toBe("paid");
    expect(canon.rows[0].total_cents).toBe(order.totalCents);
    // Two FAMILY members × 12 lb, aggregated into one canonical order line set.
    expect(canon.rows[0].qty).toBe(24);
  });

  it("does NOT mirror when the flag is off (kill-switch)", async () => {
    process.env.FLAG_CANONICAL_DUAL_WRITE = "0";
    clearFlagCache();
    const solo = await db.account.create({
      data: {
        email: `nomirror${Date.now()}@test.gaarii`,
        name: "Solo",
        role: "HOUSEHOLD",
      },
    });
    await subscribe({
      accountId: solo.id,
      plan: "STARTER",
      variety: "YELLOW",
      address: { line1: "1 Off St", city: "Austin", state: "TX", zip: "73301" },
    });
    const c = await adminClient();
    const mapped = await c.query(
      `select 1 from public.legacy_map where legacy_table='accounts' and legacy_id=$1`,
      [solo.id],
    );
    await c.end();
    expect(mapped.rowCount).toBe(0); // legacy write only; parity now drifts

    const parity = await parityCheck();
    expect(parity.inParity).toBe(false);

    process.env.FLAG_CANONICAL_DUAL_WRITE = "1";
    clearFlagCache();
  });

  it("serves reads from canonical when the read flag is on (phase 5)", async () => {
    process.env.FLAG_CANONICAL_READ = "1";
    clearFlagCache();
    const read = await readSubscriptions(household.id);
    expect(read.source).toBe("canonical");
    expect(read.subscriptions).toHaveLength(1);
    expect(read.subscriptions[0]).toMatchObject({
      plan: "FAMILY",
      variety: "WHITE_IJEBU",
      status: "ACTIVE",
      qtyLbs: 12,
      priceCents: 6400,
    });
  });

  it("serves order history from canonical with refunded totals (order read cutover)", async () => {
    process.env.FLAG_CANONICAL_READ = "1";
    clearFlagCache();
    // household's one order was confirmed (phase 4) then refunded (refunds test).
    const read = await readOrders(household.id);
    expect(read.source).toBe("canonical");
    expect(read.orders).toHaveLength(1);
    expect(read.orders[0]).toMatchObject({
      status: "REFUNDED",
      totalCents: Math.round(6400 * 0.9),
      refundedCents: Math.round(6400 * 0.9),
    });
    expect(read.orders[0].lines).toEqual([
      { qtyLbs: 12, variety: "WHITE_IJEBU" },
    ]);
  });

  it("order read falls back to legacy for an unmirrored account", async () => {
    process.env.FLAG_CANONICAL_READ = "1";
    process.env.FLAG_CANONICAL_DUAL_WRITE = "0"; // legacy-only
    clearFlagCache();
    const walkin = await db.account.create({
      data: {
        email: `walkin${Date.now()}@test.gaarii`,
        name: "Walkin",
        role: "HOUSEHOLD",
      },
    });
    const sku = await db.sku.findFirstOrThrow({ where: { code: "GAR-YEL" } });
    await db.order.create({
      data: {
        accountId: walkin.id,
        status: "PAID",
        totalCents: 2900,
        addressLine1: "7 Walk St",
        city: "Austin",
        state: "TX",
        zip: "73301",
        lines: {
          create: { skuId: sku.id, qtyUnits: 4, unitPriceCents: 725 },
        },
      },
    });
    process.env.FLAG_CANONICAL_DUAL_WRITE = "1";
    clearFlagCache();

    const read = await readOrders(walkin.id);
    expect(read.source).toBe("legacy"); // unmirrored → safe fallback, not empty
    expect(read.orders).toHaveLength(1);
    expect(read.orders[0]).toMatchObject({
      status: "PAID",
      totalCents: 2900,
      refundedCents: 0,
    });
    expect(read.orders[0].lines).toEqual([{ qtyLbs: 4, variety: "YELLOW" }]);
  });

  it("falls back to legacy read for an unmirrored account (parity-gated)", async () => {
    process.env.FLAG_CANONICAL_READ = "1";
    clearFlagCache();
    const fresh = await db.account.create({
      data: {
        email: `freshread${Date.now()}@test.gaarii`,
        name: "Fresh",
        role: "HOUSEHOLD",
      },
    });
    process.env.FLAG_CANONICAL_DUAL_WRITE = "0"; // legacy-only write
    clearFlagCache();
    await subscribe({
      accountId: fresh.id,
      plan: "STARTER",
      variety: "YELLOW",
      address: {
        line1: "5 Fresh St",
        city: "Dallas",
        state: "TX",
        zip: "75001",
      },
    });
    process.env.FLAG_CANONICAL_READ = "1";
    clearFlagCache();

    const read = await readSubscriptions(fresh.id);
    expect(read.source).toBe("legacy"); // not mirrored → safe fallback, not empty
    expect(read.subscriptions).toHaveLength(1);
  });

  it("read flag off always serves legacy", async () => {
    delete process.env.FLAG_CANONICAL_READ;
    clearFlagCache();
    expect((await readSubscriptions(household.id)).source).toBe("legacy");
    expect((await readOrders(household.id)).source).toBe("legacy");
  });
});
