import { db } from "@/lib/db";
import { emitDemandEvent } from "@/lib/events";

/**
 * POS sell-through ingestion (task 4.2, Phase 2): Square/Clover-style webhook
 * payloads become SELL_THROUGH demand events per SKU — the store-side demand
 * signal once the wholesale channel opens.
 */
export type SellThroughPayload = {
  source: "square" | "clover" | "manual";
  storeAccountId: string;
  entries: { skuCode: string; unitsSold: number; periodEnd: string }[];
};

export async function ingestSellThrough(payload: SellThroughPayload) {
  const results: { skuCode: string; accepted: boolean }[] = [];
  for (const entry of payload.entries) {
    const sku = await db.sku.findUnique({ where: { code: entry.skuCode } });
    if (!sku || entry.unitsSold < 0) {
      results.push({ skuCode: entry.skuCode, accepted: false });
      continue;
    }
    await emitDemandEvent("SELL_THROUGH", {
      accountId: payload.storeAccountId,
      skuId: sku.id,
      payload: {
        source: payload.source,
        unitsSold: entry.unitsSold,
        periodEnd: entry.periodEnd,
      },
    });
    results.push({ skuCode: entry.skuCode, accepted: true });
  }
  return results;
}

/** Weekly sell-through per SKU (feeds forecast v1 once stores are live). */
export async function sellThroughWeekly(skuId: string, since: Date) {
  const events = await db.demandEvent.findMany({
    where: { type: "SELL_THROUGH", skuId, createdAt: { gte: since } },
  });
  return events.reduce((sum, e) => {
    const p = e.payload as { unitsSold?: number } | null;
    return sum + (p?.unitsSold ?? 0);
  }, 0);
}
