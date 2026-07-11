import { db } from "@/lib/db";
import { emitDemandEvent } from "@/lib/events";
import { skuForVariety, type Variety } from "./subscriptions";
import { notify } from "./notifications";
import { mirrorAccount } from "@/server/repositories/canonical-write";

/**
 * Wholesale channel (tasks 2.4 + 4.6, Phase 2): waitlist leads graduate into
 * verified STORE accounts with weekly standing orders. Wholesale pricing is
 * landed cost × 1.18–1.25 (PRICING_STRATEGY §4); SLA credits and quarterly
 * rebates per Wholesale+ terms.
 */
export const WHOLESALE_MARKUP = 1.22; // mid-band over landed cost
export const SLA_CREDIT_MULTIPLIER = 2; // 2× shortfall value in credit
export const REBATE_PCT = 0.015;
export const REBATE_THRESHOLD_CENTS = 1_200_000; // $12k/quarter

export function wholesaleUnitPriceCents(landedCostCents: number): number {
  return Math.round(landedCostCents * WHOLESALE_MARKUP);
}

/** Stockout-protection SLA: shorting a contracted SKU costs 2× in credit. */
export function slaCreditCents(shortfallValueCents: number): number {
  return shortfallValueCents * SLA_CREDIT_MULTIPLIER;
}

/** Quarterly volume rebate: 1.5% of spend above $12k, paid as credit. */
export function quarterlyRebateCents(quarterSpendCents: number): number {
  if (quarterSpendCents <= REBATE_THRESHOLD_CENTS) return 0;
  return Math.round(quarterSpendCents * REBATE_PCT);
}

/** Graduate a waitlist lead into a verified STORE account. */
export async function approveWholesaleLead(leadId: string) {
  const lead = await db.wholesaleLead.findUniqueOrThrow({
    where: { id: leadId },
  });
  const account = await db.account.upsert({
    where: { email: lead.email },
    create: {
      email: lead.email,
      name: lead.businessName,
      businessName: lead.businessName,
      role: lead.businessType === "restaurant" ? "RESTAURANT" : "STORE",
      b2bVerified: true,
      b2bVerifiedAt: new Date(),
      netTermsStatus: "REQUESTED",
    },
    update: { b2bVerified: true, b2bVerifiedAt: new Date() },
  });
  await notify(account.id, "subscription_confirmed", { wholesale: true });
  return account;
}

/**
 * Standing weekly order (task 2.4): reuses the subscription machinery with a
 * 7-day cadence and wholesale pricing derived from average landed cost.
 * Wholesale pricing never renders for unverified accounts (CLAUDE.md invariant).
 */
export async function createStandingOrder(input: {
  accountId: string;
  variety: Variety;
  qtyLbs: number;
}) {
  const account = await db.account.findUniqueOrThrow({
    where: { id: input.accountId },
  });
  if (!account.b2bVerified)
    throw new Error("Wholesale requires a verified B2B account");
  if (
    (account.role !== "STORE" && account.role !== "RESTAURANT") ||
    input.qtyLbs < 50
  ) {
    throw new Error("Standing orders are B2B, minimum 50 lb/week");
  }
  await skuForVariety(input.variety);
  const avg = await db.poLine.aggregate({ _avg: { unitCostCents: true } });
  const unit = wholesaleUnitPriceCents(avg._avg.unitCostCents ?? 150);

  const sub = await db.subscription.create({
    data: {
      accountId: input.accountId,
      plan: "STOCK_UP", // wholesale rides the largest plan bucket; qty is custom
      variety: input.variety,
      cadenceDays: 7,
      qtyLbs: input.qtyLbs,
      priceCents: unit * input.qtyLbs,
      cycles: { create: { scheduledFor: new Date() } },
    },
    include: { cycles: true },
  });
  await emitDemandEvent("SUBSCRIBE", {
    accountId: input.accountId,
    subscriptionId: sub.id,
    payload: { wholesale: true, qtyLbs: input.qtyLbs, unitPriceCents: unit },
  });
  // Mirror the standing order (canonical plan WHOLESALE_STANDING) into canonical.
  await mirrorAccount(input.accountId);
  return sub;
}
