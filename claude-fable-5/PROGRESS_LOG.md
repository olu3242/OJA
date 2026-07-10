# Oja — Progress Log

Append-only session log. Newest entry at the bottom. Every build session ends with an entry: date, tasks done, decisions made, next up, blockers.

Entry template:

```
## YYYY-MM-DD — <short session title>

- **Tasks completed:** <EXECUTION_PLAN.md task IDs>
- **Decisions:** <anything chosen that wasn't fully specified, and why>
- **Next up:** <first unchecked task to start next session>
- **Blockers:** <missing keys, unanswered product questions, failing infra — or "none">
```

---

## 2026-07-09 — Repo bootstrap (pre-build)

- **Tasks completed:** n/a (Phase 0 not started — this session created the strategy + execution package itself)
- **Decisions:**
  - Repo structure locked per README: `docs/` strategy set (PRD, GTM, product/pricing/implementation strategy, architecture), `landing-page/` static marketing page, `claude-fable-5/` execution package.
  - Stack committed in CLAUDE.md: Next.js App Router + tRPC + Prisma/Postgres + Tailwind; forecast v0 as TypeScript nightly job, ML deferred to Phase 2.
  - Launch metro provisionally Houston (final call pending supplier diligence — PRD open question #1).
- **Next up:** Task 0.1 — scaffold Next.js app shell.
- **Blockers:** none for 0.1–0.8; Stripe/Twilio/Resend keys needed before 1.2 and 1.8 (stub adapters until then).

## 2026-07-09 — Task 0.1: Next.js app shell scaffolded

- **Tasks completed:** 0.1
- **Decisions:**
  - Scaffolded via `create-next-app@latest` → Next.js 16.2 (App Router, Turbopack), React 19, TypeScript 5, Tailwind v4 (`@tailwindcss/postcss`), ESLint 9 flat config with `eslint-config-next`.
  - Added Prettier 3 + `eslint-config-prettier`; `format`/`format:check`/`typecheck` scripts. Prettier ignores `landing-page/` (kept byte-for-byte untouched per task spec).
  - Dropped the scaffold's Geist Google-font loading in favor of a system font stack — avoids build-time font downloads and matches the landing page's stack.
  - Oja brand tokens (green/orange/cream palette from the landing page) defined as Tailwind theme colors (`oja-green`, `oja-orange`, …) in `app/globals.css`.
  - Root `package.json` scripts now drive the Next app (`dev`/`build`/`start`/`lint`); landing page still servable via `npm run landing`.
  - Prettier also reformatted the markdown docs (tables/emphasis normalization) — content unchanged.
- **Verified:** `npm run typecheck`, `npm run lint`, and `npm run build` all green.
- **Next up:** Task 0.2 — Prisma + Postgres with docker-compose and `.env.example`.
- **Blockers:** none.

## 2026-07-09 — Tasks 0.2 + 0.3: Prisma/Postgres wiring and schema v1 (part 1)

- **Tasks completed:** 0.2, 0.3
- **Decisions:**
  - Prisma 7 conventions: `prisma.config.ts` (loads `.env` via dotenv), new `prisma-client` generator with output to `lib/generated/prisma` (gitignored, regenerate with `npm run db:generate`), and the engine-less client wired through `@prisma/adapter-pg` in the `lib/db.ts` singleton — Prisma 7 requires a driver adapter and no longer reads `.env` itself.
  - `docker-compose.yml` runs Postgres 16 with user/db `oja`/`oja_dev` on 5432 (matches `.env.example`); npm scripts added: `db:up`, `db:migrate`, `db:generate`, `db:studio`.
  - Schema v1 part 1: `accounts` (role enum incl. warehouse/admin, `b2bVerified`, `netTermsStatus` enum, `deliveryZone`), `skus` (English + local-name array for synonym search, category + perishability enums, unit size/weight, halal, shelf life, FDA/allergen compliance fields, directed self-relation substitution graph), `price_books` + `price_book_entries` (retail/member/wholesale tiers, integer cents, `minQty` for quantity breaks, unique per book+sku+minQty).
  - Money stored as integer cents; snake_case table names via `@@map`, camelCase fields.
- **Verified:** initial migration applied against a real Postgres 16; smoke test exercised create/relation/array-search/delete through `lib/db.ts`; typecheck, lint, format, and build all green.
- **Next up:** Task 0.4 — schema v1 part 2 (orders, pantry, procurement, inventory, forecasts, demand_events).
- **Blockers:** none. Note for CI (task 0.7): dev container had no Docker daemon — ran Postgres 16 directly via `initdb`/`pg_ctl`; CI should use a postgres service container.

## 2026-07-09 — Margin-protected pricing update (out-of-plan chore)

- **Tasks completed:** n/a (strategy update from `oja-margin-protected-package.zip`, not an EXECUTION_PLAN task)
- **Decisions:**
  - `docs/PRICING_STRATEGY.md` replaced with the margin-protected, Garri-first version: Starter $24–$34/mo (3–5 lb shipped), Family $49–$79/mo (10–15 lb, hero plan), Stock-Up $89–$119/mo (20–25 lb); 30% gross-margin floor after shipping; all-in pricing formula (product, packaging, shipping, payment fees, shrink, CAC, margin).
  - New `docs/MARGIN_AND_SHIPPING_MODEL.md` (market anchors, shipping buffers, margin-protection rules).
  - `landing-page/index.html` replaced with the package's garri-first page (pricing section carries the new tiers); price note expanded to enumerate included costs and the "not the cheapest garri seller — the reliable monthly pantry-staple subscription" positioning.
  - `PRODUCT_STRATEGY.md` Oja Pantry tier and `GTM.md` launch offer (now first-delivery-only 10–15% discount) reconciled to the new model; README docs table updated.
  - Known tension left intentionally: PRD still describes a ~150-SKU launch catalog while the new pricing doc scopes MVP pricing to Garri only — PRD update was explicitly out of scope for this change.
  - No schema/seed changes needed: no prices are hardcoded in code or seed data yet (task 0.6 not started).
- **Verified:** format, lint, typecheck, build all green; no test script exists yet (Vitest lands at 0.7).
- **Next up:** Task 0.4 — schema v1 part 2.
- **Blockers:** none.

## 2026-07-10 — Product direction pivot: GAARII single-product subscription MVP

- **Tasks completed:** 0.6 (early — garri-only seed script); out-of-plan repositioning across docs + landing page
- **Decisions:**
  - **The MVP is no longer a Nigerian grocery marketplace.** GAARII sells one product — Premium Nigerian Garri (White/Ijebu + Yellow) — subscription only, nationwide U.S., monthly deliveries, pause/skip/cancel anytime. Positioning: "America's first premium Garri subscription."
  - Roadmap locked in all strategy docs: Phase 1 garri only → Phase 2 Nigerian pantry staples (egusi, beans, rice, elubo, fufu, plantain flour, palm oil) + B2B wholesale from waitlist → Phase 3 AI-powered pantry (assistant, auto-replenishment, consumption forecasting, recipes, heritage gifting).
  - Naming convention: **GAARII** = consumer brand; **Oja** = platform/company name (README brand note).
  - Schema untouched (already extensible); `prisma/seed.ts` created seeding exactly the two garri SKUs and deactivating any others; wired via `prisma.config.ts` (`tsx prisma/seed.ts`); idempotent, verified against local Postgres twice.
  - Landing page: hero/nav per direction (How It Works · Subscriptions · Why GAARII · Pricing · FAQ), plans described as Premium Garri quantities only, B2B removed from copy (wholesale-waitlist FAQ instead); design system unchanged.
  - EXECUTION_PLAN: banner supersedes pre-pivot wording; 1.1–1.3 and 2.1–2.4 reworded (single-product storefront, subscription checkout, wholesale waitlist form; B2B standing orders deferred to Phase 2).
  - B2B/community/enterprise pricing sections retained in PRICING_STRATEGY.md but explicitly marked Phase 2+/3+ (documented playbooks, not built).
- **Verified:** format, lint, typecheck, seed (idempotent, 2 active SKUs), build all green; tests N/A (Vitest lands at 0.7).
- **Next up:** Task 0.4 — schema v1 part 2 (subscription/cycle models should follow PRD v0.2's plan structure).
- **Blockers:** none.

## 2026-07-10 — Phases 0–3 build: subscription platform e2e (tasks 0.4–5.2)

- **Tasks completed:** 0.4, 0.5, 0.7, 0.8, 1.1–1.10 (Gate G1), 2.1–2.3 + 2.5–2.9 (Gate G2), 3.1, 3.2, 3.5, 4.3, 5.1, 5.2
- **What shipped:**
  - **Schema part 2 (0.4):** subscriptions (plan/variety/grind/cadence per PRD v0.2) + cycles, orders/lines/refunds, suppliers/POs, warehouses/lots + append-only `inventory_txns`, versioned `forecasts`, append-only `demand_events`, wholesale leads, notification logs, transfer orders.
  - **API/auth (0.5):** tRPC v11 with role-gated procedures (public/authed/staff/admin) at `/api/trpc`; HMAC-cookie dev-auth (`lib/auth.ts`) with find-or-create login — flagged for replacement by email OTP.
  - **Services (`server/services/`):** subscriptions (subscribe/pause/resume/cancel/swap), cycles (confirm with first-delivery discount, skip, cadence cron), procurement (PO + receive with lot/QC), inventory (derived stock, FEFO allocation, recall, warehouse transfers), fulfillment (wave gen with shortage variant-swap, pick/pack, idempotent dispatch, deliver, refund), forecast (V0 committed-floor + trailing blend; V1 seasonal shadow; versioned inserts; overrides w/ reason codes; WAPE; reorder suggestions → one-click PO draft), metrics dashboard, markdown ladder, container planner. Stubs behind interfaces: payments, carrier, notifications.
  - **Surfaces (0.8, 1.1–1.3):** customer (subscribe, account/pantry with cycle-confirm + pause/skip/swap/cancel, wholesale waitlist), warehouse (receive/QC, FEFO wave + pick, ship, deliver, stock tiles), admin (north-star dashboard, forecast run, reorder→PO draft→place, container plan, fresh deals, waitlist leads).
  - **Jobs:** `npm run job:forecast`, `npm run job:cycles`.
  - **Tests (0.7):** 29 green — unit (pricing floor incl. zone surcharges, markdown ladder, container math) + integration gates G1 (PO→receive→FEFO pick→ship→deliver→recall) and G2 (pantry events→forecast→PO draft→override) + G3/Phase-2/3 suite (refund, dashboard, transfers, fresh deals, container plan). Playwright browser e2e: login→subscribe→confirm→PAID. CI workflow with postgres service added.
- **Decisions:**
  - Plan defaults: Starter 4 lb/$29, Family 12 lb/$64 (hero), Stock-Up 22 lb/$104 — mid-range of published bands; unit tests enforce the 30% GM floor and flag that Starter only clears it at commercial parcel rates (per the margin doc's own warning).
  - 4.1 delivered as TS V1 shadow (seasonal index) rather than a Python service — same shadow-mode intent, decision logged in plan banner.
  - Deferred: 2.4/4.2/4.4–4.6 (B2B/wholesale, Phase 2 gate), 3.3 group orders, 5.3 Canada; partial: 3.4 (idempotent dispatch done; durable queue/Sentry pending), 3.6/3.7.
- **Verified:** lint, typecheck, format, 29 vitest + 1 playwright green, production build (all routes compile; dynamic surfaces + static landing).
- **Next up:** 3.4 hardening + 3.7 pilot checklist; swap payment/carrier/notification stubs when keys arrive.
- **Blockers:** Stripe/Twilio/Resend/carrier keys; container Postgres runs ad-hoc (`/tmp/oja-pgdata`, port 5433) — CI uses a service container.

## 2026-07-10 — Phases 1c/2/3 complete: channels, expansion, hardening (all plan tasks closed)

- **Tasks completed:** 2.4, 3.3, 3.4, 3.6, 4.1, 4.2, 4.4, 4.5, 4.6, 5.3 — the execution plan is now fully checked.
- **What shipped:**
  - **Group buying (3.3/4.4):** shareable group-order links (`/group/new`, `/group/[code]`); members join with their own plan/variety; closing charges each member at the aggregated tier discount (5%/$300 · 10%/$750 · 15%/$1,500) and produces ONE order to the drop point. Idempotent close.
  - **Wholesale channel (2.4/4.6):** waitlist leads graduate to verified STORE/RESTAURANT accounts; standing weekly orders ride the subscription machinery (7-day cadence, 50 lb minimum, wholesale price = landed × 1.22); SLA-credit (2× shortfall) and quarterly-rebate (1.5% above $12k) calculators.
  - **POS ingestion (4.2):** `POST /api/webhooks/pos` (shared-secret gated) normalizes Square/Clover-style payloads into `SELL_THROUGH` demand events; weekly aggregation feeds the engine.
  - **Supplier portal alpha (4.5):** SUPPLIER role + supplier-scoped tRPC endpoints — 4-week forecast share per supplied SKU, open POs, fast-pay election.
  - **Forecast cutover gate (4.1):** `recommendForecastSource()` promotes V1 only when its measured WAPE beats V0 on actuals; V1 stays in shadow otherwise. Python ML service deferred until data scale justifies (decision stands).
  - **Canada readiness (5.3):** CAD plan pricing with 1.45 FX buffer, CA territory surcharges (YT/NT/NU), country-aware orders/subscriptions (`currency` on subscription, `country` on order), `cfiaLabelingNotes` on SKUs.
  - **Hardening (3.4/3.6):** structured error-capture adapter wired to tRPC + webhooks (Sentry DSN swap at pilot), idempotent dispatch already in place; aria-labeled form controls across customer surfaces.
- **Verified:** 41 vitest tests green (8 files) including the new `phase23` unit + `phase23-channels` integration suites; lint, typecheck, format, production build (new routes `/group/*`, `/api/webhooks/pos`) all green.
- **Next up:** the plan is complete — future work is external-dependency swaps per `docs/runbooks/G3_PILOT_CHECKLIST.md` and re-planning Phase 2+ against real pilot data.
- **Blockers:** same external keys as before; nothing code-side.
