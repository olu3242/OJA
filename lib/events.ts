import { db } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";

export type DemandEventType =
  | "SUBSCRIBE"
  | "SELL_THROUGH"
  | "CONFIRM"
  | "EDIT"
  | "SKIP"
  | "PAUSE"
  | "RESUME"
  | "CANCEL"
  | "SWAP"
  | "SHORTAGE_SWAP"
  | "OOS_VIEW"
  | "REFUND"
  | "DELIVERY";

// Append-only intent stream — every demand-relevant interaction emits one.
export async function emitDemandEvent(
  type: DemandEventType,
  refs: {
    accountId?: string;
    subscriptionId?: string;
    cycleId?: string;
    orderId?: string;
    skuId?: string;
    payload?: Prisma.InputJsonValue;
  },
  tx: Pick<typeof db, "demandEvent"> = db,
) {
  return tx.demandEvent.create({ data: { type, ...refs } });
}
