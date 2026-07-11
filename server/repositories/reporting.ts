import { canonicalPool } from "@/lib/canonical-db";
import { db } from "@/lib/db";

/**
 * Convergence phase 2 — dual-read reporting. The canonical schema serves
 * reads side-by-side with legacy; `parityCheck` proves the two agree before
 * any write cutover. Standard staged-migration shadow-read pattern.
 */
export type CommerceKpis = {
  customers: number;
  activeSubscriptions: number;
  orders: number;
  revenueCents: number;
  refundedOrders: number;
  skippedDeliveries: number;
};

export async function canonicalKpis(): Promise<CommerceKpis> {
  const r = await canonicalPool.query(`select * from public.v_commerce_kpis`);
  const row = r.rows[0];
  return {
    customers: Number(row.customers),
    activeSubscriptions: Number(row.active_subscriptions),
    orders: Number(row.orders),
    revenueCents: Number(row.revenue_cents),
    refundedOrders: Number(row.refunded_orders),
    skippedDeliveries: Number(row.skipped_deliveries),
  };
}

export async function legacyKpis(): Promise<CommerceKpis> {
  const [customers, activeSubscriptions, orders, revenue, refunded, skipped] =
    await Promise.all([
      db.account.count({
        where: {
          role: { in: ["HOUSEHOLD", "STORE", "RESTAURANT", "COMMUNITY"] },
        },
      }),
      db.subscription.count({ where: { status: "ACTIVE" } }),
      db.order.count(),
      db.order.aggregate({ _sum: { totalCents: true } }),
      db.order.count({ where: { status: "REFUNDED" } }),
      db.cycle.count({ where: { status: "SKIPPED" } }),
    ]);
  return {
    customers,
    activeSubscriptions,
    orders,
    revenueCents: revenue._sum.totalCents ?? 0,
    refundedOrders: refunded,
    skippedDeliveries: skipped,
  };
}

export type ParityResult = {
  inParity: boolean;
  legacy: CommerceKpis;
  canonical: CommerceKpis;
  drift: { metric: string; legacy: number; canonical: number }[];
};

/** Field-by-field comparison; any drift means "run converge before trusting reads". */
export async function parityCheck(): Promise<ParityResult> {
  const [legacy, canonical] = await Promise.all([
    legacyKpis(),
    canonicalKpis(),
  ]);
  const drift: ParityResult["drift"] = [];
  for (const metric of Object.keys(legacy) as (keyof CommerceKpis)[]) {
    if (legacy[metric] !== canonical[metric]) {
      drift.push({
        metric,
        legacy: legacy[metric],
        canonical: canonical[metric],
      });
    }
  }
  return { inParity: drift.length === 0, legacy, canonical, drift };
}
