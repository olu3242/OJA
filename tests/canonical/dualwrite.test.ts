import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { migrate } from "../../scripts/canonical";
import { adminClient } from "./helpers";
import { resetDb } from "../helpers";
import { clearFlagCache } from "@/lib/flags";
import { parityCheck } from "@/server/repositories/reporting";
import { readSubscriptions } from "@/server/repositories/canonical-read";
import { subscribe, pause, resume } from "@/server/services/subscriptions";
import { confirmCycle } from "@/server/services/cycles";

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
    const read = await readSubscriptions(household.id);
    expect(read.source).toBe("legacy");
  });
});
