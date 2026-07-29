import { canonicalPool } from "@/lib/canonical-db";

/**
 * Promo-code redemption (Execution 4) over the existing canonical `promo_codes`
 * and `discounts` tables. Validation enforces the margin invariants baked into
 * the schema: codes can be single-use (`max_redemptions`), time-boxed
 * (`expires_at`), and `first_delivery_only` (no permanent discounts). The
 * redemption count is incremented with an atomic check so a code can't be
 * over-redeemed under concurrency.
 */
export class PromoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PromoError";
  }
}

export async function createPromo(input: {
  code: string;
  maxRedemptions?: number | null;
  firstDeliveryOnly?: boolean;
  expiresAt?: Date | null;
}): Promise<{ id: string }> {
  const r = await canonicalPool.query(
    `insert into public.promo_codes (code, max_redemptions, first_delivery_only, expires_at)
     values ($1,$2,$3,$4)
     on conflict (code) do update set max_redemptions = excluded.max_redemptions
     returning id`,
    [
      input.code,
      input.maxRedemptions ?? null,
      input.firstDeliveryOnly ?? true,
      input.expiresAt ?? null,
    ],
  );
  return { id: r.rows[0].id };
}

export type RedeemResult = {
  promoId: string;
  discountId: string;
  discountCents: number;
};

/**
 * Redeem a promo against an order. Validates active/expiry/limit/first-delivery,
 * atomically claims a redemption slot, and records a `discounts` row for the
 * computed amount. `orgId` is required so the discount is tenant-scoped.
 */
export async function redeemPromo(input: {
  code: string;
  orgId: string;
  orderId: string;
  orderAmountCents: number;
  discountPct?: number;
  isFirstDelivery?: boolean;
}): Promise<RedeemResult> {
  const promo = await canonicalPool.query(
    `select id, max_redemptions, redemptions, first_delivery_only, expires_at
       from public.promo_codes where code = $1`,
    [input.code],
  );
  if (promo.rowCount === 0) throw new PromoError(`unknown promo code`);
  const p = promo.rows[0];

  if (p.expires_at && new Date(p.expires_at) < new Date()) {
    throw new PromoError("promo code expired");
  }
  if (p.first_delivery_only && input.isFirstDelivery === false) {
    throw new PromoError("promo code is first-delivery only");
  }

  const discountCents = Math.round(
    input.orderAmountCents * (input.discountPct ?? 0.1),
  );
  if (discountCents <= 0) throw new PromoError("computed discount is zero");

  // Atomic claim: increments only while under the (optional) cap.
  const claim = await canonicalPool.query(
    `update public.promo_codes
        set redemptions = redemptions + 1
      where id = $1 and (max_redemptions is null or redemptions < max_redemptions)
      returning redemptions`,
    [p.id],
  );
  if (claim.rowCount === 0) throw new PromoError("promo code fully redeemed");

  const kind = p.first_delivery_only ? "first_delivery" : "referral";
  const disc = await canonicalPool.query(
    `insert into public.discounts (organization_id, promo_code_id, order_id, amount_cents, kind)
     values ($1,$2,$3,$4,$5) returning id`,
    [input.orgId, p.id, input.orderId, discountCents, kind],
  );

  return { promoId: p.id, discountId: disc.rows[0].id, discountCents };
}
