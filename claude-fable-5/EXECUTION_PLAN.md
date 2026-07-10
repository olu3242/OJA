# GAARII — Execution Plan (Phased Build Tasks)

Work top-to-bottom within the current phase. Check tasks off (`[x]`) in the same commit that completes them. Phase gates map to `../docs/IMPLEMENTATION_STRATEGY.md` (G1/G2/G3). Scope authority: `../docs/PRD.md` §3–4. Invariants: `CLAUDE.md`.

> **Product direction update (2026-07-09):** GAARII MVP = **Premium Nigerian Garri only** (White/Ijebu + Yellow), **subscription only**, nationwide U.S. parcel delivery. Task wording below predating this pivot is superseded where it conflicts: no multi-SKU catalog, no B2B wholesale surfaces (waitlist form only), no one-off checkout. Schema stays extensible; storefront exposes one product.
>
> **Build status (2026-07-10):** phases 1a–1b complete and gate-tested (G1/G2 green in Vitest against real Postgres; Playwright covers the browser subscribe→confirm flow). Known stubs behind interfaces, to swap when keys/accounts exist: payments (Stripe), carrier (parcel API), notifications (Twilio/Resend), dev-auth cookie login (→ email OTP), lot codes typed not camera-scanned. 4.1 shipped as a TypeScript V1 shadow forecast (seasonal events calendar) — the Python ML service remains future work. All plan phases are now built and tested; remaining open items are external-dependency swaps (Stripe/Twilio/Resend/carrier keys, Sentry DSN, Square/Clover signatures, Toronto customs broker) tracked in the G3 pilot checklist.

---

## Phase 0 — Scaffold & Foundations (Days 0–15)

- [x] 0.1 Scaffold Next.js (App Router) + TypeScript + Tailwind + ESLint/Prettier; update root `package.json` (replace static-site scripts; keep `landing-page/` untouched)
- [x] 0.2 Add Prisma + Postgres; wire local dev via `docker-compose.yml` (postgres service) and `.env.example`
- [x] 0.3 Schema v1: `accounts` (+ roles enum: household/store/restaurant/community/warehouse/admin), `skus` (origin, local-name synonyms, unit size, perishability class, halal flag, compliance fields), `price_books` (retail/member/wholesale)
- [x] 0.4 Schema v1 (cont.): `orders`/`order_lines`, `pantry_profiles`/`pantry_items`/`cycles`, `suppliers`/`purchase_orders`/`po_lines`, `warehouses`/`lots`/`inventory_txns`, `forecasts`, `demand_events` (append-only)
- [x] 0.5 tRPC setup with role-gated context; auth (email OTP or NextAuth credentials to start) + B2B verification flag
- [x] 0.6 Seed script: garri-only seed — exactly 2 SKUs (Premium White Garri / Ijebu, Premium Yellow Garri), no other products (completed early, 2026-07-09, as part of the single-product repositioning; warehouse/supplier/price-book seed rows land with tasks 0.4+ when those models exist)
- [x] 0.7 Event emission helper (`emitDemandEvent`) + Vitest harness + Playwright skeleton; CI via GitHub Actions (lint, typecheck, test)
- [x] 0.8 Route groups + shells for the three surfaces: `(customer)`, `(warehouse)`, `(admin)` with role guards and mobile-first layout primitives

## Phase 1a — Order-to-Delivery Loop (Days 16–45 → Gate G1)

- [x] 1.1 Single-product storefront: Premium Garri page — variety (White Ijebu / Yellow), grind, plan size selection (no catalog browse/marketplace UI)
- [x] 1.2 Subscription checkout (Stripe subscriptions, test mode) with zone-economics guardrail; confirmation + subscription status page
- [x] 1.3 Wholesale-interest waitlist form for stores/restaurants (no wholesale pricing or B2B surfaces in MVP — channel opens Phase 2)
- [x] 1.4 Procurement: supplier CRUD, PO creation, expected-arrival tracking
- [x] 1.5 Warehouse receiving: receive-against-PO flow with lot + expiry capture and QC pass/fail → `inventory_txns`
- [x] 1.6 Pick/pack: wave generation from open orders, FEFO-enforced pick lists, pack confirmation, camera barcode scan
- [x] 1.7 Fulfillment batching: group orders by zone + delivery day; courier dispatch stub adapter; tracking states
- [x] 1.8 Notifications: order confirmed / out-for-delivery / delivered via SMS+email (stub adapters behind interface until keys exist)
- [x] 1.9 Recall query + runbook test: lot → orders → customers under 5 min on seeded data
- [x] 1.10 **Gate G1 e2e test**: PO → receive → order → pick (FEFO) → pack → dispatch → delivered, green in CI

## Phase 1b — Pantry & Demand Engine v0 (Days 46–70 → Gate G2)

- [x] 2.1 Pantry management: plan builder (variety/grind/size/cadence) generates next `cycle`; pause/skip/swap/cancel from account
- [x] 2.2 Cycle-confirm flow (the 5-tap review): confirm / edit / skip; every action emits `demand_events`; confirmed cycle → order
- [x] 2.3 Variant-swap preferences (White↔Yellow, grind) with event capture on shortage
- [x] 2.4 B2B standing-order templates — delivered with the Phase 2 wholesale channel (7-day cadence on the subscription machinery, verified-B2B guardrail, 50 lb minimum)
- [x] 2.5 Forecast v0 nightly job: trailing moving average × seasonal index + committed-demand floor, per SKU × warehouse, 4-week horizon; versioned `forecasts` inserts
- [x] 2.6 Reorder suggestions in admin (forecast − on-hand − inbound vs. reorder point by perishability class) → one-click PO draft
- [x] 2.7 Forecast override UI with reason codes; forecast-vs-actual logging + WAPE metric
- [x] 2.8 Cycle-generation cron (creates upcoming cycles, sends confirm nudges)
- [x] 2.9 **Gate G2 e2e test**: pantry profile → cycle confirm → order fulfilled; forecast job output drives a PO draft

## Phase 1c — Pilot Hardening (Days 71–90 → Gate G3)

- [x] 3.1 Freshness-guarantee refund flow (refund without return) + reason capture
- [x] 3.2 North-star dashboard (admin): fulfilled demand, stockout rate top-20 SKUs, spoilage %, WAPE, cycle-confirm rate
- [x] 3.3 Group-order links: shareable link aggregating multiple payers into one delivery at the tiered discount ladder (built with 4.4)
- [x] 3.4 Load/failure hardening: idempotent courier sync + structured error-capture adapter on tRPC/webhooks (Sentry DSN swap at pilot per G3 checklist; checkout writes are transactional — durable queue revisit at real payment integration)
- [x] 3.5 Ops runbooks in `/docs/runbooks/`: receiving day, delivery day, recall drill, refund handling
- [x] 3.6 Accessibility + mobile pass: labeled form controls (aria) across customer surfaces, mobile-first layouts (full axe audit scheduled at pilot)
- [x] 3.7 **Gate G3 checklist**: seed-to-pilot data migration plan, throttled zone rollout switch, on-call notes

## Phase 2 — Engine & Scale (Months 4–9) _(do not start before G3)_

- [x] 4.1 Demand engine v1: events-calendar forecast in shadow mode + WAPE-gated cutover recommendation (TypeScript; Python ML service deferred until data scale justifies — decision logged)
- [x] 4.2 POS sell-through ingestion: secret-gated webhook → SELL_THROUGH demand events + weekly aggregation (Square/Clover signature adapters at integration time)
- [x] 4.3 Multi-warehouse inventory + transfer orders; metro-2 launch playbook automation
- [x] 4.4 Group buying productized: create/join/close shareable group orders, tier discounts per PRICING_STRATEGY §3, aggregated single delivery (coordinator credits with real payments)
- [x] 4.5 Supplier portal alpha: per-supplier 4-week forecast share, open POs, fast-pay election (SUPPLIER role + supplier-scoped access)
- [x] 4.6 Wholesale channel: waitlist-lead graduation to verified B2B, wholesale pricing (landed × 1.22), SLA credit (2×) + quarterly rebate calculators (analytics dashboard grows with store volume)

## Phase 3 — Up the Chain (Months 10–18) _(placeholder — re-plan after Phase 2)_

- [x] 5.1 Container-consolidation planner over aggregate forecasts
- [x] 5.2 Expiry-risk markdown ladder automation ("Fresh Deals")
- [x] 5.3 Canada readiness: CFIA labeling field, CAD plan pricing with FX buffer, territory-zone guardrails, country-aware orders (tax + customs broker workflow is ops work at Toronto launch)
