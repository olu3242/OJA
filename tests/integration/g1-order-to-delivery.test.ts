import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { resetDb } from "../helpers";
import { subscribe } from "@/server/services/subscriptions";
import { confirmCycle } from "@/server/services/cycles";
import {
  createPurchaseOrder,
  receivePoLine,
} from "@/server/services/procurement";
import {
  confirmPick,
  dispatch,
  generateWave,
  markDelivered,
} from "@/server/services/fulfillment";
import { recallLot, stockOnHand } from "@/server/services/inventory";

/**
 * Gate G1 (task 1.10): the full order-to-delivery loop —
 * PO → receive (lot+QC) → subscription order → FEFO pick → pack → dispatch →
 * delivered — plus the recall query, against a real Postgres.
 */
describe("Gate G1 — subscription-to-doorstep e2e", () => {
  let fx: Awaited<ReturnType<typeof resetDb>>;

  beforeAll(async () => {
    fx = await resetDb();
  });

  it("runs PO → receive with lot + QC into the inventory ledger", async () => {
    const po = await createPurchaseOrder({
      supplierId: fx.supplier.id,
      warehouseId: fx.warehouse.id,
      place: true,
      lines: [{ skuId: fx.white.id, qtyUnits: 100, unitCostCents: 150 }],
    });

    // Two lots with different expiries to exercise FEFO later; QC-fail a third
    await receivePoLine({
      poLineId: po.lines[0].id,
      qtyUnits: 40,
      lotCode: "LOT-LATER",
      expiresAt: new Date("2027-06-01"),
      qcPassed: true,
    });
    await receivePoLine({
      poLineId: po.lines[0].id,
      qtyUnits: 40,
      lotCode: "LOT-SOONER",
      expiresAt: new Date("2026-12-01"),
      qcPassed: true,
    });
    const failed = await receivePoLine({
      poLineId: po.lines[0].id,
      qtyUnits: 20,
      lotCode: "LOT-BAD",
      qcPassed: false,
      qcNotes: "sour smell — spec fail",
    });

    expect(failed.lot).toBeNull(); // QC fail stocks nothing
    expect(await stockOnHand(fx.white.id, fx.warehouse.id)).toBe(80);
    // 80/100 accepted — QC-rejected units stay outstanding on the PO
    const updated = await db.purchaseOrder.findUniqueOrThrow({
      where: { id: po.id },
    });
    expect(updated.status).toBe("PARTIALLY_RECEIVED");
  });

  it("subscribes a household and confirms the first cycle into a paid order", async () => {
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
    expect(subscription.qtyLbs).toBe(12);

    const order = await confirmCycle(firstCycle.id, undefined, {
      line1: "12 Eba St",
      city: "Houston",
      state: "TX",
      zip: "77001",
    });
    expect(order.status).toBe("PAID");
    // First delivery discount: 10% off $64.00
    expect(order.totalCents).toBe(Math.round(6400 * 0.9));

    const events = await db.demandEvent.findMany({
      where: { type: "CONFIRM" },
    });
    expect(events).toHaveLength(1);
  });

  it("picks FEFO (soonest expiry first), packs, ships, and delivers", async () => {
    const waves = await generateWave(fx.warehouse.id);
    expect(waves).toHaveLength(1);
    const picks = waves[0].picks;
    // FEFO: the 12 lb must come entirely from LOT-SOONER (expires first)
    expect(picks).toHaveLength(1);
    expect(picks[0].lotCode).toBe("LOT-SOONER");
    expect(picks[0].qtyUnits).toBe(12);

    const packed = await confirmPick(
      waves[0].orderId,
      picks.map((p) => ({
        orderLineId: p.orderLineId,
        lotCode: p.lotCode,
        qtyUnits: p.qtyUnits,
      })),
    );
    expect(packed.status).toBe("PACKED");
    expect(await stockOnHand(fx.white.id, fx.warehouse.id)).toBe(68);

    const shipped = await dispatch(waves[0].orderId);
    expect(shipped.status).toBe("SHIPPED");
    expect(shipped.trackingCode).toMatch(/^TRK-/);

    // Idempotent dispatch (task 3.4): re-dispatching returns same tracking
    const again = await dispatch(waves[0].orderId);
    expect(again.trackingCode).toBe(shipped.trackingCode);

    const delivered = await markDelivered(waves[0].orderId);
    expect(delivered.status).toBe("DELIVERED");

    const cycle = await db.cycle.findFirstOrThrow();
    expect(cycle.status).toBe("FULFILLED");
  });

  it("answers the recall query: lot → orders → customers (task 1.9)", async () => {
    const recall = await recallLot("LOT-SOONER");
    expect(recall.affectedOrders).toHaveLength(1);
    expect(recall.affectedOrders[0].accountEmail).toBe("amara@test.gaarii");
    expect(recall.affectedOrders[0].qtyUnits).toBe(12);

    const clean = await recallLot("LOT-LATER");
    expect(clean.affectedOrders).toHaveLength(0);
  });

  it("notified the subscriber at each milestone", async () => {
    const logs = await db.notificationLog.findMany({
      where: { accountId: fx.household.id },
    });
    const templates = logs.map((l) => l.template);
    for (const t of [
      "subscription_confirmed",
      "order_confirmed",
      "out_for_delivery",
      "delivered",
    ]) {
      expect(templates).toContain(t);
    }
  });
});
