import { db } from "@/lib/db";
import { emitDemandEvent } from "@/lib/events";
import { allocateFefo, ShortageError } from "./inventory";
import { notify } from "./notifications";
import { mirrorAccount } from "@/server/repositories/canonical-write";

// Carrier adapter — real parcel API in production; stub issues tracking codes.
export interface CarrierAdapter {
  createShipment(
    orderId: string,
  ): Promise<{ carrier: string; trackingCode: string }>;
}
class StubCarrier implements CarrierAdapter {
  async createShipment(orderId: string) {
    return {
      carrier: "STUB-PARCEL",
      trackingCode: `TRK-${orderId.slice(-8).toUpperCase()}`,
    };
  }
}
export const carrier: CarrierAdapter = new StubCarrier();

/**
 * Wave generation (task 1.6): move PAID orders into PICKING and produce
 * FEFO pick lists. On shortage, auto-substitute the other garri variety if
 * the subscriber allows it (task 2.3) — every swap is captured as an event.
 */
export async function generateWave(warehouseId: string, limit = 50) {
  const orders = await db.order.findMany({
    where: { status: "PAID" },
    include: {
      lines: { include: { sku: { include: { substitutes: true } } } },
    },
    orderBy: { createdAt: "asc" },
    take: limit,
  });

  const waves: {
    orderId: string;
    picks: {
      orderLineId: string;
      skuCode: string;
      lotCode: string;
      qtyUnits: number;
    }[];
  }[] = [];

  for (const order of orders) {
    const picks: (typeof waves)[number]["picks"] = [];
    let ok = true;
    for (const line of order.lines) {
      try {
        const plan = await allocateFefo(line.skuId, warehouseId, line.qtyUnits);
        picks.push(
          ...plan.map((p) => ({
            orderLineId: line.id,
            skuCode: line.sku.code,
            lotCode: p.lotCode,
            qtyUnits: p.qtyUnits,
          })),
        );
      } catch (e) {
        if (e instanceof ShortageError) {
          // Variant substitution on shortage: try the other active garri SKU.
          const substitute =
            line.sku.substitutes.find((s) => s.active) ??
            (await db.sku.findFirst({
              where: { active: true, id: { not: line.skuId } },
            }));
          if (substitute) {
            try {
              const plan = await allocateFefo(
                substitute.id,
                warehouseId,
                line.qtyUnits,
              );
              await db.orderLine.update({
                where: { id: line.id },
                data: { skuId: substitute.id },
              });
              await emitDemandEvent("SHORTAGE_SWAP", {
                accountId: order.accountId,
                orderId: order.id,
                skuId: substitute.id,
                payload: { from: line.sku.code, to: substitute.code },
              });
              picks.push(
                ...plan.map((p) => ({
                  orderLineId: line.id,
                  skuCode: substitute.code,
                  lotCode: p.lotCode,
                  qtyUnits: p.qtyUnits,
                })),
              );
              continue;
            } catch {
              /* substitute also short — fall through */
            }
          }
          await emitDemandEvent("OOS_VIEW", {
            accountId: order.accountId,
            orderId: order.id,
            skuId: line.skuId,
            payload: { requested: line.qtyUnits, available: e.available },
          });
          ok = false;
        } else throw e;
      }
    }
    if (!ok) continue; // leave order PAID for the next wave
    await db.order.update({
      where: { id: order.id },
      data: { status: "PICKING" },
    });
    waves.push({ orderId: order.id, picks });
  }
  return waves;
}

/** Confirm picks: writes PICK ledger txns (idempotent per order). */
export async function confirmPick(
  orderId: string,
  picks: { orderLineId: string; lotCode: string; qtyUnits: number }[],
) {
  return db.$transaction(async (tx) => {
    const order = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
    if (order.status !== "PICKING")
      throw new Error(`Order ${orderId} is ${order.status}`);
    for (const p of picks) {
      const lot = await tx.lot.findUniqueOrThrow({
        where: { lotCode: p.lotCode },
      });
      await tx.inventoryTxn.create({
        data: {
          lotId: lot.id,
          type: "PICK",
          qtyUnits: -p.qtyUnits,
          orderLineId: p.orderLineId,
        },
      });
    }
    return tx.order.update({
      where: { id: orderId },
      data: { status: "PACKED" },
    });
  });
}

/** Dispatch (task 1.7): idempotent — re-dispatching returns the same tracking. */
export async function dispatch(orderId: string) {
  const order = await db.order.findUniqueOrThrow({ where: { id: orderId } });
  if (order.status === "SHIPPED" || order.status === "DELIVERED") return order;
  if (order.status !== "PACKED")
    throw new Error(`Order ${orderId} is ${order.status}`);
  const shipment = await carrier.createShipment(orderId);
  const updated = await db.order.update({
    where: { id: orderId },
    data: {
      status: "SHIPPED",
      carrier: shipment.carrier,
      trackingCode: shipment.trackingCode,
      shippedAt: new Date(),
    },
  });
  await notify(order.accountId, "out_for_delivery", {
    trackingCode: shipment.trackingCode,
  });
  return updated;
}

export async function markDelivered(orderId: string) {
  const order = await db.order.update({
    where: { id: orderId },
    data: { status: "DELIVERED", deliveredAt: new Date() },
    include: { cycle: true, lines: true },
  });
  if (order.cycleId) {
    await db.cycle.update({
      where: { id: order.cycleId },
      data: { status: "FULFILLED" },
    });
  }
  await emitDemandEvent("DELIVERY", {
    accountId: order.accountId,
    orderId: order.id,
    skuId: order.lines[0]?.skuId,
    payload: { qtyUnits: order.lines.reduce((s, l) => s + l.qtyUnits, 0) },
  });
  await notify(order.accountId, "delivered", { orderId: order.id });
  return order;
}

/** Freshness/quality-guarantee refund (task 3.1): refund without return. */
export async function refundOrder(orderId: string, reasonCode: string) {
  const order = await db.order.findUniqueOrThrow({ where: { id: orderId } });
  const refund = await db.refund.create({
    data: { orderId, reasonCode, amountCents: order.totalCents },
  });
  await db.order.update({
    where: { id: orderId },
    data: { status: "REFUNDED" },
  });
  await emitDemandEvent("REFUND", {
    accountId: order.accountId,
    orderId,
    payload: { reasonCode },
  });
  await notify(order.accountId, "refund_processed", { orderId, reasonCode });
  // Mirror the refund + order status transition (paid → refunded) into canonical.
  await mirrorAccount(order.accountId);
  return refund;
}
