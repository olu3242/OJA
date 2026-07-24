import { beforeAll, describe, expect, it } from "vitest";
import Stripe from "stripe";
import { migrate } from "../../scripts/canonical";
import { adminClient } from "./helpers";
import { resetDb } from "../helpers";
import { db } from "@/lib/db";
import {
  settlePayment,
  refundPayment,
  issueStoreCredit,
  ledgerGateway,
  paymentGateway,
} from "@/server/services/payment-engine";
import {
  paymentMetrics,
  resolveCustomer,
} from "@/server/repositories/payments";
import { verifyStripeEvent, StripeSignatureError } from "@/lib/stripe";

/**
 * Payment engine (WS10) against the existing canonical payment tables. Uses the
 * internal Ledger gateway (no Stripe key present), which is a real settlement
 * backend that persists financial state — every assertion reads real rows.
 */
describe("payment engine — ledger settlement", () => {
  let household: { id: string };

  beforeAll(async () => {
    await migrate();
    const fx = await resetDb();
    household = fx.household;
    // Clear the legacy idempotency ledger so this run's fixed keys start fresh.
    await db.webhookEvent.deleteMany({
      where: { source: { in: ["payment", "refund"] } },
    });
    const c = await adminClient();
    await c.query(`delete from public.invoice_items`);
    await c.query(`delete from public.invoices`);
    await c.query(`delete from public.payment_events`);
    await c.query(`delete from public.credits`);
    await c.query(`delete from public.wallets`);
    await c.query(`delete from public.payments`);
    await c.end();
  });

  it("defaults to the ledger gateway when Stripe is not configured", () => {
    expect(paymentGateway()).toBe(ledgerGateway);
  });

  it("settles a payment: records a captured payment + event", async () => {
    const res = await settlePayment({
      accountId: household.id,
      kind: "one_time",
      amountCents: 6400,
      description: "GAARII Family — first delivery",
      idempotencyKey: "pay-1",
    });
    expect(res).toMatchObject({
      status: "captured",
      provider: "ledger",
      replayed: false,
    });

    const c = await adminClient();
    const pay = await c.query(
      `select amount_cents, currency, status, provider from public.payments where id = $1`,
      [res.paymentId],
    );
    const ev = await c.query(
      `select event_type from public.payment_events where payment_id = $1`,
      [res.paymentId],
    );
    await c.end();
    expect(pay.rows[0]).toMatchObject({
      amount_cents: 6400,
      currency: "USD",
      status: "captured",
      provider: "ledger",
    });
    expect(ev.rows.map((r) => r.event_type)).toContain("payment.captured");
  });

  it("auto-generates a paid invoice matching the captured amount", async () => {
    const res = await settlePayment({
      accountId: household.id,
      kind: "one_time",
      amountCents: 5500,
      description: "one-time garri",
      idempotencyKey: "pay-invoice",
    });
    const c = await adminClient();
    const inv = await c.query(
      `select total_cents, paid_at from public.invoices
        where customer_id = (select customer_id from public.payments where id = $1)
          and total_cents = 5500`,
      [res.paymentId],
    );
    await c.end();
    expect(inv.rowCount).toBe(1);
    expect(Number(inv.rows[0].total_cents)).toBe(5500);
    expect(inv.rows[0].paid_at).not.toBeNull(); // marked paid on capture
  });

  it("is idempotent: a replayed settle returns the same payment, charges once", async () => {
    const first = await settlePayment({
      accountId: household.id,
      kind: "subscription",
      amountCents: 2900,
      description: "Starter",
      idempotencyKey: "pay-dup",
    });
    const replay = await settlePayment({
      accountId: household.id,
      kind: "subscription",
      amountCents: 2900,
      description: "Starter",
      idempotencyKey: "pay-dup",
    });
    expect(first.replayed).toBe(false);
    expect(replay.replayed).toBe(true);
    expect(replay.paymentId).toBe(first.paymentId);

    const c = await adminClient();
    const n = await c.query(
      `select count(*)::int c from public.payments where provider_ref like 'ledger_ch_%'
         and amount_cents = 2900`,
    );
    await c.end();
    expect(n.rows[0].c).toBe(1); // exactly one payment for the duplicate key
  });

  it("refunds partially, then rejects a refund that exceeds the captured amount", async () => {
    const paid = await settlePayment({
      accountId: household.id,
      kind: "one_time",
      amountCents: 10000,
      description: "Stock-up",
      idempotencyKey: "pay-refund",
    });

    const partial = await refundPayment({
      paymentId: paid.paymentId,
      amountCents: 4000,
      reason: "freshness",
      idempotencyKey: "rf-1",
    });
    expect(partial).toMatchObject({
      refundedCents: 4000,
      fullyRefunded: false,
    });

    // 4000 already refunded + 7000 would exceed 10000 → rejected (double-refund guard)
    await expect(
      refundPayment({
        paymentId: paid.paymentId,
        amountCents: 7000,
        reason: "overreach",
        idempotencyKey: "rf-2",
      }),
    ).rejects.toThrow(/exceeds captured amount/);

    // remaining 6000 fully refunds and flips status
    const rest = await refundPayment({
      paymentId: paid.paymentId,
      amountCents: 6000,
      reason: "remainder",
      idempotencyKey: "rf-3",
    });
    expect(rest.fullyRefunded).toBe(true);

    const c = await adminClient();
    const p = await c.query(
      `select status from public.payments where id = $1`,
      [paid.paymentId],
    );
    await c.end();
    expect(p.rows[0].status).toBe("refunded");
  });

  it("issues store credit into the customer wallet", async () => {
    const res = await issueStoreCredit({
      accountId: household.id,
      amountCents: 500,
      reason: "sla_credit",
    });
    expect(res.walletBalanceCents).toBeGreaterThanOrEqual(500);

    const resolved = await resolveCustomer(household.id);
    const c = await adminClient();
    const w = await c.query(
      `select balance_cents from public.wallets where customer_id = $1`,
      [resolved!.customerId],
    );
    await c.end();
    expect(w.rows[0].balance_cents).toBeGreaterThanOrEqual(500);
  });

  it("computes live payment metrics from the ledger", async () => {
    const m = await paymentMetrics();
    expect(m.capturedCents).toBeGreaterThan(0);
    expect(m.refundedCents).toBe(10000); // the fully-refunded payment above
    expect(m.netCents).toBe(m.capturedCents - m.refundedCents);
    expect(m.paymentCount).toBeGreaterThanOrEqual(3);
    expect(m.refundRatePct).toBeGreaterThanOrEqual(0);
  });
});

describe("stripe webhook signature verification", () => {
  const secret = "whsec_test_abc";
  const payload = JSON.stringify({
    id: "evt_test_1",
    type: "payment_intent.succeeded",
    data: { object: { id: "pi_test_1" } },
  });

  it("accepts a correctly signed event", () => {
    const header = Stripe.webhooks.generateTestHeaderString({
      payload,
      secret,
    });
    const event = verifyStripeEvent(payload, header, secret);
    expect(event.id).toBe("evt_test_1");
    expect(event.type).toBe("payment_intent.succeeded");
  });

  it("rejects a tampered body", () => {
    const header = Stripe.webhooks.generateTestHeaderString({
      payload,
      secret,
    });
    expect(() => verifyStripeEvent(payload + " ", header, secret)).toThrow(
      StripeSignatureError,
    );
  });

  it("rejects a missing signature and a wrong secret", () => {
    const header = Stripe.webhooks.generateTestHeaderString({
      payload,
      secret,
    });
    expect(() => verifyStripeEvent(payload, null, secret)).toThrow(
      StripeSignatureError,
    );
    expect(() => verifyStripeEvent(payload, header, "whsec_wrong")).toThrow(
      StripeSignatureError,
    );
  });
});
