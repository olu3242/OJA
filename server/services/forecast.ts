import { db } from "@/lib/db";
import { GARRI_SKU_CODES } from "@/lib/pricing";
import { inboundUnits } from "./procurement";
import { stockOnHand } from "./inventory";

const WEEK_MS = 7 * 24 * 3600 * 1000;

export function weekStart(d: Date): Date {
  const out = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
  out.setUTCDate(out.getUTCDate() - out.getUTCDay()); // Sunday
  out.setUTCHours(0, 0, 0, 0);
  return out;
}

/**
 * Events calendar (v1): seasonal demand multipliers for garri around
 * celebrations. Deliberately coarse — refined as actuals accumulate.
 */
export function seasonalIndex(week: Date): number {
  const month = week.getUTCMonth(); // 0-based
  if (month === 11) return 1.3; // December — Christmas
  if (month === 3) return 1.15; // April — Easter window
  if (month === 9) return 1.15; // October — Nigerian Independence Day
  if (month === 5 || month === 6) return 1.1; // wedding season
  return 1.0;
}

/** Weekly committed demand (lbs) per variety from ACTIVE subscriptions. */
export async function committedWeeklyByVariety() {
  const subs = await db.subscription.findMany({ where: { status: "ACTIVE" } });
  const byVariety: Record<string, number> = { WHITE_IJEBU: 0, YELLOW: 0 };
  for (const s of subs) byVariety[s.variety] += (s.qtyLbs / s.cadenceDays) * 7;
  return byVariety;
}

/** Trailing consumption (lbs/week) from shipped orders over the last 28 days. */
export async function trailingWeekly(skuId: string, now = new Date()) {
  const since = new Date(now.getTime() - 4 * WEEK_MS);
  const lines = await db.orderLine.findMany({
    where: {
      skuId,
      order: {
        status: { in: ["SHIPPED", "DELIVERED"] },
        shippedAt: { gte: since },
      },
    },
  });
  return lines.reduce((s, l) => s + l.qtyUnits, 0) / 4;
}

/**
 * Nightly forecast job. v0 = committed-demand floor blended with trailing
 * consumption. v1 (Phase 2, shadow mode) = v0 × seasonal events index.
 * Forecast rows are versioned inserts — never updated (ARCHITECTURE.md §3).
 */
export async function runForecast(opts?: {
  now?: Date;
  horizonWeeks?: number;
}) {
  const now = opts?.now ?? new Date();
  const horizon = opts?.horizonWeeks ?? 4;
  const warehouses = await db.warehouse.findMany();
  const committed = await committedWeeklyByVariety();
  const results: { skuCode: string; warehouseId: string; weeks: number[] }[] =
    [];

  for (const wh of warehouses) {
    for (const [variety, code] of Object.entries(GARRI_SKU_CODES)) {
      const sku = await db.sku.findUnique({ where: { code } });
      if (!sku || !sku.active) continue;
      const trailing = await trailingWeekly(sku.id, now);
      const committedWeekly = committed[variety] ?? 0;
      const latest = await db.forecast.findFirst({
        where: { skuId: sku.id, warehouseId: wh.id },
        orderBy: { version: "desc" },
      });
      const version = (latest?.version ?? 0) + 1;

      const weeks: number[] = [];
      for (let w = 0; w < horizon; w++) {
        const ws = weekStart(new Date(now.getTime() + w * WEEK_MS));
        // v0: committed floor + statistical blend
        const v0 = Math.ceil(
          Math.max(committedWeekly, 0.6 * committedWeekly + 0.4 * trailing),
        );
        // v1 shadow (Phase 2): seasonal events layer on top of v0
        const v1 = Math.ceil(v0 * seasonalIndex(ws));
        await db.forecast.createMany({
          data: [
            {
              skuId: sku.id,
              warehouseId: wh.id,
              weekStart: ws,
              qtyUnits: v0,
              source: "V0",
              version,
            },
            {
              skuId: sku.id,
              warehouseId: wh.id,
              weekStart: ws,
              qtyUnits: v1,
              source: "V1",
              version,
            },
          ],
        });
        weeks.push(v0);
      }
      results.push({ skuCode: code, warehouseId: wh.id, weeks });
    }
  }
  return results;
}

/** Admin override (task 2.7): versioned insert referencing the row it adjusts. */
export async function overrideForecast(
  forecastId: string,
  qtyUnits: number,
  reasonCode: string,
) {
  const base = await db.forecast.findUniqueOrThrow({
    where: { id: forecastId },
  });
  return db.forecast.create({
    data: {
      skuId: base.skuId,
      warehouseId: base.warehouseId,
      weekStart: base.weekStart,
      qtyUnits,
      source: "OVERRIDE",
      version: base.version,
      overrideOfId: base.id,
      reasonCode,
    },
  });
}

/** Effective forecast for a week = latest override else latest V0 row. */
export async function effectiveForecast(
  skuId: string,
  warehouseId: string,
  week: Date,
) {
  const ws = weekStart(week);
  const override = await db.forecast.findFirst({
    where: { skuId, warehouseId, weekStart: ws, source: "OVERRIDE" },
    orderBy: { createdAt: "desc" },
  });
  if (override) return override;
  return db.forecast.findFirst({
    where: { skuId, warehouseId, weekStart: ws, source: "V0" },
    orderBy: { version: "desc" },
  });
}

/** WAPE (task 2.7): forecast-vs-actual over completed weeks, per source. */
export async function wape(source: "V0" | "V1", now = new Date()) {
  const thisWeek = weekStart(now);
  const forecasts = await db.forecast.findMany({
    where: { source, weekStart: { lt: thisWeek } },
    orderBy: { version: "desc" },
  });
  // latest version per sku×warehouse×week
  const latest = new Map<string, (typeof forecasts)[number]>();
  for (const f of forecasts) {
    const key = `${f.skuId}:${f.warehouseId}:${f.weekStart.toISOString()}`;
    if (!latest.has(key)) latest.set(key, f);
  }
  let absErr = 0;
  let actualSum = 0;
  for (const f of latest.values()) {
    const end = new Date(f.weekStart.getTime() + WEEK_MS);
    const lines = await db.orderLine.findMany({
      where: {
        skuId: f.skuId,
        order: {
          status: { in: ["SHIPPED", "DELIVERED"] },
          shippedAt: { gte: f.weekStart, lt: end },
        },
      },
    });
    const actual = lines.reduce((s, l) => s + l.qtyUnits, 0);
    absErr += Math.abs(actual - f.qtyUnits);
    actualSum += actual;
  }
  return actualSum === 0 ? null : absErr / actualSum;
}

/**
 * Reorder suggestions (task 2.6): 4-week effective forecast − on-hand −
 * inbound, with a 1-week safety buffer for the shelf-stable staple.
 */
export async function reorderSuggestions(
  warehouseId: string,
  now = new Date(),
) {
  const skus = await db.sku.findMany({ where: { active: true } });
  const out: { skuId: string; skuCode: string; suggestedUnits: number }[] = [];
  for (const sku of skus) {
    let need = 0;
    let weekly = 0;
    for (let w = 0; w < 4; w++) {
      const f = await effectiveForecast(
        sku.id,
        warehouseId,
        new Date(now.getTime() + w * WEEK_MS),
      );
      need += f?.qtyUnits ?? 0;
      if (w === 0) weekly = f?.qtyUnits ?? 0;
    }
    need += weekly; // 1-week safety stock
    const onHand = await stockOnHand(sku.id, warehouseId);
    const inbound = await inboundUnits(sku.id, warehouseId);
    const suggested = Math.max(0, need - onHand - inbound);
    if (suggested > 0)
      out.push({ skuId: sku.id, skuCode: sku.code, suggestedUnits: suggested });
  }
  return out;
}

/** One-click PO draft from suggestions (task 2.6). */
export async function draftPoFromSuggestions(
  warehouseId: string,
  supplierId: string,
  unitCostCents = 150, // placeholder landed cost per lb until supplier quotes land
) {
  const suggestions = await reorderSuggestions(warehouseId);
  if (suggestions.length === 0) return null;
  return db.purchaseOrder.create({
    data: {
      supplierId,
      warehouseId,
      status: "DRAFT",
      lines: {
        create: suggestions.map((s) => ({
          skuId: s.skuId,
          qtyUnits: s.suggestedUnits,
          unitCostCents,
        })),
      },
    },
    include: { lines: true },
  });
}
