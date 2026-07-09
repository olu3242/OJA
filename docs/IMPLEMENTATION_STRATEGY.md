# Oja — Implementation Strategy (90-Day MVP + Phased Rollout)

**Version:** 0.1 (Draft) · **Last updated:** 2026-07-09

---

## 1. Approach

Ship a **single-metro, single-warehouse, curated-catalog MVP in 90 days** that proves the core loop: committed demand → forecast → lean procurement → reliable fulfillment. Buy or rent everything that isn't the demand engine or the customer relationship (3PL space, courier last-mile, Stripe, off-the-shelf routing). Build the data foundation properly from day one — it is the only thing that can't be retrofitted.

**Team (MVP):** 1 full-stack lead + 1 full-stack/product engineer (Claude-Code-accelerated; see `claude-fable-5/`), 1 ops lead (warehouse + suppliers), 1 community/growth lead, fractional design. Founder sells B2B.

## 2. 90-Day Plan

### Days 0–15 — Foundations

- Finalize launch metro (supplier diligence + store-density mapping); sign 3PL/cross-dock space.
- Lock 150-SKU launch catalog with 2 suppliers per top-20 SKU; collect compliance/labeling data.
- Tech: repo + CI/CD, Next.js app shell (customer, admin, warehouse surfaces in one codebase), Postgres schema v1 (catalog, accounts, orders, inventory ledger, events stream), Stripe integration, auth with role-based access.
- Landing page live (already in `landing-page/`) collecting waitlist + pantry-profile pre-signups — earliest demand signal.

### Days 16–45 — Order-to-Delivery Loop

- Storefront: browse/search with local-name synonyms, cart, checkout, delivery-window selection.
- B2B: wholesale tier behind business verification, MOV enforcement, manual net-terms approval queue.
- Warehouse web app: receive → QC → putaway → pick → pack; lot/expiry capture; FEFO pick logic.
- Procurement: supplier records, PO creation, expected-arrival tracking.
- Delivery: zone/window batching + courier integration; SMS/email order notifications.
- **Gate G1 (day 45):** internal test order flows end-to-end from PO receipt to doorstep.

### Days 46–70 — Demand Engine v0 + Pantry

- Pantry profiles: staple selection, cadence, cycle-confirm flow (the 5-tap review); skip/edit/substitute all captured as events.
- Standing-order templates for B2B; sell-through quick-entry form.
- Forecast v0: moving average + committed-demand blend per SKU-region; nightly batch; reorder-point suggestions in admin; forecast-vs-actual logging.
- Admin console: catalog, pricing, customers, orders, forecast overrides with reason codes.
- **Gate G2 (day 70):** 10 pilot households + 3 pilot stores complete a full weekly cycle; forecast v0 output driving at least one real PO.

### Days 71–90 — Pilot Launch

- Friends-and-family → 2 church/association group-order events → public waitlist release (throttled by zone).
- Ops hardening: recall drill (lot → orders in < 5 min), substitution flow, refund/freshness-guarantee flow.
- Analytics: north-star dashboard (fulfilled demand, stockout rate, spoilage, WAPE, cycle-confirm rate).
- **Gate G3 (day 90):** 150+ active pantry profiles, 10+ B2B standing orders, ≥ 3 consecutive delivery days with > 95% on-time, spoilage < 10%.

## 3. Build vs. Buy

| Capability                                                        | Decision                                                                             |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Demand engine, pantry/cycle UX, catalog & inventory ledger, admin | **Build** (the moat)                                                                 |
| Payments                                                          | Buy — Stripe (+ ACH for B2B)                                                         |
| Last-mile                                                         | Rent — courier/routing platform; revisit own-fleet at route density > 25 drops/route |
| Warehouse space                                                   | Rent — 3PL cross-dock with cold storage                                              |
| Comms                                                             | Buy — Twilio (SMS/WhatsApp), Resend (email)                                          |
| Analytics pipeline                                                | Buy pipes, own the schema — Postgres + event stream from day one                     |

## 4. Tech Stack (target)

- **App:** Next.js + React + Tailwind; tRPC; Prisma over Postgres (per `package.json` future-deps note). Single deployment, three role-gated surfaces (customer / warehouse / admin).
- **Data:** Postgres as system of record; append-only `demand_events` table; nightly forecast job (TypeScript v0; Python service when ML lands in Phase 2).
- **Infra:** Vercel or Fly.io + managed Postgres (Neon/Supabase); GitHub Actions CI; Sentry.
- **Integrations:** Stripe, Twilio, Resend, courier API, (Phase 2) Square/Clover POS.

## 5. Phase 2 (Months 4–9) — Engine + Metro 2

ML forecast v1 (hierarchical time-series w/ events calendar), POS sell-through integrations, group buying productized, supplier portal alpha, Atlanta launch using a metro-launch playbook extracted from metro 1. Entry gate: G3 sustained for 6 weeks + contribution margin trending positive.

## 6. Phase 3 (Months 10–18) — Up the Chain + Canada

Container-consolidation planning, markdown automation, cold-chain expansion, DMV metro, Toronto (customs/CFIA workstream starts month 10 — long lead item).

## 7. Top Delivery Risks

| Risk                                | Mitigation                                                                                                                                           |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| 90 days is tight for ops + software | Software scope is ruthlessly P0-only (see PRD §4); ops runs manual-behind-the-curtain wherever software slips (e.g., routing via spreadsheet week 1) |
| Cold-start supply commitments       | Anchor B2B standing orders signed _before_ warehouse opens; shelf-stable-heavy launch catalog                                                        |
| Single-warehouse fragility          | Dual suppliers on top-20 SKUs; 1-week safety stock on staples despite JIT purity — dogma loses to customer trust                                     |
| Team of ~4                          | Claude-Fable-5 execution package (`claude-fable-5/`) carries the well-specified build work; humans hold product judgment, ops, and community         |

## 8. Budget Envelope (MVP quarter, directional)

3PL + warehouse ops $60–90k · launch inventory $80–120k · team $120–160k · tech/SaaS $8–15k · GTM $30–50k → **~$300–435k** to Gate G3.
