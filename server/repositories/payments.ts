import { canonicalPool } from "@/lib/canonical-db";

/**
 * Payment ledger repository (WS10). Reads/writes the EXISTING canonical payment
 * tables (`payments`, `payment_events`, `wallets`, `credits`) via the service
 * pool — no schema is replaced. Every state change appends an append-only
 * `payment_events` row (Phase 11 observability); refunds are tracked as
 * `payment.refund` events so the double-refund guard sums against the original
 * amount. Payment-level refunds are intentionally kept in the payment-event
 * ledger and do NOT touch the order-scoped `public.refunds` table (owned by the
 * order-refund convergence path).
 */
export type PaymentKind = "subscription" | "group" | "wholesale" | "one_time";
export type PaymentStatus = "pending" | "captured" | "refunded" | "failed";

export type LedgerPayment = {
  id: string;
  status: PaymentStatus;
  amountCents: number;
  currency: string;
  provider: string;
};

/** Resolve the canonical customer + org for a legacy account via legacy_map. */
export async function resolveCustomer(
  accountId: string,
): Promise<{ customerId: string; orgId: string } | null> {
  const r = await canonicalPool.query(
    `select c.canonical_id as customer_id, o.canonical_id as org_id
       from public.legacy_map c
       join public.legacy_map o
         on o.legacy_id = c.legacy_id and o.legacy_table = 'accounts_org'
      where c.legacy_table = 'accounts' and c.legacy_id = $1`,
    [accountId],
  );
  if (r.rowCount === 0) return null;
  return { customerId: r.rows[0].customer_id, orgId: r.rows[0].org_id };
}

export async function recordPayment(input: {
  orgId: string;
  customerId: string;
  amountCents: number;
  currency: string;
  provider: string;
  providerRef: string;
  orderId?: string | null;
  status?: PaymentStatus;
}): Promise<LedgerPayment> {
  const status = input.status ?? "captured";
  const row = await canonicalPool.query(
    `insert into public.payments
       (organization_id, customer_id, order_id, amount_cents, currency, status, provider, provider_ref)
     values ($1,$2,$3,$4,$5,$6,$7,$8)
     returning id, status, amount_cents, currency, provider`,
    [
      input.orgId,
      input.customerId,
      input.orderId ?? null,
      input.amountCents,
      input.currency,
      status,
      input.provider,
      input.providerRef,
    ],
  );
  const p = row.rows[0];
  return {
    id: p.id,
    status: p.status,
    amountCents: p.amount_cents,
    currency: p.currency,
    provider: p.provider,
  };
}

export async function appendPaymentEvent(input: {
  orgId: string;
  paymentId: string;
  provider: string;
  eventType: string;
  providerEventId: string;
  payload?: Record<string, unknown>;
}): Promise<{ inserted: boolean }> {
  // provider_event_id is UNIQUE — a duplicate provider event is dropped (DB-level
  // idempotency layered under withIdempotency).
  const r = await canonicalPool.query(
    `insert into public.payment_events
       (organization_id, payment_id, provider, event_type, provider_event_id, payload)
     values ($1,$2,$3,$4,$5,$6)
     on conflict (provider_event_id) do nothing
     returning id`,
    [
      input.orgId,
      input.paymentId,
      input.provider,
      input.eventType,
      input.providerEventId,
      JSON.stringify(input.payload ?? {}),
    ],
  );
  return { inserted: (r.rowCount ?? 0) > 0 };
}

export async function getPayment(
  paymentId: string,
): Promise<LedgerPayment | null> {
  const r = await canonicalPool.query(
    `select id, status, amount_cents, currency, provider
       from public.payments where id = $1 and deleted_at is null`,
    [paymentId],
  );
  if (r.rowCount === 0) return null;
  const p = r.rows[0];
  return {
    id: p.id,
    status: p.status,
    amountCents: p.amount_cents,
    currency: p.currency,
    provider: p.provider,
  };
}

/** Sum of all refund events already booked against a payment. */
export async function refundedTotal(paymentId: string): Promise<number> {
  const r = await canonicalPool.query(
    `select coalesce(sum((payload->>'amount_cents')::int), 0) as total
       from public.payment_events
      where payment_id = $1 and event_type = 'payment.refunded'`,
    [paymentId],
  );
  return Number(r.rows[0].total);
}

export type RefundResult = {
  refundedCents: number;
  fullyRefunded: boolean;
};

/** Book a refund event with a double-refund guard; flips status when fully refunded. */
export async function recordRefund(input: {
  orgId: string;
  paymentId: string;
  amountCents: number;
  reason: string;
  providerRef: string;
}): Promise<RefundResult> {
  const payment = await getPayment(input.paymentId);
  if (!payment) throw new Error(`payment ${input.paymentId} not found`);
  if (payment.status === "failed" || payment.status === "pending") {
    throw new Error(`cannot refund a ${payment.status} payment`);
  }
  if (input.amountCents <= 0) throw new Error("refund amount must be positive");

  const already = await refundedTotal(input.paymentId);
  if (already + input.amountCents > payment.amountCents) {
    throw new Error(
      `refund exceeds captured amount (captured ${payment.amountCents}, already refunded ${already}, requested ${input.amountCents})`,
    );
  }

  await appendPaymentEvent({
    orgId: input.orgId,
    paymentId: input.paymentId,
    provider: payment.provider,
    eventType: "payment.refunded",
    providerEventId: input.providerRef,
    payload: { amount_cents: input.amountCents, reason: input.reason },
  });

  const refundedCents = already + input.amountCents;
  const fullyRefunded = refundedCents >= payment.amountCents;
  if (fullyRefunded) {
    await canonicalPool.query(
      `update public.payments set status = 'refunded' where id = $1`,
      [input.paymentId],
    );
  }
  return { refundedCents, fullyRefunded };
}

/** Issue store credit into the customer's wallet (referral/SLA/refund/promo). */
export async function issueCredit(input: {
  orgId: string;
  customerId: string;
  amountCents: number;
  currency: string;
  reason: string;
  referenceId?: string | null;
}): Promise<{ walletBalanceCents: number }> {
  const wallet = await canonicalPool.query(
    `insert into public.wallets (organization_id, customer_id, currency, balance_cents)
     values ($1,$2,$3,0)
     on conflict (customer_id, currency) do update set currency = excluded.currency
     returning id, balance_cents`,
    [input.orgId, input.customerId, input.currency],
  );
  const walletId = wallet.rows[0].id as string;
  await canonicalPool.query(
    `insert into public.credits (organization_id, wallet_id, amount_cents, reason, reference_id)
     values ($1,$2,$3,$4,$5)`,
    [
      input.orgId,
      walletId,
      input.amountCents,
      input.reason,
      input.referenceId ?? null,
    ],
  );
  const updated = await canonicalPool.query(
    `update public.wallets set balance_cents = balance_cents + $2, version = version + 1
      where id = $1 returning balance_cents`,
    [walletId, input.amountCents],
  );
  return { walletBalanceCents: updated.rows[0].balance_cents };
}

export type PaymentMetrics = {
  capturedCents: number;
  refundedCents: number;
  netCents: number;
  paymentCount: number;
  refundCount: number;
  refundRatePct: number;
  mrrCents: number;
};

/** Live payment KPIs computed from the ledger + active subscriptions. */
export async function paymentMetrics(): Promise<PaymentMetrics> {
  const captured = await canonicalPool.query(
    `select coalesce(sum(amount_cents),0) cents, count(*)::int n
       from public.payments
      where deleted_at is null and status in ('captured','refunded')`,
  );
  const refunds = await canonicalPool.query(
    `select coalesce(sum((payload->>'amount_cents')::int),0) cents, count(*)::int n
       from public.payment_events where event_type = 'payment.refunded'`,
  );
  // MRR: active subscriptions normalized to a 30-day month.
  const mrr = await canonicalPool.query(
    `select coalesce(sum(price_cents::numeric * 30.0 / nullif(cadence_days,0)),0) cents
       from public.subscriptions
      where deleted_at is null and status = 'active'`,
  );
  const capturedCents = Number(captured.rows[0].cents);
  const paymentCount = Number(captured.rows[0].n);
  const refundedCents = Number(refunds.rows[0].cents);
  const refundCount = Number(refunds.rows[0].n);
  return {
    capturedCents,
    refundedCents,
    netCents: capturedCents - refundedCents,
    paymentCount,
    refundCount,
    refundRatePct:
      paymentCount === 0
        ? 0
        : Math.round((refundCount / paymentCount) * 1000) / 10,
    mrrCents: Math.round(Number(mrr.rows[0].cents)),
  };
}
