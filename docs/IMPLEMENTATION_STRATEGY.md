# GAARII — Implementation Strategy (90-Day MVP + Phased Rollout)

**Version:** 0.2 (Draft — single-product subscription MVP) · **Last updated:** 2026-07-09

---

## 1. Approach

Ship a **single-product, subscription-only MVP in 90 days**: Premium Nigerian Garri (White/Ijebu + Yellow), monthly plans, nationwide U.S. parcel delivery, pantry management (pause/skip/cancel anytime). One product means one sourcing spec, one quality bar, two SKUs, and a forecast problem simple enough to get right on day one.

Buy or rent everything that isn't the subscription experience, the demand engine, or the quality bar (3PL storage + parcel carriers, Stripe billing, off-the-shelf comms). Build the data foundation properly from day one — it is the only thing that can't be retrofitted, and it's what makes Phase 2 expansion cheap.

**Team (MVP):** 1 full-stack lead + 1 full-stack/product engineer (Claude-Code-accelerated; see `claude-fable-5/`), 1 ops lead (supplier + 3PL + QC), 1 community/growth lead, fractional design. Founder drives community partnerships.

## 2. 90-Day Plan

### Days 0–15 — Foundations

- Lock 2–3 vetted Nigerian processors per variety against **one written quality spec** (moisture, acidity/sourness grade, grit, packaging); collect FDA labeling/compliance data for both SKUs.
- Sign 3PL with parcel-shipping integration; get zone-rate cards to validate plan pricing against the 30% GM floor (`MARGIN_AND_SHIPPING_MODEL.md`).
- Tech: repo + CI/CD, Next.js app shell, Postgres schema (accounts, SKUs, plans/subscriptions, inventory ledger, events stream), Stripe subscription billing, role-based auth.
- Landing page live (already in `landing-page/`) collecting waitlist signups by plan interest — earliest demand signal.

### Days 16–45 — Subscription-to-Delivery Loop

- Storefront: variety/grind/plan selection → Stripe subscription checkout → account with pause/skip/swap/cancel.
- Procurement: supplier records, POs for the two garri SKUs, expected-arrival tracking.
- Warehouse/3PL flow: receive → QC against the spec → putaway; lot tracking, FEFO picking; pick/pack → parcel label → tracking notifications.
- **Gate G1 (day 45):** internal test subscription flows end-to-end — PO receipt to doorstep parcel with tracking.

### Days 46–70 — Pantry Management + Demand Engine v0

- Cycle-confirm flow (5-tap review before each delivery); every confirm/edit/skip/pause emits demand events.
- Forecast v0: subscription-committed demand + trailing consumption per region; nightly batch; reorder-point suggestions in admin; forecast-vs-actual logging.
- Zone-economics guardrail at signup (surcharge / cadence / plan-size controls for expensive zones).
- Admin console: SKUs, plan pricing, subscribers, orders, inventory, forecast overrides with reason codes.
- **Gate G2 (day 70):** 25 pilot households complete a full delivery cycle; forecast v0 output drives at least one real PO; measured GM per shipped order ≥ 30%.

### Days 71–90 — Pilot Launch

- Founding-subscriber wave (friends/family + WhatsApp networks) → 2 church/association signup drives → public waitlist release (throttled).
- Ops hardening: recall drill (lot → orders in < 5 min), quality-guarantee refund flow, damaged-parcel replacement flow.
- Analytics: north-star dashboard (active subscribers, on-time %, GM after shipping, WAPE, cycle-confirm rate, pause/skip/cancel rates).
- **Gate G3 (day 90):** 150+ active paying subscriptions, ≥ 95% on-time across 3 consecutive weeks, GM after shipping ≥ 30%, quality-complaint rate < 2%.

## 3. Build vs. Buy

| Capability                                                               | Decision                                                         |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------- |
| Subscription/pantry UX, demand engine, catalog & inventory ledger, admin | **Build** (the moat)                                             |
| Billing                                                                  | Buy — Stripe subscriptions                                       |
| Fulfillment                                                              | Rent — 3PL with parcel integration (USPS/UPS commercial rates)   |
| Comms                                                                    | Buy — Twilio (SMS/WhatsApp), Resend (email)                      |
| Analytics pipeline                                                       | Buy pipes, own the schema — Postgres + event stream from day one |

## 4. Tech Stack (target)

- **App:** Next.js + React + Tailwind; tRPC; Prisma over Postgres. Single deployment, three role-gated surfaces (customer / warehouse / admin).
- **Data:** Postgres as system of record; append-only `demand_events` table; nightly forecast job (TypeScript v0; Python service when ML lands in Phase 2). Schema stays product-agnostic — Phase 2 staples are seed data, not redesign.
- **Infra:** Vercel or Fly.io + managed Postgres (Neon/Supabase); GitHub Actions CI; Sentry.
- **Integrations:** Stripe, Twilio, Resend, 3PL/parcel API.

## 5. Phase 2 — Nigerian Pantry Staples _(entry gate: PRD §8 graduation criteria)_

Add staples one at a time — egusi, beans, rice, yam flour (elubo), fufu, plantain flour, palm oil — each with its own sourcing spec and QC bar on the existing subscription machinery. Multi-SKU baskets and substitution preferences. **B2B wholesale channel opens** from the MVP waitlist (standing orders, wholesale tiers). ML forecast v1 (hierarchical time-series + events calendar). Supplier portal alpha.

## 6. Phase 3 — AI-Powered Pantry Management

Complete Nigerian pantry · AI Pantry Assistant · smart auto-replenishment · family consumption forecasting · recipe recommendations · heritage gifting. Canada expansion evaluated here (CFIA compliance workstream is the long-lead item).

## 7. Top Delivery Risks

| Risk                                | Mitigation                                                                                                                         |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Shipping cost breaks plan margins   | Zone-rate validation before launch; 30% GM floor enforced at signup via zone guardrails; Family plan as hero (best ship economics) |
| Quality spec slips at the processor | Two suppliers per variety, batch QC on receipt, quality guarantee funded by spoilage allowance                                     |
| 90 days is tight for ops + software | Scope is two SKUs and one flow; ops runs manual-behind-the-curtain wherever software slips                                         |
| Single-product demand risk          | Deliberate bet (see PRODUCT_STRATEGY §7 kill criteria); waitlist interest tested before inventory is bought                        |
| Team of ~4                          | Claude-Fable-5 execution package (`claude-fable-5/`) carries the well-specified build work                                         |

## 8. Budget Envelope (MVP quarter, directional)

3PL + fulfillment ops $40–60k · launch garri inventory $30–50k · team $120–160k · tech/SaaS $8–15k · GTM $30–50k → **~$230–335k** to Gate G3 (leaner than the multi-SKU plan — single-product focus cuts inventory and warehouse cost).
