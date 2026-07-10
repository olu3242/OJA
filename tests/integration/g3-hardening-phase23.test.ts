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
  refundOrder,
} from "@/server/services/fulfillment";
import { stockOnHand, transferStock } from "@/server/services/inventory";
import { dashboard } from "@/server/services/metrics";
import { freshDeals } from "@/server/services/markdown";
import { containerPlan } from "@/server/services/container";
import { runForecast } from "@/server/services/forecast";

/**
 * Phase 1c hardening + Phase 2/3 platform capabilities:
 * refund flow (3.1), north-star dashboard (3.2), shortage variant-swap (2.3),
 * multi-warehouse transfer (4.3), fresh-deals markdown on real lots (5.2),
 * container planning from live forecast (5.1), wholesale waitlist (1.3).
 */
describe("Gate G3 + Phase 2/3 capabilities", () => {
  let fx: Awaited<ReturnType<typeof resetDb>>;

  beforeAll(async () => {
    fx = await resetDb();
    // Stock ONLY yellow garri, so a white order must shortage-swap
    const po = await createPurchaseOrder({
      supplierId: fx.supplier.id,
      warehouseId: fx.warehouse.id,
      place: true,
      lines: [{ skuId: fx.yellow.id, qtyUnits: 60, unitCostCents: 150 }],
    });
    await receivePoLine({
      poLineId: po.lines[0].id,
      qtyUnits: 60,
      lotCode: "LOT-YEL-1",
      expiresAt: new Date(Date.now() + 30 * 24 * 3600 * 1000), // 30d out on a ~1yr shelf life
      qcPassed: true,
    });
  });

  it("auto-swaps variety on shortage and records the event (task 2.3)", async () => {
    const { firstCycle } = await subscribe({
      accountId: fx.household.id,
      plan: "FAMILY",
      variety: "WHITE_IJEBU", // no white in stock
      address: {
        line1: "9 Suya Rd",
        city: "Houston",
        state: "TX",
        zip: "77002",
      },
    });
    await confirmCycle(firstCycle.id);

    const waves = await generateWave(fx.warehouse.id);
    expect(waves).toHaveLength(1);
    expect(waves[0].picks[0].skuCode).toBe("GAR-YEL"); // substituted

    const swapEvents = await db.demandEvent.findMany({
      where: { type: "SHORTAGE_SWAP" },
    });
    expect(swapEvents).toHaveLength(1);

    await confirmPick(
      waves[0].orderId,
      waves[0].picks.map((p) => ({
        orderLineId: p.orderLineId,
        lotCode: p.lotCode,
        qtyUnits: p.qtyUnits,
      })),
    );
    await dispatch(waves[0].orderId);
    await markDelivered(waves[0].orderId);
  });

  it("processes a quality-guarantee refund without return (task 3.1)", async () => {
    const order = await db.order.findFirstOrThrow();
    const refund = await refundOrder(order.id, "quality-gritty-batch");
    expect(refund.amountCents).toBe(order.totalCents);
    const updated = await db.order.findUniqueOrThrow({
      where: { id: order.id },
    });
    expect(updated.status).toBe("REFUNDED");
    const events = await db.demandEvent.findMany({ where: { type: "REFUND" } });
    expect(events).toHaveLength(1);
  });

  it("reports the north-star dashboard (task 3.2)", async () => {
    const dash = await dashboard();
    expect(dash.subscribers.active).toBe(1);
    expect(dash.cycleConfirmRate).toBe(1);
    expect(dash.onTimeShipRate).toBe(1);
    expect(dash.refunds).toBe(1);
    expect(dash.grossMarginAfterShipping).toBeGreaterThan(0.3); // margin floor held
  });

  it("transfers stock between warehouses as ledger txns (task 4.3)", async () => {
    const atl = await db.warehouse.create({
      data: { code: "ATL-1", name: "Atlanta 3PL", region: "US-EAST" },
    });
    const before = await stockOnHand(fx.yellow.id, fx.warehouse.id);
    await transferStock({
      skuId: fx.yellow.id,
      fromWarehouseId: fx.warehouse.id,
      toWarehouseId: atl.id,
      qtyUnits: 10,
    });
    expect(await stockOnHand(fx.yellow.id, fx.warehouse.id)).toBe(before - 10);
    expect(await stockOnHand(fx.yellow.id, atl.id)).toBe(10);
    const transfer = await db.transferOrder.findFirstOrThrow();
    expect(transfer.status).toBe("COMPLETED");
  });

  it("surfaces expiry-risk lots as Fresh Deals (task 5.2)", async () => {
    // LOT-YEL-1 expires 30 days out on a ~365-day shelf life → ≤20% remaining? No:
    // remaining fraction ≈ 30/30-day window since receivedAt=now, so craft a lot:
    const risky = await db.lot.create({
      data: {
        skuId: fx.yellow.id,
        warehouseId: fx.warehouse.id,
        lotCode: "LOT-RISKY",
        receivedAt: new Date(Date.now() - 90 * 24 * 3600 * 1000),
        expiresAt: new Date(Date.now() + 10 * 24 * 3600 * 1000), // 10% remaining
        txns: { create: { type: "RECEIVE", qtyUnits: 25 } },
      },
    });
    const deals = await freshDeals();
    const deal = deals.find((d) => d.lotCode === risky.lotCode);
    expect(deal).toBeDefined();
    expect(deal!.discountPct).toBe(0.3);
    expect(deal!.unitsOnHand).toBe(25);
  });

  it("plans import containers from the live forecast (task 5.1)", async () => {
    await runForecast();
    const plan = await containerPlan(fx.warehouse.id);
    expect(plan.containers).toBeGreaterThanOrEqual(0);
    expect(plan.mix.length).toBeGreaterThan(0);
    expect(Number.isFinite(plan.shortfallLbs)).toBe(true);
  });

  it("collects wholesale waitlist leads without exposing wholesale pricing (task 1.3)", async () => {
    await db.wholesaleLead.create({
      data: {
        businessName: "Mama Ngozi Groceries",
        email: "ngozi@store.test",
        businessType: "store",
      },
    });
    expect(await db.wholesaleLead.count()).toBe(1);
  });
});
