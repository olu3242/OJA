import { db } from "@/lib/db";
import { effectiveForecast } from "./forecast";

const WEEK_MS = 7 * 24 * 3600 * 1000;

/**
 * Supplier portal alpha (task 4.5, Phase 2): forward demand visibility +
 * fast-pay election. Suppliers see the effective 4-week forecast for SKUs
 * they supply (via PO history) and their open POs.
 */
export async function supplierPortalView(supplierId: string, now = new Date()) {
  const supplier = await db.supplier.findUniqueOrThrow({
    where: { id: supplierId },
  });
  const lines = await db.poLine.findMany({
    where: { po: { supplierId } },
    distinct: ["skuId"],
    include: { sku: true },
  });
  const warehouses = await db.warehouse.findMany();

  const forecastShare: { skuCode: string; weeks: number[] }[] = [];
  for (const line of lines) {
    const weeks: number[] = [];
    for (let w = 0; w < 4; w++) {
      let total = 0;
      for (const wh of warehouses) {
        const f = await effectiveForecast(
          line.skuId,
          wh.id,
          new Date(now.getTime() + w * WEEK_MS),
        );
        total += f?.qtyUnits ?? 0;
      }
      weeks.push(total);
    }
    forecastShare.push({ skuCode: line.sku.code, weeks });
  }

  const openPos = await db.purchaseOrder.findMany({
    where: { supplierId, status: { in: ["PLACED", "PARTIALLY_RECEIVED"] } },
    include: { lines: { include: { sku: true } } },
  });

  return { supplier, forecastShare, openPos, fastPay: supplier.fastPay };
}

/** Fast-pay election: net-7 at 1.5% discount instead of net-30. */
export async function electFastPay(supplierId: string, fastPay: boolean) {
  return db.supplier.update({ where: { id: supplierId }, data: { fastPay } });
}
