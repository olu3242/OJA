# GAARII — Execution Plan (Phased Build Tasks)

Work top-to-bottom within the current phase. Check tasks off (`[x]`) in the same commit that completes them. Phase gates map to `../docs/IMPLEMENTATION_STRATEGY.md` (G1/G2/G3). Scope authority: `../docs/PRD.md` §3–4. Invariants: `CLAUDE.md`.

> **Product direction update (2026-07-09):** GAARII MVP = **Premium Nigerian Garri only** (White/Ijebu + Yellow), **subscription only**, nationwide U.S. parcel delivery. Task wording below predating this pivot is superseded where it conflicts: no multi-SKU catalog, no B2B wholesale surfaces (waitlist form only), no one-off checkout. Schema stays extensible; storefront exposes one product.

---

## Phase 0 — Scaffold & Foundations (Days 0–15)

- [x] 0.1 Scaffold Next.js (App Router) + TypeScript + Tailwind + ESLint/Prettier; update root `package.json` (replace static-site scripts; keep `landing-page/` untouched)
- [x] 0.2 Add Prisma + Postgres; wire local dev via `docker-compose.yml` (postgres service) and `.env.example`
- [x] 0.3 Schema v1: `accounts` (+ roles enum: household/store/restaurant/community/warehouse/admin), `skus` (origin, local-name synonyms, unit size, perishability class, halal flag, compliance fields), `price_books` (retail/member/wholesale)
- [ ] 0.4 Schema v1 (cont.): `orders`/`order_lines`, `pantry_profiles`/`pantry_items`/`cycles`, `suppliers`/`purchase_orders`/`po_lines`, `warehouses`/`lots`/`inventory_txns`, `forecasts`, `demand_events` (append-only)
- [ ] 0.5 tRPC setup with role-gated context; auth (email OTP or NextAuth credentials to start) + B2B verification flag
- [x] 0.6 Seed script: garri-only seed — exactly 2 SKUs (Premium White Garri / Ijebu, Premium Yellow Garri), no other products (completed early, 2026-07-09, as part of the single-product repositioning; warehouse/supplier/price-book seed rows land with tasks 0.4+ when those models exist)
- [ ] 0.7 Event emission helper (`emitDemandEvent`) + Vitest harness + Playwright skeleton; CI via GitHub Actions (lint, typecheck, test)
- [ ] 0.8 Route groups + shells for the three surfaces: `(customer)`, `(warehouse)`, `(admin)` with role guards and mobile-first layout primitives

## Phase 1a — Order-to-Delivery Loop (Days 16–45 → Gate G1)

- [ ] 1.1 Single-product storefront: Premium Garri page — variety (White Ijebu / Yellow), grind, plan size selection (no catalog browse/marketplace UI)
- [ ] 1.2 Subscription checkout (Stripe subscriptions, test mode) with zone-economics guardrail; confirmation + subscription status page
- [ ] 1.3 Wholesale-interest waitlist form for stores/restaurants (no wholesale pricing or B2B surfaces in MVP — channel opens Phase 2)
- [ ] 1.4 Procurement: supplier CRUD, PO creation, expected-arrival tracking
- [ ] 1.5 Warehouse receiving: receive-against-PO flow with lot + expiry capture and QC pass/fail → `inventory_txns`
- [ ] 1.6 Pick/pack: wave generation from open orders, FEFO-enforced pick lists, pack confirmation, camera barcode scan
- [ ] 1.7 Fulfillment batching: group orders by zone + delivery day; courier dispatch stub adapter; tracking states
- [ ] 1.8 Notifications: order confirmed / out-for-delivery / delivered via SMS+email (stub adapters behind interface until keys exist)
- [ ] 1.9 Recall query + runbook test: lot → orders → customers under 5 min on seeded data
- [ ] 1.10 **Gate G1 e2e test**: PO → receive → order → pick (FEFO) → pack → dispatch → delivered, green in CI

## Phase 1b — Pantry & Demand Engine v0 (Days 46–70 → Gate G2)

- [ ] 2.1 Pantry management: plan builder (variety/grind/size/cadence) generates next `cycle`; pause/skip/swap/cancel from account
- [ ] 2.2 Cycle-confirm flow (the 5-tap review): confirm / edit / skip; every action emits `demand_events`; confirmed cycle → order
- [ ] 2.3 Variant-swap preferences (White↔Yellow, grind) with event capture on shortage
- [ ] 2.4 ~~B2B standing-order templates~~ deferred to Phase 2 (wholesale channel not in MVP)
- [ ] 2.5 Forecast v0 nightly job: trailing moving average × seasonal index + committed-demand floor, per SKU × warehouse, 4-week horizon; versioned `forecasts` inserts
- [ ] 2.6 Reorder suggestions in admin (forecast − on-hand − inbound vs. reorder point by perishability class) → one-click PO draft
- [ ] 2.7 Forecast override UI with reason codes; forecast-vs-actual logging + WAPE metric
- [ ] 2.8 Cycle-generation cron (creates upcoming cycles, sends confirm nudges)
- [ ] 2.9 **Gate G2 e2e test**: pantry profile → cycle confirm → order fulfilled; forecast job output drives a PO draft

## Phase 1c — Pilot Hardening (Days 71–90 → Gate G3)

- [ ] 3.1 Freshness-guarantee refund flow (refund without return) + reason capture
- [ ] 3.2 North-star dashboard (admin): fulfilled demand, stockout rate top-20 SKUs, spoilage %, WAPE, cycle-confirm rate
- [ ] 3.3 Group-order links: shareable link aggregating multiple payers into one delivery (P2 — cut first if time-constrained)
- [ ] 3.4 Load/failure hardening: durable checkout write queue, idempotent courier sync, Sentry wiring
- [ ] 3.5 Ops runbooks in `/docs/runbooks/`: receiving day, delivery day, recall drill, refund handling
- [ ] 3.6 Accessibility + mobile pass on customer and warehouse surfaces
- [ ] 3.7 **Gate G3 checklist**: seed-to-pilot data migration plan, throttled zone rollout switch, on-call notes

## Phase 2 — Engine & Scale (Months 4–9) _(do not start before G3)_

- [ ] 4.1 Python demand-engine service (hierarchical time-series + events calendar: Ramadan, Christmas, Independence Days); shadow-mode vs. v0 before cutover
- [ ] 4.2 POS sell-through ingestion (Square/Clover webhooks)
- [ ] 4.3 Multi-warehouse inventory + transfer orders; metro-2 launch playbook automation
- [ ] 4.4 Group buying productized (tiers per PRICING_STRATEGY.md §3); coordinator credits
- [ ] 4.5 Supplier portal alpha: shared forecasts, forward commitments, fast-pay election
- [ ] 4.6 Wholesale+ tier: standing-order SLA tracking, sell-through analytics dashboard, quarterly rebate calc

## Phase 3 — Up the Chain (Months 10–18) _(placeholder — re-plan after Phase 2)_

- [ ] 5.1 Container-consolidation planner over aggregate forecasts
- [ ] 5.2 Expiry-risk markdown ladder automation ("Fresh Deals")
- [ ] 5.3 Canada/Toronto: CFIA compliance fields, currency, tax, customs workflow
