# Gate G3 — Pilot Launch Checklist (task 3.7)

Work top-to-bottom before opening the public waitlist. Owner initials + date per line.

## Swap the stubs (keys required)

- [ ] Stripe live keys in env; replace `StubPaymentProvider` with the Stripe adapter (`server/services/payments.ts` — interface is stable)
- [ ] Parcel-carrier API creds; replace `StubCarrier` (`server/services/fulfillment.ts`)
- [ ] Twilio + Resend keys; replace the log-only notifier (`server/services/notifications.ts`) — templates already wired
- [ ] Replace dev-auth cookie login with email OTP (`lib/auth.ts`, `lib/actions.ts#loginAction`)

## Data & environment

- [ ] Managed Postgres provisioned (Neon/Supabase), PITR enabled; `prisma migrate deploy` run
- [ ] Production seed: 2 garri SKUs only, real 3PL warehouse row, real supplier rows
- [ ] `SESSION_SECRET` set to a real secret; `.env.example` matches prod var list
- [ ] Sentry DSN wired (3.4 remainder) + uptime check on `/` and `/api/trpc/catalog.plans`

## Ops readiness

- [ ] Recall drill run on a dummy lot — stopwatch < 5 min (see runbooks README)
- [ ] Refund flow exercised end-to-end with a real Stripe test charge
- [ ] Zone-rate card loaded; AK/HI/PR surcharge verified against the 30% GM floor
- [ ] Nightly `job:forecast` + `job:cycles` scheduled (cron/worker), alerting on failure

## Rollout throttle

- [ ] Waitlist release in batches of ≤ 50 households/week; watch on-time % and GM after shipping on the admin dashboard before each batch
- [ ] Kill criteria reviewed (PRODUCT_STRATEGY §7) — owner assigned to each metric
- [ ] On-call: who answers WhatsApp support, who owns carrier exceptions, who can pause signups (documented here): ______
