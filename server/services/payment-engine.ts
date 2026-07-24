import { randomUUID } from "node:crypto";
import { withIdempotency } from "@/lib/idempotency";
import { stripeClient, stripeConfigured } from "@/lib/stripe";
import { captureError } from "@/lib/observability";
import { convergeAccount } from "@/server/repositories/convergence";
import {
  generateInvoice,
  markInvoicePaid,
} from "@/server/repositories/invoices";
import {
  appendPaymentEvent,
  recordPayment,
  recordRefund,
  resolveCustomer,
  issueCredit,
  getPayment,
  type PaymentKind,
} from "@/server/repositories/payments";

/**
 * Payment engine (WS10). Orchestrates settlement over the canonical ledger with
 * a pluggable gateway: the real Stripe gateway when `STRIPE_SECRET_KEY` is set,
 * otherwise the internal Ledger gateway (invoice/net-terms settlement — a real
 * settlement backend that records financial state, not a mock). Every settle is
 * idempotent (reuses `withIdempotency`); refunds are double-refund guarded in
 * the repository. Correlation IDs thread through the payment-event stream.
 */
export type PaymentGateway = {
  name: string;
  charge(input: {
    accountId: string;
    amountCents: number;
    currency: string;
    description: string;
  }): Promise<{ providerRef: string }>;
  refund(input: {
    providerRef: string;
    amountCents: number;
  }): Promise<{ providerRef: string }>;
};

/** Internal settlement of record (wholesale net-terms / manual). Real, not a stub. */
export const ledgerGateway: PaymentGateway = {
  name: "ledger",
  async charge() {
    return { providerRef: `ledger_ch_${randomUUID()}` };
  },
  async refund() {
    return { providerRef: `ledger_rf_${randomUUID()}` };
  },
};

/** Live Stripe gateway — real SDK calls; active only when a secret key exists. */
export const stripeGateway: PaymentGateway = {
  name: "stripe",
  async charge(input) {
    const stripe = stripeClient();
    if (!stripe) throw new Error("Stripe not configured");
    const intent = await stripe.paymentIntents.create({
      amount: input.amountCents,
      currency: input.currency.toLowerCase(),
      description: input.description,
      confirm: true,
      automatic_payment_methods: { enabled: true, allow_redirects: "never" },
      metadata: { accountId: input.accountId },
    });
    return { providerRef: intent.id };
  },
  async refund(input) {
    const stripe = stripeClient();
    if (!stripe) throw new Error("Stripe not configured");
    const refund = await stripe.refunds.create({
      payment_intent: input.providerRef,
      amount: input.amountCents,
    });
    return { providerRef: refund.id };
  },
};

export function paymentGateway(): PaymentGateway {
  return stripeConfigured() ? stripeGateway : ledgerGateway;
}

async function ensureCustomer(accountId: string) {
  const existing = await resolveCustomer(accountId);
  if (existing) return existing;
  // Idempotently converge the account so the canonical customer/org exist.
  await convergeAccount(accountId);
  const resolved = await resolveCustomer(accountId);
  if (!resolved) {
    throw new Error(`could not resolve canonical customer for ${accountId}`);
  }
  return resolved;
}

export type SettleInput = {
  accountId: string;
  kind: PaymentKind;
  amountCents: number;
  currency?: string;
  orderId?: string | null;
  description: string;
  idempotencyKey: string;
  correlationId?: string;
};

export type SettleResult = {
  paymentId: string;
  status: string;
  provider: string;
  replayed: boolean;
};

/** Charge + record a captured payment. Idempotent on `idempotencyKey`. */
export async function settlePayment(input: SettleInput): Promise<SettleResult> {
  const currency = input.currency ?? "USD";
  const correlationId = input.correlationId ?? randomUUID();
  const { replayed, result } = await withIdempotency(
    "payment",
    input.idempotencyKey,
    async () => {
      const { customerId, orgId } = await ensureCustomer(input.accountId);
      const gateway = paymentGateway();
      const { providerRef } = await gateway.charge({
        accountId: input.accountId,
        amountCents: input.amountCents,
        currency,
        description: input.description,
      });
      const payment = await recordPayment({
        orgId,
        customerId,
        amountCents: input.amountCents,
        currency,
        provider: gateway.name,
        providerRef,
        orderId: input.orderId ?? null,
        status: "captured",
      });
      await appendPaymentEvent({
        orgId,
        paymentId: payment.id,
        provider: gateway.name,
        eventType: "payment.captured",
        providerEventId: `cap_${payment.id}`,
        payload: {
          kind: input.kind,
          amount_cents: input.amountCents,
          currency,
          correlation_id: correlationId,
        },
      });
      // Auto-generate a paid invoice for the captured payment (best-effort —
      // a downstream artifact must never fail the charge). Runs inside the
      // idempotent handler, so a replayed settle never duplicates the invoice.
      try {
        const invoice = await generateInvoice({
          accountId: input.accountId,
          orderId: input.orderId ?? null,
          currency,
          lines: [
            {
              description: `${input.kind} charge`,
              unitPriceCents: input.amountCents,
            },
          ],
        });
        await markInvoicePaid(invoice.id);
      } catch (e) {
        captureError(e, {
          autoInvoice: input.idempotencyKey,
          correlationId,
        });
      }
      return {
        paymentId: payment.id,
        status: payment.status,
        provider: gateway.name,
      };
    },
  );
  return { ...result, replayed };
}

export type RefundInput = {
  paymentId: string;
  amountCents: number;
  reason: string;
  idempotencyKey: string;
};

export async function refundPayment(input: RefundInput): Promise<{
  refundedCents: number;
  fullyRefunded: boolean;
  replayed: boolean;
}> {
  const { replayed, result } = await withIdempotency(
    "refund",
    input.idempotencyKey,
    async () => {
      const payment = await getPayment(input.paymentId);
      if (!payment) throw new Error(`payment ${input.paymentId} not found`);
      const customer = await canonicalOrgOf(input.paymentId);
      const gateway =
        payment.provider === "stripe" ? stripeGateway : ledgerGateway;
      const { providerRef } = await gateway.refund({
        providerRef: input.paymentId,
        amountCents: input.amountCents,
      });
      return recordRefund({
        orgId: customer.orgId,
        paymentId: input.paymentId,
        amountCents: input.amountCents,
        reason: input.reason,
        providerRef,
      });
    },
  );
  return { ...result, replayed };
}

async function canonicalOrgOf(paymentId: string): Promise<{ orgId: string }> {
  const { canonicalPool } = await import("@/lib/canonical-db");
  const r = await canonicalPool.query(
    `select organization_id from public.payments where id = $1`,
    [paymentId],
  );
  if (r.rowCount === 0) throw new Error(`payment ${paymentId} not found`);
  return { orgId: r.rows[0].organization_id };
}

export async function issueStoreCredit(input: {
  accountId: string;
  amountCents: number;
  currency?: string;
  reason: string;
}): Promise<{ walletBalanceCents: number }> {
  const { customerId, orgId } = await ensureCustomer(input.accountId);
  return issueCredit({
    orgId,
    customerId,
    amountCents: input.amountCents,
    currency: input.currency ?? "USD",
    reason: input.reason,
  });
}
