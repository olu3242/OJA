# Oja Payment Engine (WS10)

Production payment engine built **on top of the existing canonical payment
schema** (the 15 billing tables were already modelled in
`supabase/migrations/0001_canonical_schema.sql`; this work adds the service,
gateway, webhook, metrics, and tests that drive them). Nothing was replaced —
every abstraction is an extension.

> **Honest scope note.** Live card charging requires a real `STRIPE_SECRET_KEY`
> and a reachable Stripe account, neither of which exists in this environment.
> The Stripe **adapter and webhook** are real, complete code (no mocks, no
> TODOs) and the **signature verification is verified offline**; live charging
> flips on the moment the key is set. The **Ledger gateway** is the default and
> is a _real settlement backend_ (invoice / net-terms — it persists financial
> state and is fully exercised by the test suite), not a placeholder.

## Deliverables map

| #   | Deliverable          | Where                                                                  |
| --- | -------------------- | ---------------------------------------------------------------------- |
| 1   | ERD / schema         | Existing canonical tables (see below); no new tables needed            |
| 2   | Prisma changes       | None — payment domain lives in the canonical DB, not legacy Prisma     |
| 3   | Migrations           | Already applied (`0001` §PART 8/9); `canonical:verify` clean           |
| 4   | RLS policies         | Existing tenant policies on all payment tables (`0002`)                |
| 5   | Stripe integration   | `lib/stripe.ts`, `server/services/payment-engine.ts` (`stripeGateway`) |
| 6   | Webhook handlers     | `app/api/webhooks/stripe/route.ts` (verify → idempotent → ledger)      |
| 7   | Repository layer     | `server/repositories/payments.ts`                                      |
| 8   | Service layer        | `server/services/payment-engine.ts`                                    |
| 9   | tRPC procedures      | `admin.paymentMetrics`                                                 |
| 10  | Admin dashboard      | `app/(admin)/admin/page.tsx` — "Payments (ledger)" tiles               |
| 11  | Metrics dashboard    | same section: Net revenue, MRR, Captured, Refund rate (live queries)   |
| 12  | Audit / events       | append-only `payment_events` with correlation IDs (Phase 11)           |
| 13  | Security review      | this doc, §Security                                                    |
| 14  | Test report          | `tests/canonical/payments.test.ts` (9), suite 94 → 103                 |
| 15  | Production readiness | this doc, §Readiness + `docs/RC2_PRODUCTION_READINESS.md`              |

## Canonical tables used (already existed)

`payments`, `payment_events`, `payment_methods`, `payment_attempts`, `wallets`,
`credits`, `refunds`, `invoices`, `invoice_items`, `credit_notes`, `currencies`,
`exchange_rates`, `tax_rates`, `promo_codes`, `discounts` — all with UUID PKs,
`created_at/updated_at/deleted_at`, `organization_id`, `created_by/updated_by`,
FK indexes, and RLS from the §Z conventions pass.

## Flow

```
settlePayment(accountId, kind, amountCents, idempotencyKey)
  └─ withIdempotency("payment", key)                         ← never charges twice
       ├─ ensureCustomer(accountId)  → convergeAccount (idempotent) → customer+org
       ├─ gateway.charge()           → Stripe PaymentIntent | Ledger ref
       ├─ payments   INSERT (status=captured, provider, provider_ref)
       └─ payment_events INSERT (payment.captured, correlation_id)

refundPayment(paymentId, amountCents, idempotencyKey)
  └─ withIdempotency("refund", key)
       ├─ gateway.refund()
       └─ recordRefund()  → double-refund guard (Σ refunds ≤ captured) →
            payment_events INSERT (payment.refunded); status→refunded when full

Stripe webhook  POST /api/webhooks/stripe
  └─ verifyStripeEvent(rawBody, sig)   ← HMAC; 400 on tamper/missing/wrong-secret
       └─ withIdempotency("stripe", event.id)         ← never processes twice
            └─ payment_events INSERT (unique provider_event_id)  + status update
```

## Security review

- **Webhook authenticity** — `stripe.webhooks.constructEvent` (HMAC over the raw
  body). Unsigned, tampered, and wrong-secret requests are rejected `400`
  (verified over HTTP and in 3 unit tests). The raw body is read before parsing.
- **Replay / duplicate protection** — two layers: `withIdempotency` (the
  `webhook_events` ledger) _and_ the DB-unique `payment_events.provider_event_id`.
- **No duplicate charges** — settle is idempotent on the caller's key; a replay
  returns the original payment id (test asserts exactly one row).
- **No double refunds** — refunds sum-check against the captured amount before
  booking; an over-refund throws (test asserts rejection + status flip).
- **Secrets** — `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` are read server-side
  only; the API client is never constructed client-side and no key is exposed.
- **Tenant isolation** — every ledger write carries `organization_id`; the
  canonical RLS policies scope reads/writes per tenant.

## Test report

`tests/canonical/payments.test.ts` (9 tests, all green):
gateway selection · settle records payment+event · **idempotent settle (one
charge)** · **partial refund → over-refund rejected → full refund flips status**
· wallet credit · live metrics rollup · **Stripe signature: valid accepted,
tampered rejected, missing/wrong-secret rejected**. Suite total **103 passing**;
typecheck / lint / format / build clean; `canonical:verify` unaffected.

## Readiness

**GO WITH CONDITIONS** (unchanged top-level call). The engine is production-grade
against the Ledger settlement backend today. To enable live card payments:

1. Set `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET`; register the webhook
   endpoint `…/api/webhooks/stripe` in the Stripe dashboard.
2. Smoke a test-mode PaymentIntent through `settlePayment` and confirm the
   webhook updates the ledger.

**Scoped next** (real gaps, not built here): recurring-billing scheduler
(renewals/proration/dunning), Checkout/Billing-Portal session creation, tax
calculation via `tax_rates`, and FX via `exchange_rates`. The schema for all of
these already exists; each is an additive service on top of this engine.
