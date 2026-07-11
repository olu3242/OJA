import { db } from "@/lib/db";
import { emitDemandEvent } from "@/lib/events";
import { FIRST_DELIVERY_DISCOUNT } from "@/lib/pricing";
import { skuForVariety, type Grind, type Variety } from "./subscriptions";
import { payments } from "./payments";
import { notify } from "./notifications";
import { mirrorAccount } from "@/server/repositories/canonical-write";

/**
 * Confirm a cycle into a paid order (the 5-tap review). Optional edits apply
 * to this delivery only; persistent changes go through subscriptions.swap.
 */
export async function confirmCycle(
  cycleId: string,
  edits?: { variety?: Variety; grind?: Grind },
  address?: { line1: string; city: string; state: string; zip: string },
) {
  const cycle = await db.cycle.findUniqueOrThrow({
    where: { id: cycleId },
    include: { subscription: { include: { account: true } } },
  });
  if (cycle.status !== "UPCOMING")
    throw new Error(`Cycle ${cycleId} is ${cycle.status}`);
  const sub = cycle.subscription;
  if (sub.status !== "ACTIVE") throw new Error(`Subscription is ${sub.status}`);

  const variety = edits?.variety ?? (sub.variety as Variety);
  const sku = await skuForVariety(variety);

  const isFirst =
    (await db.cycle.count({
      where: {
        subscriptionId: sub.id,
        status: { in: ["ORDERED", "FULFILLED"] },
      },
    })) === 0;
  const totalCents = isFirst
    ? Math.round(sub.priceCents * (1 - FIRST_DELIVERY_DISCOUNT))
    : sub.priceCents;

  await payments.charge({
    accountId: sub.accountId,
    amountCents: totalCents,
    description: `GAARII cycle ${cycleId}`,
  });

  const addr = address ?? {
    line1: "on file",
    city: "on file",
    state: sub.account.deliveryZone ?? "TX",
    zip: "00000",
  };

  const order = await db.order.create({
    data: {
      accountId: sub.accountId,
      subscriptionId: sub.id,
      cycleId: cycle.id,
      status: "PAID",
      totalCents,
      addressLine1: addr.line1,
      city: addr.city,
      state: addr.state,
      zip: addr.zip,
      lines: {
        create: {
          skuId: sku.id,
          qtyUnits: sub.qtyLbs, // base unit = 1 lb
          unitPriceCents: Math.round(totalCents / sub.qtyLbs),
        },
      },
    },
    include: { lines: true },
  });

  await db.cycle.update({
    where: { id: cycle.id },
    data: { status: "ORDERED", confirmedAt: new Date() },
  });

  await emitDemandEvent("CONFIRM", {
    accountId: sub.accountId,
    subscriptionId: sub.id,
    cycleId: cycle.id,
    orderId: order.id,
    skuId: sku.id,
    payload: {
      qtyLbs: sub.qtyLbs,
      edited: Boolean(edits?.variety || edits?.grind),
    },
  });
  if (edits?.variety || edits?.grind) {
    await emitDemandEvent("EDIT", {
      accountId: sub.accountId,
      cycleId: cycle.id,
      payload: { ...edits },
    });
  }
  await notify(sub.accountId, "order_confirmed", {
    orderId: order.id,
    totalCents,
  });
  await mirrorAccount(sub.accountId);

  return order;
}

export async function skipCycle(cycleId: string) {
  const cycle = await db.cycle.findUniqueOrThrow({
    where: { id: cycleId },
    include: { subscription: true },
  });
  if (cycle.status !== "UPCOMING")
    throw new Error(`Cycle ${cycleId} is ${cycle.status}`);
  const updated = await db.cycle.update({
    where: { id: cycleId },
    data: { status: "SKIPPED" },
  });
  await emitDemandEvent("SKIP", {
    accountId: cycle.subscription.accountId,
    subscriptionId: cycle.subscriptionId,
    cycleId,
  });
  await mirrorAccount(cycle.subscription.accountId);
  return updated;
}

/**
 * Cycle-generation cron (task 2.8): for every ACTIVE subscription whose last
 * cycle is resolved (ordered/skipped/fulfilled), create the next one at
 * last.scheduledFor + cadence, and nudge subscribers to confirm.
 */
export async function generateUpcomingCycles(now = new Date()) {
  const subs = await db.subscription.findMany({
    where: { status: "ACTIVE" },
    include: { cycles: { orderBy: { scheduledFor: "desc" }, take: 1 } },
  });
  let created = 0;
  for (const sub of subs) {
    const last = sub.cycles[0];
    if (last && last.status === "UPCOMING") continue; // one open cycle at a time
    const base = last ? last.scheduledFor : now;
    const next = new Date(base.getTime() + sub.cadenceDays * 24 * 3600 * 1000);
    await db.cycle.create({
      data: { subscriptionId: sub.id, scheduledFor: next },
    });
    await notify(sub.accountId, "cycle_confirm_nudge", {
      subscriptionId: sub.id,
      scheduledFor: next.toISOString(),
    });
    created++;
  }
  return { created };
}
