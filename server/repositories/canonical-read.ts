import { canonicalPool } from "@/lib/canonical-db";
import { db } from "@/lib/db";
import { canonicalReadEnabled } from "@/lib/flags";

/**
 * Read cutover (convergence phase 5). A single normalized read served from the
 * canonical schema when `canonical_read` is on, else from legacy Prisma — with
 * a safe fallback: if the flag is on but this account isn't mirrored yet, we
 * read legacy rather than showing an empty pantry. `source` is returned so the
 * caller/UI can surface which schema answered.
 */
export type NormalizedSubscription = {
  plan: string;
  variety: string;
  status: string;
  qtyLbs: number;
  priceCents: number;
};

export type SubscriptionsRead = {
  source: "canonical" | "legacy";
  subscriptions: NormalizedSubscription[];
};

export type NormalizedOrderLine = { qtyLbs: number; variety: string };
export type NormalizedOrder = {
  status: string;
  totalCents: number;
  refundedCents: number;
  carrier: string | null;
  trackingCode: string | null;
  lines: NormalizedOrderLine[];
};

export type OrdersRead = {
  source: "canonical" | "legacy";
  orders: NormalizedOrder[];
};

/** GAR-YEL → YELLOW, else White (Ijebu) — one mapping for both read paths. */
const skuToVariety = (code: string) =>
  code === "GAR-YEL" ? "YELLOW" : "WHITE_IJEBU";

/** Resolve the canonical customer id for a legacy account; null if unmirrored. */
async function resolveCustomerId(accountId: string): Promise<string | null> {
  const r = await canonicalPool.query(
    `select canonical_id from public.legacy_map
      where legacy_table = 'accounts' and legacy_id = $1`,
    [accountId],
  );
  return r.rowCount === 0 ? null : (r.rows[0].canonical_id as string);
}

async function legacyRead(
  accountId: string,
): Promise<NormalizedSubscription[]> {
  const subs = await db.subscription.findMany({
    where: { accountId },
    orderBy: { createdAt: "desc" },
  });
  return subs.map((s) => ({
    plan: s.plan,
    variety: s.variety,
    status: s.status,
    qtyLbs: s.qtyLbs,
    priceCents: s.priceCents,
  }));
}

async function canonicalRead(
  accountId: string,
): Promise<NormalizedSubscription[] | null> {
  // Resolve the canonical customer via the legacy bridge; null if not mirrored.
  const customerId = await resolveCustomerId(accountId);
  if (customerId === null) return null;
  const rows = await canonicalPool.query(
    `select s.plan, s.status, i.qty as qty, s.price_cents, v.variant
       from public.subscriptions s
       join public.subscription_items i on i.subscription_id = s.id
       join public.product_variants v on v.id = i.product_variant_id
      where s.customer_id = $1 and s.deleted_at is null
      order by s.created_at desc`,
    [customerId],
  );
  return rows.rows.map((r) => ({
    plan: r.plan,
    variety: r.variant,
    status: r.status.toUpperCase(),
    qtyLbs: Number(r.qty),
    priceCents: r.price_cents,
  }));
}

export async function readSubscriptions(
  accountId: string,
): Promise<SubscriptionsRead> {
  if (await canonicalReadEnabled()) {
    try {
      const canonical = await canonicalRead(accountId);
      if (canonical) return { source: "canonical", subscriptions: canonical };
    } catch {
      // fall through to legacy — a read cutover must never hard-fail the page
    }
  }
  return { source: "legacy", subscriptions: await legacyRead(accountId) };
}

async function legacyReadOrders(accountId: string): Promise<NormalizedOrder[]> {
  const orders = await db.order.findMany({
    where: { accountId },
    include: { lines: { include: { sku: true } }, refunds: true },
    orderBy: { createdAt: "desc" },
  });
  return orders.map((o) => ({
    status: o.status,
    totalCents: o.totalCents,
    refundedCents: o.refunds.reduce((s, r) => s + r.amountCents, 0),
    carrier: o.carrier,
    trackingCode: o.trackingCode,
    lines: o.lines.map((l) => ({
      qtyLbs: l.qtyUnits,
      variety: skuToVariety(l.sku.code),
    })),
  }));
}

async function canonicalReadOrders(
  accountId: string,
): Promise<NormalizedOrder[] | null> {
  const customerId = await resolveCustomerId(accountId);
  if (customerId === null) return null;
  // One row per order line; refunded total is summed per order in SQL.
  const rows = await canonicalPool.query(
    `select o.id, o.status, o.total_cents, o.created_at,
            coalesce((select sum(r.amount_cents) from public.refunds r
                       where r.order_id = o.id), 0) as refunded_cents,
            sh.carrier, sh.tracking_code,
            i.qty, v.variant
       from public.orders o
       join public.order_items i on i.order_id = o.id
       join public.product_variants v on v.id = i.product_variant_id
       left join public.shipments sh
         on sh.order_id = o.id and sh.deleted_at is null
      where o.customer_id = $1 and o.deleted_at is null
      order by o.created_at desc, o.id`,
    [customerId],
  );
  const byOrder = new Map<string, NormalizedOrder>();
  for (const r of rows.rows) {
    let order = byOrder.get(r.id);
    if (!order) {
      order = {
        status: r.status.toUpperCase(),
        totalCents: r.total_cents,
        refundedCents: Number(r.refunded_cents),
        carrier: r.carrier ?? null,
        trackingCode: r.tracking_code ?? null,
        lines: [],
      };
      byOrder.set(r.id, order);
    }
    order.lines.push({ qtyLbs: Number(r.qty), variety: r.variant });
  }
  return [...byOrder.values()];
}

export async function readOrders(accountId: string): Promise<OrdersRead> {
  if (await canonicalReadEnabled()) {
    try {
      const canonical = await canonicalReadOrders(accountId);
      if (canonical) return { source: "canonical", orders: canonical };
    } catch {
      // fall through to legacy — a read cutover must never hard-fail the page
    }
  }
  return { source: "legacy", orders: await legacyReadOrders(accountId) };
}
