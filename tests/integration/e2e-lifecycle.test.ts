import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { migrate } from "../../scripts/canonical";
import { adminClient } from "../canonical/helpers";
import { resetDb } from "../helpers";
import { clearFlagCache } from "@/lib/flags";
import { subscribe } from "@/server/services/subscriptions";
import { confirmCycle } from "@/server/services/cycles";
import {
  createPurchaseOrder,
  receivePoLine,
} from "@/server/services/procurement";
import {
  generateWave,
  confirmPick,
  dispatch,
  markDelivered,
} from "@/server/services/fulfillment";
import { stockOnHand } from "@/server/services/inventory";
import { createStandingOrder } from "@/server/services/wholesale";
import { settlePayment } from "@/server/services/payment-engine";
import { paymentMetrics } from "@/server/repositories/payments";
import { parityCheck } from "@/server/repositories/reporting";
import { dashboard } from "@/server/services/metrics";

/**
 * E2E production convergence (zero-gap): drive the FULL journey through the real
 * production services — receive stock → subscribe → pay → confirm cycle → order
 * → wave/pick/pack → dispatch → deliver — and assert at each hop that the state
 * is valid, mirrored to canonical, financially consistent, and orphan-free. The
 * dual-write flag is on so the canonical schema stays in lockstep.
 */
describe("E2E lifecycle — household journey (zero-gap)", () => {
  let fx: Awaited<ReturnType<typeof resetDb>>;

  beforeAll(async () => {
    await migrate();
    fx = await resetDb();
    const c = await adminClient();
    await c.query(`delete from public.legacy_map`);
    await c.query(`delete from public.invoice_items`);
    await c.query(`delete from public.invoices`);
    await c.query(`delete from public.payment_events`);
    await c.query(`delete from public.payments`);
    await c.query(`delete from public.credits`);
    await c.query(`delete from public.wallets`);
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
    await c.query(`delete from public.customers`);
    await c.end();
    process.env.FLAG_CANONICAL_DUAL_WRITE = "1";
    clearFlagCache();
  });

  afterAll(() => {
    delete process.env.FLAG_CANONICAL_DUAL_WRITE;
    clearFlagCache();
  });

  it("runs visitor→delivery with valid state, mirroring, and no orphans", async () => {
    // 1. Supply chain: receive 100 lb of White garri so fulfillment can allocate.
    const po = await createPurchaseOrder({
      supplierId: fx.supplier.id,
      warehouseId: fx.warehouse.id,
      lines: [{ skuId: fx.white.id, qtyUnits: 100, unitCostCents: 150 }],
      place: true,
    });
    await receivePoLine({
      poLineId: po.lines[0].id,
      qtyUnits: 100,
      lotCode: "LOT-E2E-1",
      qcPassed: true,
    });
    expect(await stockOnHand(fx.white.id, fx.warehouse.id)).toBe(100);

    // 2. Subscribe (household onboarding → subscription).
    const { subscription, firstCycle } = await subscribe({
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
    expect(subscription.status).toBe("ACTIVE");

    // 3. Payment → canonical ledger (captured).
    const pay = await settlePayment({
      accountId: fx.household.id,
      kind: "subscription",
      amountCents: subscription.priceCents,
      description: "GAARII Family subscription",
      idempotencyKey: `e2e-pay-${subscription.id}`,
    });
    expect(pay.status).toBe("captured");

    // 4. Confirm cycle → PAID order (mirrored live to canonical).
    const order = await confirmCycle(firstCycle.id);
    expect(order.status).toBe("PAID");
    expect(order.totalCents).toBe(Math.round(subscription.priceCents * 0.9));

    // 5. Fulfilment: wave → pick → pack (inventory allocated FEFO).
    const waves = await generateWave(fx.warehouse.id);
    const wave = waves.find((w) => w.orderId === order.id);
    expect(wave).toBeDefined();
    await confirmPick(order.id, wave!.picks);
    expect(await stockOnHand(fx.white.id, fx.warehouse.id)).toBe(100 - 12);

    // 6. Dispatch → shipment with tracking.
    const shipped = await dispatch(order.id);
    expect(shipped.status).toBe("SHIPPED");
    expect(shipped.trackingCode).toBeTruthy();

    // 7. Deliver → terminal valid state + DELIVERY demand event + cycle FULFILLED.
    const delivered = await markDelivered(order.id);
    expect(delivered.status).toBe("DELIVERED");
    const cycle = await db.cycle.findUniqueOrThrow({
      where: { id: firstCycle.id },
    });
    expect(cycle.status).toBe("FULFILLED");

    // --- Zero-gap assertions -------------------------------------------------

    // (a) Forecast signal: subscribe + delivery demand events emitted.
    const demand = await db.demandEvent.groupBy({
      by: ["type"],
      _count: true,
      where: { accountId: fx.household.id },
    });
    const types = demand.map((d) => d.type);
    expect(types).toContain("SUBSCRIBE");
    expect(types).toContain("DELIVERY");

    // (b) Financial consistency: exactly one captured ledger payment.
    const pm = await paymentMetrics();
    expect(pm.capturedCents).toBe(subscription.priceCents);
    expect(pm.paymentCount).toBe(1);
    expect(pm.refundedCents).toBe(0);

    // (c) Canonical mirror in lockstep — parity holds from live writes.
    const parity = await parityCheck();
    expect(parity.inParity).toBe(true);

    // (d) Canonical terminal state: order delivered, shipment delivered, tracking.
    const c = await adminClient();
    const canonOrder = await c.query(
      `select o.status, sh.status ship_status, sh.tracking_code
         from public.orders o
         join public.shipments sh on sh.order_id = o.id`,
    );
    expect(canonOrder.rows[0]).toMatchObject({
      status: "delivered",
      ship_status: "delivered",
    });
    expect(canonOrder.rows[0].tracking_code).toBe(shipped.trackingCode);

    // (e) NO ORPHANS anywhere in the canonical commerce+payment graph.
    const orphans = await c.query(`
      select
        (select count(*) from public.customers c
           where not exists (select 1 from public.organizations o where o.id=c.organization_id)) c_no_org,
        (select count(*) from public.subscriptions s
           where not exists (select 1 from public.customers c where c.id=s.customer_id)) s_no_cust,
        (select count(*) from public.order_items i
           where not exists (select 1 from public.orders o where o.id=i.order_id)) oi_no_order,
        (select count(*) from public.shipments sh
           where not exists (select 1 from public.orders o where o.id=sh.order_id)) sh_no_order,
        (select count(*) from public.payments p
           where not exists (select 1 from public.customers c where c.id=p.customer_id)) p_no_cust,
        (select count(*) from public.payment_events e
           where not exists (select 1 from public.payments p where p.id=e.payment_id)) e_no_pay`);
    await c.end();
    expect(Object.values(orphans.rows[0]).every((v) => Number(v) === 0)).toBe(
      true,
    );

    // (f) Admin visibility: the journey shows up in the north-star dashboard.
    const dash = await dashboard();
    expect(dash.subscribers.active).toBeGreaterThanOrEqual(1);
    expect(dash.onTimeShipRate).not.toBeNull();
  });

  it("settles a wholesale standing order end-to-end into the ledger", async () => {
    const store = await db.account.create({
      data: {
        email: `e2e-store-${Date.now()}@test.gaarii`,
        name: "Lagos Foods",
        businessName: "Lagos Foods",
        role: "STORE",
        b2bVerified: true,
        b2bVerifiedAt: new Date(),
      },
    });
    const standing = await createStandingOrder({
      accountId: store.id,
      variety: "WHITE_IJEBU",
      qtyLbs: 80,
    });
    const pay = await settlePayment({
      accountId: store.id,
      kind: "wholesale",
      amountCents: standing.priceCents,
      description: "Weekly wholesale standing order",
      idempotencyKey: `e2e-wholesale-${standing.id}`,
    });
    expect(pay.status).toBe("captured");

    // Idempotent re-settle (e.g. retried request) creates no second charge.
    const replay = await settlePayment({
      accountId: store.id,
      kind: "wholesale",
      amountCents: standing.priceCents,
      description: "Weekly wholesale standing order",
      idempotencyKey: `e2e-wholesale-${standing.id}`,
    });
    expect(replay.replayed).toBe(true);
    expect(replay.paymentId).toBe(pay.paymentId);

    const c = await adminClient();
    const n = await c.query(
      `select count(*)::int c from public.payments where provider_ref = (
         select provider_ref from public.payments where id = $1)`,
      [pay.paymentId],
    );
    await c.end();
    expect(n.rows[0].c).toBe(1); // one payment, no duplicate
  });
});
