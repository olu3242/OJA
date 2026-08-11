import { canonicalPool } from "@/lib/canonical-db";

/**
 * Dunning / failed-payment retry (Execution 5 payment / Execution 9 reliability).
 * Records each charge attempt in the EXISTING canonical `payment_attempts` table
 * and derives a retry cadence from the count of CONSECUTIVE failures since the
 * customer's last success. The schedule itself is a pure function so the retry
 * policy is unit-testable without a database.
 */
export type AttemptStatus = "succeeded" | "failed";

export async function recordPaymentAttempt(input: {
  orgId: string;
  customerId: string;
  amountCents: number;
  status: AttemptStatus;
  currency?: string;
  paymentMethodId?: string | null;
  failureReason?: string | null;
  providerRef?: string | null;
}): Promise<{ id: string }> {
  const r = await canonicalPool.query(
    `insert into public.payment_attempts
       (organization_id, customer_id, payment_method_id, amount_cents, currency,
        status, failure_reason, provider_ref)
     values ($1,$2,$3,$4,$5,$6,$7,$8)
     returning id`,
    [
      input.orgId,
      input.customerId,
      input.paymentMethodId ?? null,
      input.amountCents,
      input.currency ?? "USD",
      input.status,
      input.failureReason ?? null,
      input.providerRef ?? null,
    ],
  );
  return { id: r.rows[0].id };
}

/**
 * Count of consecutive failed attempts since the customer's most recent success.
 * A success anywhere in the timeline resets the streak to zero.
 */
export async function failedAttemptCount(customerId: string): Promise<number> {
  const r = await canonicalPool.query(
    `with last_success as (
        select max(created_at) as at
          from public.payment_attempts
         where customer_id = $1 and status = 'succeeded' and deleted_at is null
     )
     select count(*)::int as n
       from public.payment_attempts a, last_success s
      where a.customer_id = $1
        and a.status = 'failed'
        and a.deleted_at is null
        and (s.at is null or a.created_at > s.at)`,
    [customerId],
  );
  return Number(r.rows[0].n);
}

/** Business days to wait before each retry; the length caps the retry count. */
export const BACKOFF_DAYS = [1, 3, 5] as const;

export type DunningDecision = {
  attempt: number;
  retryInDays: number | null;
  giveUp: boolean;
};

/**
 * Pure retry policy. Given the number of failures so far, decide when (or
 * whether) to retry. After BACKOFF_DAYS is exhausted the account is given up on
 * (subscription should be marked past-due / dunning-exhausted by the caller).
 */
export function dunningSchedule(failures: number): DunningDecision {
  const attempt = Math.max(0, Math.floor(failures));
  if (attempt >= BACKOFF_DAYS.length) {
    return { attempt, retryInDays: null, giveUp: true };
  }
  return { attempt, retryInDays: BACKOFF_DAYS[attempt], giveUp: false };
}
