import { db } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";

type Db = typeof db | Prisma.TransactionClient;

/** Stock on hand is always DERIVED from the append-only ledger — never stored. */
export async function stockOnHand(
  skuId: string,
  warehouseId: string,
  tx: Db = db,
) {
  const rows = await tx.inventoryTxn.aggregate({
    _sum: { qtyUnits: true },
    where: { lot: { skuId, warehouseId } },
  });
  return rows._sum.qtyUnits ?? 0;
}

export async function lotBalance(lotId: string, tx: Db = db) {
  const rows = await tx.inventoryTxn.aggregate({
    _sum: { qtyUnits: true },
    where: { lotId },
  });
  return rows._sum.qtyUnits ?? 0;
}

/**
 * FEFO allocation: pick from lots in first-expired-first-out order. Returns
 * the pick plan; throws on shortage (caller may substitute — task 2.3).
 */
export async function allocateFefo(
  skuId: string,
  warehouseId: string,
  qtyUnits: number,
  tx: Db = db,
): Promise<{ lotId: string; lotCode: string; qtyUnits: number }[]> {
  const lots = await tx.lot.findMany({
    where: { skuId, warehouseId },
    orderBy: [{ expiresAt: "asc" }, { receivedAt: "asc" }],
  });
  const plan: { lotId: string; lotCode: string; qtyUnits: number }[] = [];
  let remaining = qtyUnits;
  for (const lot of lots) {
    if (remaining <= 0) break;
    const balance = await lotBalance(lot.id, tx);
    if (balance <= 0) continue;
    const take = Math.min(balance, remaining);
    plan.push({ lotId: lot.id, lotCode: lot.lotCode, qtyUnits: take });
    remaining -= take;
  }
  if (remaining > 0) {
    throw new ShortageError(skuId, warehouseId, qtyUnits, qtyUnits - remaining);
  }
  return plan;
}

export class ShortageError extends Error {
  constructor(
    public skuId: string,
    public warehouseId: string,
    public requested: number,
    public available: number,
  ) {
    super(
      `Shortage: sku ${skuId} requested ${requested}, available ${available}`,
    );
  }
}

/**
 * Inter-warehouse transfer (task 4.3, Phase 2): moves units FEFO from one
 * warehouse's lots into a mirrored lot at the destination, as ledger txns.
 */
export async function transferStock(input: {
  skuId: string;
  fromWarehouseId: string;
  toWarehouseId: string;
  qtyUnits: number;
}) {
  return db.$transaction(async (tx) => {
    const transfer = await tx.transferOrder.create({
      data: { ...input, status: "IN_TRANSIT" },
    });
    const plan = await allocateFefo(
      input.skuId,
      input.fromWarehouseId,
      input.qtyUnits,
      tx,
    );
    for (const p of plan) {
      await tx.inventoryTxn.create({
        data: {
          lotId: p.lotId,
          type: "TRANSFER_OUT",
          qtyUnits: -p.qtyUnits,
          reason: transfer.id,
        },
      });
      const source = await tx.lot.findUniqueOrThrow({ where: { id: p.lotId } });
      await tx.lot.create({
        data: {
          skuId: source.skuId,
          warehouseId: input.toWarehouseId,
          lotCode: `${source.lotCode}@${input.toWarehouseId.slice(-4)}`,
          expiresAt: source.expiresAt,
          txns: {
            create: {
              type: "TRANSFER_IN",
              qtyUnits: p.qtyUnits,
              reason: transfer.id,
            },
          },
        },
      });
    }
    return tx.transferOrder.update({
      where: { id: transfer.id },
      data: { status: "COMPLETED" },
    });
  });
}

/** Recall query (task 1.9): lot → orders → customers, in one indexed path. */
export async function recallLot(lotCode: string) {
  const lot = await db.lot.findUniqueOrThrow({ where: { lotCode } });
  const txns = await db.inventoryTxn.findMany({
    where: { lotId: lot.id, type: "PICK", orderLineId: { not: null } },
    include: {
      orderLine: {
        include: { order: { include: { account: true } } },
      },
    },
  });
  const orders = new Map<
    string,
    {
      orderId: string;
      accountEmail: string;
      accountName: string;
      qtyUnits: number;
    }
  >();
  for (const t of txns) {
    const order = t.orderLine!.order;
    const existing = orders.get(order.id);
    const qty = Math.abs(t.qtyUnits);
    if (existing) existing.qtyUnits += qty;
    else
      orders.set(order.id, {
        orderId: order.id,
        accountEmail: order.account.email,
        accountName: order.account.name,
        qtyUnits: qty,
      });
  }
  return { lot, affectedOrders: [...orders.values()] };
}
