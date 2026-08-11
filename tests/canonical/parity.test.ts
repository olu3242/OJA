import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { migrate } from "../../scripts/canonical";
import { adminClient } from "./helpers";
import { resetDb } from "../helpers";
import { convergeLegacyData } from "@/server/repositories/convergence";
import {
  canonicalKpis,
  legacyKpis,
  parityCheck,
} from "@/server/repositories/reporting";
import { subscribe } from "@/server/services/subscriptions";
import { confirmCycle } from "@/server/services/cycles";

/**
 * Convergence phase 2 — dual-read parity. After converging, legacy and
 * canonical KPI reads must agree; new legacy activity introduces drift that a
 * re-converge resolves. This is the shadow-read gate before any write cutover.
 */
describe("dual-read parity (legacy ↔ canonical)", () => {
  beforeAll(async () => {
    await migrate();
    const fx = await resetDb();
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

    // Clean canonical commerce for a deterministic parity assertion.
    const c = await adminClient();
    await c.query(`delete from public.legacy_map`);
    await c.query(`delete from public.shipments`);
    await c.query(`delete from public.refunds`);
    await c.query(`delete from public.returns`);
    await c.query(`delete from public.discounts`);
    await c.query(`delete from public.order_items`);
    await c.query(`update public.subscription_deliveries set order_id = null`);
    await c.query(`delete from public.orders`);
    await c.query(`delete from public.subscription_deliveries`);
    await c.query(`delete from public.subscription_items`);
    await c.query(`delete from public.subscriptions`);
    await c.query(`delete from public.invoice_items`);
    await c.query(`delete from public.invoices`);
    await c.query(`delete from public.payment_events`);
    await c.query(`delete from public.payments`);
    await c.query(`delete from public.payment_attempts`);
    await c.query(`delete from public.payment_methods`);
    await c.query(`delete from public.credits`);
    await c.query(`delete from public.wallets`);
    await c.query(`delete from public.customers`);
    await c.end();
  });

  it("reports drift before convergence and parity after", async () => {
    const before = await parityCheck();
    expect(before.inParity).toBe(false); // legacy has data, canonical is empty
    expect(before.drift.length).toBeGreaterThan(0);

    await convergeLegacyData();

    const after = await parityCheck();
    expect(after.drift).toEqual([]);
    expect(after.inParity).toBe(true);
    // The canonical read matches the legacy read field-for-field.
    expect(after.canonical).toEqual(after.legacy);
    expect(after.canonical.customers).toBe(1);
    expect(after.canonical.activeSubscriptions).toBe(1);
    expect(after.canonical.orders).toBe(1);
  });

  it("detects drift when new legacy activity lands, and re-converge restores parity", async () => {
    const extra = await db.account.create({
      data: {
        email: `parity-new${Date.now()}@test.gaarii`,
        name: "New",
        role: "HOUSEHOLD",
      },
    });
    await subscribe({
      accountId: extra.id,
      plan: "STARTER",
      variety: "YELLOW",
      address: { line1: "9 New St", city: "Dallas", state: "TX", zip: "75001" },
    });

    const drifted = await parityCheck();
    expect(drifted.inParity).toBe(false);
    const custDrift = drifted.drift.find((d) => d.metric === "customers");
    expect(custDrift).toMatchObject({ legacy: 2, canonical: 1 });

    await convergeLegacyData();
    const restored = await parityCheck();
    expect(restored.inParity).toBe(true);
  });

  it("canonicalKpis reads through the security-invoker view", async () => {
    const [canon, legacy] = await Promise.all([canonicalKpis(), legacyKpis()]);
    expect(canon.revenueCents).toBe(legacy.revenueCents);
    expect(canon.revenueCents).toBeGreaterThan(0); // discounted first order counted
  });

  it("registered the hourly convergence scheduled task", async () => {
    const c = await adminClient();
    const task = await c.query(
      `select cron from public.scheduled_tasks where key = 'legacy_convergence'`,
    );
    expect(task.rows[0].cron).toBe("0 * * * *");
    await c.end();
  });
});
