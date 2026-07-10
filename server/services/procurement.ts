import { db } from "@/lib/db";

export async function createSupplier(input: {
  name: string;
  country: string;
  contactEmail?: string;
  fastPay?: boolean;
}) {
  return db.supplier.create({ data: input });
}

export async function createPurchaseOrder(input: {
  supplierId: string;
  warehouseId: string;
  expectedAt?: Date;
  lines: { skuId: string; qtyUnits: number; unitCostCents: number }[];
  place?: boolean;
}) {
  return db.purchaseOrder.create({
    data: {
      supplierId: input.supplierId,
      warehouseId: input.warehouseId,
      expectedAt: input.expectedAt,
      status: input.place ? "PLACED" : "DRAFT",
      placedAt: input.place ? new Date() : null,
      lines: { create: input.lines },
    },
    include: { lines: true },
  });
}

export async function placePurchaseOrder(poId: string) {
  return db.purchaseOrder.update({
    where: { id: poId },
    data: { status: "PLACED", placedAt: new Date() },
  });
}

/**
 * Receive against a PO line (task 1.5): QC pass creates a lot + RECEIVE txn;
 * QC fail records the rejection without stocking units.
 */
export async function receivePoLine(input: {
  poLineId: string;
  qtyUnits: number;
  lotCode: string;
  expiresAt?: Date;
  qcPassed: boolean;
  qcNotes?: string;
}) {
  return db.$transaction(async (tx) => {
    const line = await tx.poLine.findUniqueOrThrow({
      where: { id: input.poLineId },
      include: { po: true },
    });

    let lot = null;
    if (input.qcPassed) {
      lot = await tx.lot.create({
        data: {
          skuId: line.skuId,
          warehouseId: line.po.warehouseId,
          poLineId: line.id,
          lotCode: input.lotCode,
          expiresAt: input.expiresAt,
          txns: {
            create: {
              type: "RECEIVE",
              qtyUnits: input.qtyUnits,
              reason: input.qcNotes,
            },
          },
        },
      });
    }

    const received = line.receivedUnits + (input.qcPassed ? input.qtyUnits : 0);
    await tx.poLine.update({
      where: { id: line.id },
      data: { receivedUnits: received },
    });

    const lines = await tx.poLine.findMany({ where: { poId: line.poId } });
    const fullyReceived = lines.every((l) =>
      l.id === line.id ? received >= l.qtyUnits : l.receivedUnits >= l.qtyUnits,
    );
    await tx.purchaseOrder.update({
      where: { id: line.poId },
      data: { status: fullyReceived ? "RECEIVED" : "PARTIALLY_RECEIVED" },
    });

    return { lot, qcPassed: input.qcPassed };
  });
}

/** Inbound units on open POs (used by reorder suggestions). */
export async function inboundUnits(skuId: string, warehouseId: string) {
  const lines = await db.poLine.findMany({
    where: {
      skuId,
      po: { warehouseId, status: { in: ["PLACED", "PARTIALLY_RECEIVED"] } },
    },
  });
  return lines.reduce(
    (sum, l) => sum + Math.max(0, l.qtyUnits - l.receivedUnits),
    0,
  );
}
