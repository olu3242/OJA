import { db } from "@/lib/db";
import { lotBalance } from "./inventory";

/**
 * Expiry-risk markdown ladder (task 5.2, "Fresh Deals"): as a lot's remaining
 * shelf life shrinks, an automated discount converts spoilage risk into sales.
 *   ≤ 40% shelf life remaining → 15% off
 *   ≤ 20% shelf life remaining → 30% off
 */
export function markdownPct(shelfLifeRemaining: number): number {
  if (shelfLifeRemaining <= 0.2) return 0.3;
  if (shelfLifeRemaining <= 0.4) return 0.15;
  return 0;
}

export function shelfLifeRemaining(
  receivedAt: Date,
  expiresAt: Date,
  now = new Date(),
): number {
  const total = expiresAt.getTime() - receivedAt.getTime();
  if (total <= 0) return 0;
  return Math.max(0, (expiresAt.getTime() - now.getTime()) / total);
}

/** Lots currently eligible for markdown, with suggested discount. */
export async function freshDeals(now = new Date()) {
  const lots = await db.lot.findMany({
    where: { expiresAt: { not: null } },
    include: { sku: true },
  });
  const deals: {
    lotCode: string;
    skuCode: string;
    unitsOnHand: number;
    remaining: number;
    discountPct: number;
  }[] = [];
  for (const lot of lots) {
    const remaining = shelfLifeRemaining(lot.receivedAt, lot.expiresAt!, now);
    const pct = markdownPct(remaining);
    if (pct === 0) continue;
    const units = await lotBalance(lot.id);
    if (units <= 0) continue;
    deals.push({
      lotCode: lot.lotCode,
      skuCode: lot.sku.code,
      unitsOnHand: units,
      remaining,
      discountPct: pct,
    });
  }
  return deals;
}
