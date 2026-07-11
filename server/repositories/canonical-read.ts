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
  const cust = await canonicalPool.query(
    `select canonical_id from public.legacy_map
      where legacy_table = 'accounts' and legacy_id = $1`,
    [accountId],
  );
  if (cust.rowCount === 0) return null;
  const customerId = cust.rows[0].canonical_id;
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
