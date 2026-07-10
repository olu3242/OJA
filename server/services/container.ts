import { db } from "@/lib/db";
import { effectiveForecast } from "./forecast";
import { stockOnHand } from "./inventory";
import { inboundUnits } from "./procurement";

// Container-consolidation planner (task 5.1): recommends import container
// bookings from aggregate forecast. Pure planning math + a thin DB wrapper.
export const CONTAINER_CAPACITY_LBS = 24_000; // ~20ft dry container, bagged garri
export const DEFAULT_LEAD_TIME_WEEKS = 8; // processor → port → customs → 3PL

export function planContainers(input: {
  weeklyDemandLbs: { skuCode: string; lbs: number }[];
  horizonWeeks: number;
  onHandLbs: number;
  inboundLbs: number;
  capacityLbs?: number;
  leadTimeWeeks?: number;
}) {
  const capacity = input.capacityLbs ?? CONTAINER_CAPACITY_LBS;
  const totalWeekly = input.weeklyDemandLbs.reduce((s, d) => s + d.lbs, 0);
  const horizonNeed = totalWeekly * input.horizonWeeks;
  const shortfall = Math.max(
    0,
    horizonNeed - input.onHandLbs - input.inboundLbs,
  );
  const containers = Math.ceil(shortfall / capacity);
  // Mix allocation proportional to demand share
  const mix = input.weeklyDemandLbs.map((d) => ({
    skuCode: d.skuCode,
    lbs:
      totalWeekly === 0
        ? 0
        : Math.round((d.lbs / totalWeekly) * containers * capacity),
  }));
  // Order-by date: cover runs out at (onHand+inbound)/weekly weeks; book leadTime ahead
  const coverWeeks =
    totalWeekly === 0
      ? Infinity
      : (input.onHandLbs + input.inboundLbs) / totalWeekly;
  const orderByWeeks = Math.max(
    0,
    coverWeeks - (input.leadTimeWeeks ?? DEFAULT_LEAD_TIME_WEEKS),
  );
  return { shortfallLbs: shortfall, containers, mix, orderByWeeks };
}

export async function containerPlan(
  warehouseId: string,
  horizonWeeks = 12,
  now = new Date(),
) {
  const skus = await db.sku.findMany({ where: { active: true } });
  const weekly: { skuCode: string; lbs: number }[] = [];
  for (const sku of skus) {
    const f = await effectiveForecast(sku.id, warehouseId, now);
    weekly.push({ skuCode: sku.code, lbs: f?.qtyUnits ?? 0 });
  }
  let onHand = 0;
  let inbound = 0;
  for (const sku of skus) {
    onHand += await stockOnHand(sku.id, warehouseId);
    inbound += await inboundUnits(sku.id, warehouseId);
  }
  return planContainers({
    weeklyDemandLbs: weekly,
    horizonWeeks,
    onHandLbs: onHand,
    inboundLbs: inbound,
  });
}
