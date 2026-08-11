import { db } from "@/lib/db";
import { settlePayment, type SettleResult } from "./payment-engine";

/**
 * Recurring billing (Execution 5 payment). Settles a subscription renewal cycle
 * through the canonical payment engine. The idempotency key is derived from the
 * cycle id, so a retried or replayed renewal job never double-charges a
 * subscriber — a second call for the same cycle replays the original payment.
 */
export async function settleRenewal(cycleId: string): Promise<SettleResult> {
  const cycle = await db.cycle.findUniqueOrThrow({
    where: { id: cycleId },
    include: { subscription: true },
  });
  return settlePayment({
    accountId: cycle.subscription.accountId,
    kind: "subscription",
    amountCents: cycle.subscription.priceCents,
    description: `Subscription renewal (cycle ${cycleId.slice(-6)})`,
    idempotencyKey: `renewal-${cycleId}`,
  });
}
