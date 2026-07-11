import { db } from "@/lib/db";
import { emitDemandEvent } from "@/lib/events";
import {
  FIRST_DELIVERY_DISCOUNT,
  GARRI_SKU_CODES,
  PLANS,
  planPrice,
  regionSurchargeCents,
  SUPPORTED_COUNTRIES,
  type Country,
  type PlanTier,
} from "@/lib/pricing";
import { payments } from "./payments";
import { notify } from "./notifications";
import { mirrorAccount } from "@/server/repositories/canonical-write";

export type Variety = "WHITE_IJEBU" | "YELLOW";
export type Grind = "COARSE" | "FINE";

export async function skuForVariety(variety: Variety) {
  const sku = await db.sku.findUniqueOrThrow({
    where: { code: GARRI_SKU_CODES[variety] },
  });
  if (!sku.active) throw new Error(`SKU ${sku.code} is not active`);
  return sku;
}

export async function subscribe(input: {
  accountId: string;
  plan: PlanTier;
  variety: Variety;
  grind?: Grind;
  cadenceDays?: number;
  address: {
    line1: string;
    city: string;
    state: string;
    zip: string;
    country?: Country;
  };
}) {
  const plan = PLANS[input.plan];
  const sku = await skuForVariety(input.variety);
  const country = input.address.country ?? "US";
  if (!SUPPORTED_COUNTRIES.includes(country))
    throw new Error(`Unsupported country ${country}`);
  const base = planPrice(input.plan, country);
  const surcharge = regionSurchargeCents(country, input.address.state);
  const priceCents = base.cents + surcharge;

  await payments.createSubscription({
    accountId: input.accountId,
    priceCents,
    description: `GAARII ${plan.label} — ${input.variety}`,
  });

  const subscription = await db.subscription.create({
    data: {
      accountId: input.accountId,
      plan: input.plan,
      variety: input.variety,
      grind: input.grind ?? "COARSE",
      cadenceDays: input.cadenceDays ?? 30,
      qtyLbs: plan.defaultLbs,
      priceCents,
      currency: base.currency,
      cycles: { create: { scheduledFor: new Date() } },
    },
    include: { cycles: true },
  });

  await db.account.update({
    where: { id: input.accountId },
    data: { deliveryZone: input.address.state.toUpperCase() },
  });

  await emitDemandEvent("SUBSCRIBE", {
    accountId: input.accountId,
    subscriptionId: subscription.id,
    skuId: sku.id,
    payload: { plan: input.plan, qtyLbs: plan.defaultLbs, surcharge },
  });
  await notify(input.accountId, "subscription_confirmed", {
    plan: input.plan,
    priceCents,
  });
  await mirrorAccount(input.accountId);

  return {
    subscription,
    firstCycle: subscription.cycles[0],
    firstDeliveryDiscount: FIRST_DELIVERY_DISCOUNT,
  };
}

export async function pause(subscriptionId: string) {
  const sub = await db.subscription.update({
    where: { id: subscriptionId },
    data: { status: "PAUSED", pausedAt: new Date() },
  });
  await emitDemandEvent("PAUSE", { accountId: sub.accountId, subscriptionId });
  await mirrorAccount(sub.accountId);
  return sub;
}

export async function resume(subscriptionId: string) {
  const sub = await db.subscription.update({
    where: { id: subscriptionId },
    data: { status: "ACTIVE", pausedAt: null },
  });
  await emitDemandEvent("RESUME", { accountId: sub.accountId, subscriptionId });
  await mirrorAccount(sub.accountId);
  return sub;
}

export async function cancel(subscriptionId: string) {
  const sub = await db.subscription.update({
    where: { id: subscriptionId },
    data: { status: "CANCELLED", cancelledAt: new Date() },
  });
  await emitDemandEvent("CANCEL", { accountId: sub.accountId, subscriptionId });
  await mirrorAccount(sub.accountId);
  return sub;
}

/** Swap variety/grind/plan — the pantry-management edit surface. */
export async function swap(
  subscriptionId: string,
  changes: { variety?: Variety; grind?: Grind; plan?: PlanTier },
) {
  const data: Record<string, unknown> = { ...changes };
  if (changes.plan) {
    data.qtyLbs = PLANS[changes.plan].defaultLbs;
    data.priceCents = PLANS[changes.plan].defaultPriceCents;
  }
  const sub = await db.subscription.update({
    where: { id: subscriptionId },
    data,
  });
  await emitDemandEvent("SWAP", {
    accountId: sub.accountId,
    subscriptionId,
    payload: changes as Record<string, string>,
  });
  await mirrorAccount(sub.accountId);
  return sub;
}
