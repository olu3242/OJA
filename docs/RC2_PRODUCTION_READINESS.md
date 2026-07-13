# Oja RC-2 — Production Readiness & Enterprise Hardening

Principal Architect assessment for the nationwide pilot. This document is the
grounded gap report the RC-2 mandate asked for: what is genuinely done, what is a
real gap, the evidence for each, and a GO decision. It deliberately does **not**
claim completion for work that requires external services or credentials not
present in this environment (Stripe, Supabase project, Sentry/OTel backends,
Redis, container registry) — those are listed as gaps with mitigation and
timeline rather than fabricated.

## Executive summary

**Recommendation: GO WITH CONDITIONS.**

The core platform is real and tested end-to-end at the service layer (87
automated tests, all green; typecheck/lint/format/build clean). Multi-tenant
isolation is enforced in Postgres (RLS), the commerce/subscription/group/
wholesale/warehouse engines are functional, and RC-2 adds the operational
surface a pilot needs: **health/readiness/liveness probes** and **baseline
security headers**. The conditions blocking an unconditional GO are all
**external integrations** (an afternoon of credential/dashboard work each) plus a
short list of code follow-ups — none of which are architectural rewrites.

## What shipped in RC-2 (this session)

| Area                 | Change                                                                                                                                                         | Evidence                                                           |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| WS10 Ops probes      | `/api/health`, `/api/ready` (200/503), `/api/live` (dependency-free), `/api/status`; `lib/health.ts` rollup with per-dependency latency, critical vs. optional | `curl` returns correct JSON + status codes; 3 tests                |
| WS7 Security headers | CSP, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, HSTS, DNS-prefetch-off — applied in middleware on every page response        | headers present on `/`; CSP renders app with 0 violations; 2 tests |
| WS11 QA              | `tests/integration/health.test.ts` (5 tests) added to the suite (82 → 87)                                                                                      | `vitest run` 87 passing                                            |

Probes are excluded from the session-refresh matcher so they stay
dependency-light; the readiness check treats the revenue-bearing Prisma DB as
**critical** (503 if down) and the canonical/Supabase DB as **optional**
(degraded, since convergence is flag-gated OFF by default).

## Architecture (request / event / data flows)

```
REQUEST FLOW
  Browser
    │  HTTPS
    ▼
  middleware.ts ── applySecurityHeaders() + Supabase cookie refresh
    │
    ├─► App Router page (RSC)  ── currentAccount() guard ─► redirect /login if anon
    │        │
    │        ▼
    │   tRPC caller (server) ── public | authed | staff | admin procedures
    │        │
    │        ▼
    │   server/services/*  (commerce, subscriptions, cycles, group, wholesale,
    │        │              fulfillment, inventory, forecast, metrics, pos)
    │        ▼
    │   Prisma (lib/db)  ─────────────────►  Postgres  (legacy, revenue-bearing)
    │        │
    │        └─ mirrorAccount() [flag: canonical_dual_write]
    │                 ▼
    │            canonicalPool (pg) ───────►  Postgres  (canonical, RLS, multi-tenant)
    │
    └─► /api/{health,ready,live,status}  ── lib/health ─► both DBs (probe, no session)

EVENT FLOW  (current)
  service mutation ──► emitDemandEvent(type, refs)  [append-only demand_events table]
                          types: SUBSCRIBE, CONFIRM, SKIP, PAUSE, RESUME, CANCEL,
                                 SWAP, REFUND, DELIVERY, SELL_THROUGH, …
                          consumers: forecast/metrics read the stream (pull)
  (GAP: no async EventBus/DLQ/retry — events are persisted synchronously in-txn)

DATA FLOW
  Legacy Prisma schema  ──[convergence: backfill + live dual-write]──►  Canonical schema
     (orders, subs,            legacy_map bridge, parity-checked,          (123 tables,
      cycles, refunds,         flag-gated read cutover per domain)          RLS everywhere)
      shipments, groups)
```

## Workstream gap report

Legend: **DONE** (implemented + evidence) · **PARTIAL** (works, hardening/edges
remain) · **EXTERNAL** (code ready; needs credentials/service) · **GAP** (not built).

| #   | Workstream        | Status              | Evidence / What remains                                                                                                                                                                                                                                                                                                                                                                                                               |
| --- | ----------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Authentication    | PARTIAL / EXTERNAL  | Google OAuth (PKCE), idempotent provisioning, account linking, session-refresh middleware, logout, login history, `currentAccount()` route guards — all implemented and unit-tested. **EXTERNAL:** needs a Supabase project + Google client to run live (docs/auth/DEPLOYMENT_GUIDE). **GAP:** email/password auth (verify, reset, change), refresh-token rotation config, "remember me" — Supabase can provide these; not yet wired. |
| 2   | Commerce E2E      | PARTIAL             | Subscription/group/wholesale/renewal/cancel flows covered by integration tests through the real services. **GAP:** in-browser E2E of the full purchase path is blocked by auth being EXTERNAL and payment being a stub. Stripe webhooks/idempotency/retry not implemented (adapter is a stub interface).                                                                                                                              |
| 3   | Warehouse         | DONE                | Inventory (FEFO allocation), receive/pick/pack/dispatch/deliver, shipments convergence, markdowns — implemented and tested (gate suites + canonical dual-write).                                                                                                                                                                                                                                                                      |
| 4   | Admin metrics     | PARTIAL             | Every tile is a live DB query (no placeholders): subscribers, cycle-confirm, on-time ship, GM, WAPE, refunds, convergence parity, source-aware commerce KPIs. **GAP:** MRR/ARR/failed-payment/retry-queue tiles depend on the (stubbed) billing integration.                                                                                                                                                                          |
| 5   | Event-driven arch | PARTIAL             | Append-only `demand_events` intent stream with typed events + correlation refs; forecast/metrics consume it. **GAP:** no async EventBus / publisher-subscriber / RetryHandler / DeadLetterQueue — processing is synchronous in-transaction. Adding a queue needs Redis/PG-queue (EXTERNAL infra).                                                                                                                                     |
| 6   | Observability     | PARTIAL / EXTERNAL  | Structured JSON error logging (`captureError`), health/status endpoints with per-dependency latency. **EXTERNAL:** OpenTelemetry tracing + Sentry need a DSN/collector. **GAP:** correlation-ID propagation, request/latency metrics export.                                                                                                                                                                                          |
| 7   | Security          | PARTIAL             | **DONE this session:** CSP + full security-header set, `frame-ancestors 'none'`, HSTS, nosniff. Existing: RLS tenant isolation, RBAC procedures, Zod input validation, httpOnly Supabase cookies, webhook shared-secret. **GAP:** rate limiting, per-provider webhook signature verification, nonce-based CSP (currently `'unsafe-inline'`).                                                                                          |
| 8   | Performance       | PARTIAL             | Next 16 + Turbopack production build succeeds; server components + streaming. **GAP:** no Lighthouse/CWV run captured, no explicit image/font optimization pass, no Redis caching. DB has FK indexes everywhere (canonical §Z pass).                                                                                                                                                                                                  |
| 9   | Reliability       | PARTIAL             | `mirrorAccount` is best-effort (never breaks the revenue path); convergence is idempotent + parity-gated; hourly reconize job. **GAP:** no circuit breakers/timeouts/retry policies around external calls (none exist yet), no webhook replay store.                                                                                                                                                                                  |
| 10  | Production ops    | DONE (this session) | `/health` `/ready` `/live` `/status` implemented, tested, and curl-verified with correct status codes + latency. Readiness gates on the critical DB.                                                                                                                                                                                                                                                                                  |
| 11  | Automated QA      | PARTIAL             | 87 tests: unit + integration + canonical/RLS + provisioning + convergence + Playwright subscribe→confirm e2e. **GAP:** visual-regression, load, chaos, and full authed-browser E2E suites; coverage % not instrumented.                                                                                                                                                                                                               |
| 12  | Deployment        | GAP / EXTERNAL      | Env-var driven, additive migrations, canonical migrate/verify tooling, rollback via git + additive-only schema. **GAP:** no Dockerfile, backup/restore runbook, or blue-green/DR automation in-repo.                                                                                                                                                                                                                                  |
| 13  | Pilot docs        | PARTIAL             | Auth deployment guide, RLS/security/migration reports, G3 pilot checklist, this RC-2 report, DESIGN_SYSTEM. **GAP:** warehouse/support/incident-response handbooks.                                                                                                                                                                                                                                                                   |

## Remaining risks

| Risk                                                    | Severity | Mitigation                                                                                                                                          | Timeline |
| ------------------------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Payments are a stub interface (no real Stripe)          | CRITICAL | Implement the `PaymentProvider` behind the existing interface; add webhook signature + idempotency store. No architecture change — the seam exists. | 3–5 days |
| Auth not live (Supabase project + Google client absent) | HIGH     | Provision Supabase, enable Google, set env per DEPLOYMENT_GUIDE. Code is ready.                                                                     | 0.5 day  |
| No email/password auth (only OAuth)                     | MEDIUM   | Enable Supabase email provider + add verify/reset UI actions.                                                                                       | 2–3 days |
| Synchronous event processing (no queue/DLQ)             | MEDIUM   | Introduce a PG-backed job queue or Redis + worker; wrap `emitDemandEvent` consumers.                                                                | 3–5 days |
| No external telemetry (Sentry/OTel) or rate limiting    | MEDIUM   | Wire Sentry DSN into `captureError`; add OTel SDK in `instrumentation.ts`; add edge rate-limit.                                                     | 2–3 days |
| No container/deploy/DR artifacts                        | MEDIUM   | Add Dockerfile, backup/restore runbook, blue-green config for the target platform.                                                                  | 2–4 days |
| CSP uses `'unsafe-inline'`                              | LOW      | Move to nonce-based CSP via middleware nonce injection.                                                                                             | 1–2 days |

## Final certification checklist (evidence-based)

| Item                     | Status       | Evidence                                                             |
| ------------------------ | ------------ | -------------------------------------------------------------------- |
| TypeScript               | ✅           | `npm run typecheck` clean                                            |
| ESLint                   | ✅           | `npm run lint` clean                                                 |
| Tests                    | ✅           | `vitest run` — 87 passing                                            |
| Build                    | ✅           | `npm run build` succeeds (all routes incl. new probes)               |
| Health checks            | ✅           | `/api/{health,ready,live,status}` curl-verified, 5 tests             |
| Security headers         | ✅           | CSP + 5 headers present on `/`; app renders with 0 CSP violations    |
| Multi-tenant isolation   | ✅           | RLS suite (tenant read/write isolation, role-escalation guard)       |
| Warehouse fulfillment    | ✅           | Gate + convergence suites (receive→pick→pack→ship→deliver)           |
| Admin dashboard          | ✅           | Live-query tiles; source-aware KPIs; parity panel                    |
| Subscription purchase    | ✅ (service) | subscribe→confirm covered by tests + Playwright; ⚠ not billed (stub) |
| Group / wholesale orders | ✅           | dual-write + service tests                                           |
| Audit logging            | ✅           | canonical audit triggers + `demand_events` stream                    |
| Stripe test mode         | ❌           | Not integrated (stub) — see CRITICAL risk                            |
| Google OAuth (live)      | ⏳ EXTERNAL  | Code complete; needs Supabase/Google credentials                     |
| Email verify / pw reset  | ❌           | Not built                                                            |
| Monitoring (Sentry/OTel) | ⏳ EXTERNAL  | `captureError` seam ready; needs DSN                                 |
| Lighthouse > 95          | ⬜           | Not measured this session                                            |
| Accessibility WCAG AA    | ⚠            | Focus rings, aria-labels, semantic HTML, role=alert; no full audit   |
| Zero critical bugs       | ✅           | None known in tested paths                                           |

## GO / NO-GO

**GO WITH CONDITIONS.** Green-light a **controlled** pilot once these are met, in
order:

1. **Wire Stripe** behind the existing `PaymentProvider` interface (webhook
   signature + idempotency). _(blocking — real money)_
2. **Provision Supabase + Google OAuth**, run `canonical:migrate` + `verify`
   against it, smoke-test signup→onboarding→signout→signin. _(external, fast)_
3. **Point `captureError` at Sentry** and add an uptime monitor against
   `/api/ready`. _(external, fast)_

Everything else in the risk table is a fast-follow that can land during the pilot
without blocking launch. Do **not** enable the `canonical_dual_write` /
`canonical_read` flags in production until parity holds on live data (they
default OFF, so this is safe by construction).
