import { db } from "@/lib/db";
import { wape } from "./forecast";

/** North-star dashboard (task 3.2). */
export async function dashboard(now = new Date()) {
  const [active, paused, cancelled] = await Promise.all([
    db.subscription.count({ where: { status: "ACTIVE" } }),
    db.subscription.count({ where: { status: "PAUSED" } }),
    db.subscription.count({ where: { status: "CANCELLED" } }),
  ]);

  const cycles = await db.cycle.groupBy({ by: ["status"], _count: true });
  const cycleCount = (s: string) =>
    cycles.find((c) => c.status === s)?._count ?? 0;
  const resolved =
    cycleCount("ORDERED") + cycleCount("FULFILLED") + cycleCount("SKIPPED");
  const cycleConfirmRate =
    resolved === 0
      ? null
      : (cycleCount("ORDERED") + cycleCount("FULFILLED")) / resolved;

  // Keyed on shippedAt (not status) so later refunds don't erase ship history
  const shipped = await db.order.findMany({
    where: { shippedAt: { not: null } },
    select: { createdAt: true, shippedAt: true, totalCents: true },
  });
  const onTime =
    shipped.length === 0
      ? null
      : shipped.filter(
          (o) =>
            o.shippedAt &&
            o.shippedAt.getTime() - o.createdAt.getTime() <=
              3 * 24 * 3600 * 1000,
        ).length / shipped.length;

  // GM after shipping: revenue vs. placeholder all-in cost model (landed cost
  // from received PO lines when available; falls back to $1.50/lb + $2 pack +
  // $12 parcel). Replace with real cost feed before pilot (G2 requirement).
  const lines = await db.orderLine.findMany({
    where: { order: { shippedAt: { not: null } } },
    include: { order: true },
  });
  let revenue = 0;
  let cost = 0;
  const avgCost = await db.poLine.aggregate({ _avg: { unitCostCents: true } });
  const unitCost = avgCost._avg.unitCostCents ?? 150;
  const orderIds = new Set<string>();
  for (const l of lines) {
    revenue += l.qtyUnits * l.unitPriceCents;
    cost += l.qtyUnits * unitCost;
    if (!orderIds.has(l.orderId)) {
      cost += 200 + 1200; // packaging + parcel per order
      orderIds.add(l.orderId);
    }
  }
  const grossMargin = revenue === 0 ? null : (revenue - cost) / revenue;

  const refunds = await db.refund.count();
  const [wapeV0, wapeV1] = await Promise.all([
    wape("V0", now),
    wape("V1", now),
  ]);

  return {
    subscribers: { active, paused, cancelled },
    cycleConfirmRate,
    onTimeShipRate: onTime,
    grossMarginAfterShipping: grossMargin,
    refunds,
    wape: { v0: wapeV0, v1: wapeV1 },
  };
}
