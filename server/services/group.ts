import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { emitDemandEvent } from "@/lib/events";
import { PLANS, type PlanTier } from "@/lib/pricing";
import { skuForVariety, type Variety } from "./subscriptions";
import { payments } from "./payments";

/**
 * Group buying (tasks 3.3 / 4.4): a shareable link aggregates multiple payers
 * into one delivery at a single drop point, with the PRICING_STRATEGY tiered
 * discount by aggregated order value.
 */
export function groupDiscountPct(totalCents: number): number {
  if (totalCents >= 150_000) return 0.15; // $1,500+
  if (totalCents >= 75_000) return 0.1; // $750+
  if (totalCents >= 30_000) return 0.05; // $300+
  return 0;
}

export async function createGroupOrder(
  creatorId: string,
  address: { line1: string; city: string; state: string; zip: string },
) {
  return db.groupOrder.create({
    data: {
      creatorId,
      code: `grp-${randomBytes(4).toString("hex")}`,
      addressLine1: address.line1,
      city: address.city,
      state: address.state,
      zip: address.zip,
    },
  });
}

export async function joinGroupOrder(
  code: string,
  accountId: string,
  plan: PlanTier,
  variety: Variety,
) {
  const group = await db.groupOrder.findUniqueOrThrow({ where: { code } });
  if (group.status !== "OPEN")
    throw new Error(`Group ${code} is ${group.status}`);
  const p = PLANS[plan];
  return db.groupOrderMember.create({
    data: {
      groupOrderId: group.id,
      accountId,
      plan,
      variety,
      priceCents: p.defaultPriceCents,
      qtyLbs: p.defaultLbs,
    },
  });
}

/**
 * Close the group: charge each member their tier-discounted share and
 * aggregate everything into ONE order to the drop point.
 */
export async function closeGroupOrder(code: string) {
  const group = await db.groupOrder.findUniqueOrThrow({
    where: { code },
    include: { members: true },
  });
  if (group.status !== "OPEN")
    throw new Error(`Group ${code} is ${group.status}`);
  if (group.members.length === 0) throw new Error("Group has no members");

  const gross = group.members.reduce((s, m) => s + m.priceCents, 0);
  const discount = groupDiscountPct(gross);

  const byVariety = new Map<Variety, { qtyLbs: number; cents: number }>();
  for (const m of group.members) {
    const share = Math.round(m.priceCents * (1 - discount));
    await payments.charge({
      accountId: m.accountId,
      amountCents: share,
      description: `GAARII group ${code}`,
    });
    const v = m.variety as Variety;
    const agg = byVariety.get(v) ?? { qtyLbs: 0, cents: 0 };
    agg.qtyLbs += m.qtyLbs;
    agg.cents += share;
    byVariety.set(v, agg);
  }
  const totalCents = [...byVariety.values()].reduce((s, v) => s + v.cents, 0);

  const lines = [];
  for (const [variety, agg] of byVariety) {
    const sku = await skuForVariety(variety);
    lines.push({
      skuId: sku.id,
      qtyUnits: agg.qtyLbs,
      unitPriceCents: Math.round(agg.cents / agg.qtyLbs),
    });
  }

  const order = await db.order.create({
    data: {
      accountId: group.creatorId,
      status: "PAID",
      totalCents,
      addressLine1: group.addressLine1,
      city: group.city,
      state: group.state,
      zip: group.zip,
      lines: { create: lines },
    },
    include: { lines: true },
  });

  await db.groupOrder.update({
    where: { id: group.id },
    data: { status: "CLOSED", orderId: order.id },
  });
  await emitDemandEvent("SUBSCRIBE", {
    accountId: group.creatorId,
    orderId: order.id,
    payload: { group: code, members: group.members.length, discount },
  });

  return { order, discount, members: group.members.length };
}
