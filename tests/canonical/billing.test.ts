import { beforeAll, describe, expect, it } from "vitest";
import { migrate } from "../../scripts/canonical";
import { adminClient } from "./helpers";
import { resetDb } from "../helpers";
import { db } from "@/lib/db";
import { subscribe } from "@/server/services/subscriptions";
import { settleRenewal } from "@/server/services/billing";

/**
 * Recurring renewal settlement over the canonical ledger. Each renewal cycle is
 * charged exactly once; a replayed renewal for the same cycle reuses the
 * original payment rather than creating a second charge.
 */
describe("recurring renewal settle", () => {
  let firstCycleId: string;
  let secondCycleId: string;
  const RENEWAL_CENTS = 6400;

  beforeAll(async () => {
    await migrate();
    const fx = await resetDb();
    await db.webhookEvent.deleteMany({ where: { source: "payment" } });
    const c = await adminClient();
    await c.query(`delete from public.payment_events`);
    await c.query(`delete from public.payments`);
    await c.end();

    const sub = await subscribe({
      accountId: fx.household.id,
      plan: "FAMILY",
      variety: "WHITE_IJEBU",
      address: {
        line1: "1 Fufu Ln",
        city: "Dallas",
        state: "TX",
        zip: "75001",
      },
    });
    firstCycleId = sub.firstCycle.id;
    expect(sub.subscription.priceCents).toBe(RENEWAL_CENTS);
    const second = await db.cycle.create({
      data: { subscriptionId: sub.subscription.id, scheduledFor: new Date() },
    });
    secondCycleId = second.id;
  });

  it("settles two distinct renewal cycles as two distinct charges", async () => {
    const first = await settleRenewal(firstCycleId);
    const second = await settleRenewal(secondCycleId);
    expect(first.replayed).toBe(false);
    expect(second.replayed).toBe(false);
    expect(first.paymentId).not.toBe(second.paymentId);

    const c = await adminClient();
    const r = await c.query(
      `select count(*)::int as n from public.payments where amount_cents = $1`,
      [RENEWAL_CENTS],
    );
    await c.end();
    expect(Number(r.rows[0].n)).toBe(2);
  });

  it("replays a re-settled cycle without double-charging", async () => {
    const replay = await settleRenewal(firstCycleId);
    expect(replay.replayed).toBe(true);

    const c = await adminClient();
    const r = await c.query(
      `select count(*)::int as n from public.payments where amount_cents = $1`,
      [RENEWAL_CENTS],
    );
    await c.end();
    expect(Number(r.rows[0].n)).toBe(2); // still two — no third charge
  });
});
