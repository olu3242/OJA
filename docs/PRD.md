# GAARII — Product Requirements Document (PRD)

**Version:** 0.2 (Draft) — repositioned to single-product subscription MVP
**Owner:** Zenith AI Automation Agency
**Last updated:** 2026-07-09

---

## 1. Overview

**GAARII is a single-product subscription company.** The MVP sells exactly one product — **Premium Nigerian Garri**, in White (Ijebu) and Yellow varieties — as a monthly, nationwide-U.S. subscription with pantry management built in (pause/skip/cancel anytime). It is **not** a Nigerian grocery marketplace, and the MVP deliberately excludes every other product category.

GAARII is the consumer brand of the Oja platform (Yoruba: _"market"_). The underlying platform — catalog, inventory ledger, AI demand engine, JIT procurement — is built product-agnostic so later phases can expand into the full Nigerian pantry, but the MVP exposes only garri. The long-term "Sysco of African food" ambition survives as platform architecture, not as MVP scope.

**Positioning:** _America's first premium Garri subscription._ GAARII does not compete to be the cheapest garri seller; it is the reliable monthly pantry-staple subscription.

### 1.1 Problem

Getting good garri in America is harder than it should be:

- **The hunt** — households drive store to store chasing a bag that may or may not be in stock, then over-buy "just in case," moving the waste home.
- **The markup** — online resellers charge steep markups for garri of unknown age and origin, and still run out.
- **The quality lottery** — no controlled specification: one bag is perfect drinking garri, the next is sour, gritty, or stale.
- **The chain is blind** — upstream, importers and processors ship on gut feel with zero downstream demand visibility, which is why availability and freshness are so erratic.

The root cause is a missing **demand-intelligence layer** — and the fastest way to prove one is with a single high-frequency staple, not a 150-SKU catalog.

### 1.2 Solution

A subscription-first, single-SKU-family product with three pillars:

1. **Committed demand** — subscribers choose a Garri plan (variety, grind, quantity tier, monthly cadence). Pause/skip/swap/cancel actions keep the signal honest and are captured as demand events.
2. **AI demand engine** — forecasts garri consumption per household and region weeks ahead, including seasonal/celebration spikes (Christmas, Ramadan, Nigerian Independence Day, wedding season).
3. **JIT procurement & fulfillment** — inventory from vetted Nigerian processors is pre-positioned to forecast, kept fresh (never warehouse-stale), and shipped monthly as parcels nationwide.

### 1.3 Goals (12 months post-MVP)

| Goal                      | Metric                                          | Target                      |
| ------------------------- | ----------------------------------------------- | --------------------------- |
| Prove subscription demand | Active paying subscribers                       | 1,500 households            |
| Retention                 | Month-3 subscriber retention                    | ≥ 75%                       |
| Reliability               | On-time delivery rate                           | ≥ 97%                       |
| Forecast quality          | WAPE on 4-week regional garri forecast          | < 20%                       |
| Freshness/waste           | Spoilage + write-off as % of COGS               | < 3% (shelf-stable product) |
| Unit economics            | Gross margin per shipped order (after shipping) | ≥ 30% floor, 34–40% target  |

### 1.4 Non-goals (MVP)

- **No products other than Premium Garri.** Egusi, beans, rice, yam flour (elubo), fufu, plantain flour, palm oil are Phase 2 — planned, not built.
- **No marketplace.** GAARII curates, owns, and sells one product; third parties list nothing.
- **No B2B/wholesale channel in the MVP.** Stores and restaurants join a wholesale waitlist; the channel opens in a later phase.
- **No one-off retail ordering.** Subscription only.
- No cooked/prepared food or meal kits.
- No international shipping (U.S. only for MVP; Canada later).
- No in-house farming; GAARII is the sourcing + intelligence + fulfillment layer.

---

## 2. Users & Personas

### P1 — Household Subscriber ("Amara", nurse, Atlanta suburbs) — **the MVP persona**

Cooks Nigerian food for a family of five, shops monthly at an African store 40 minutes away. Pain: distance, stockouts, price opacity, inconsistent quality. Needs: premium garri that just arrives monthly, flexible control (pause/skip/swap), fair all-in pricing.

### P2 — Single/Student ("Tunde", grad student, Houston)

Cooks for one, low volume, price-aware but convenience-driven. Needs: small plan (3–5 lb), easy skip when traveling.

### P3 — Bulk Household / Community Buyer ("Deacon Sam", DMV area)

Large family or shared household with high garri throughput; occasionally buys for church events. Needs: Stock-Up plan (20–25 lb), best per-lb value.

### P4 — Supplier ("Adebayo Exports", Lagos processor) — supply side

Ships garri to North America. Pain: no visibility into demand; payment delays. Needs: forward demand commitments, one clear quality spec, predictable payment.

### Deferred personas (Phase 2+)

- **Store owner / restaurant** — wholesale supply once the household loop is proven; collected on a wholesale waitlist during MVP.

### Internal personas

- **Ops/Warehouse associate** — receives, quality-checks, picks, packs.
- **Admin/Category manager** — manages the garri SKUs, pricing, supplier POs, forecast overrides.

---

## 3. Product Scope

### 3.1 MVP (Phase 1, ~90 days) — "Garri only, done properly"

One fulfillment node (3PL), **two sellable SKUs** — Premium White Garri (Ijebu) and Premium Yellow Garri (grind as an option) — nationwide U.S. parcel delivery, subscription only.

**F1. Product & Storefront**

- Single-product storefront: variety (White Ijebu / Yellow), grind (coarse/fine), plan size.
- SKU attributes retained from the platform schema: origin, unit size, perishability class, halal flag, compliance/labeling fields.
- Bilingual-friendly naming (e.g., "Garri (Gari, Cassava Grits)").

**F2. Subscription plans (the only way to buy)**

- **Starter** — 3–5 lb of Premium Garri / month ($24–$34, shipped) — singles/couples.
- **Family** — 10–15 lb / month or every 3 weeks ($49–$79, shipped) — hero plan.
- **Stock-Up** — 20–25 lb / monthly or bi-weekly ($89–$119, shipped) — bulk households.
- The only difference between plans is quantity. All-in pricing (product, packaging, shipping, payment fees, spoilage allowance, margin) per `PRICING_STRATEGY.md` / `MARGIN_AND_SHIPPING_MODEL.md`.
- Stripe billing; 10–15% first-delivery discount only (never permanent).

**F3. Pantry management (demand signal — the moat)**

- Cycle-confirm flow before each delivery: confirm / edit (variety, grind, size) / skip — 5 taps or less.
- Pause, skip, swap, cancel anytime; every action captured as a labeled demand event.

**F4. Demand Engine v0**

- Heuristic + statistical: moving averages per region blended with active-subscription commitments and manual adjustments.
- Output: 4-week rolling garri demand forecast per fulfillment node; reorder-point suggestions.
- All forecasts logged vs. actuals from day one to train v1 models.

**F5. Procurement & Inventory**

- Supplier records, purchase orders, expected-arrival tracking for the two garri SKUs.
- Inventory ledger: receive → QC → putaway → pick → ship; lot tracking with FEFO picking (freshness discipline even for a shelf-stable product).

**F6. Fulfillment**

- Pick/pack flows (mobile-friendly warehouse app), parcel-carrier shipping (nationwide), tracking + SMS/email notifications.

**F7. Admin Console**

- SKUs, plan pricing, subscribers, orders, inventory, forecasts (with override), supplier POs.

### 3.2 Phase 2 — Nigerian pantry staples (post-garri proof)

- Add staples one at a time, each with its own sourcing spec and quality bar: **egusi, beans, rice, yam flour (elubo), fufu, plantain flour, palm oil**.
- Multi-SKU subscription baskets; substitution preferences.
- **B2B wholesale channel opens** (stores/restaurants from the waitlist; standing orders, wholesale tiers).
- ML forecast v1 (hierarchical time-series with events calendar).
- Supplier portal: forecast sharing, forward commitments.

### 3.3 Phase 3 — AI-powered pantry management

- **Complete Nigerian pantry** assortment.
- **AI Pantry Assistant** — conversational management of the household's staple pantry.
- **Smart auto-replenishment** — quantities and cadence adjust themselves from observed consumption.
- **Family consumption forecasting** — per-household predictive modeling.
- **Recipe recommendations** tied to pantry contents.
- **Heritage gifting** — send a pantry subscription to family, students, new parents.

---

## 4. Functional Requirements (MVP detail)

| ID    | Requirement                                                                                                                        | Priority |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------- | -------- |
| FR-1  | Visitor can subscribe to a Garri plan (variety, grind, plan size, cadence) with Stripe billing                                     | P0       |
| FR-2  | Subscriber can pause, skip, swap variant/grind/size, or cancel anytime from their account                                          | P0       |
| FR-3  | Cycle-confirm flow runs before each delivery; confirm/edit/skip captured as demand events                                          | P0       |
| FR-4  | System generates 4-week regional garri forecast, refreshed nightly, from subscriptions + history                                   | P0       |
| FR-5  | Admin can create supplier POs from reorder suggestions and receive inventory against them                                          | P0       |
| FR-6  | Warehouse app supports receive/QC/pick/pack with lot tracking and FEFO enforcement                                                 | P0       |
| FR-7  | Orders ship via parcel carrier with tracking; subscribers get status notifications                                                 | P0       |
| FR-8  | Admin can override any forecast/reorder point with a reason code (overrides logged)                                                | P1       |
| FR-9  | First-delivery discount applies once; recurring price never silently discounted                                                    | P1       |
| FR-10 | Zone-economics guardrail at signup: expensive zones get surcharge/slower cadence/higher minimum per `MARGIN_AND_SHIPPING_MODEL.md` | P1       |
| FR-11 | Wholesale-interest waitlist form for stores/restaurants (no wholesale pricing exposed in MVP)                                      | P2       |
| FR-12 | Referral credit per successful referral, capped, funded from CAC budget                                                            | P2       |

---

## 5. Non-functional Requirements

- **Trust & food safety:** lot traceability end-to-end; recall query ("which orders contained lot X") in < 5 minutes; FDA labeling compliance fields on both SKUs.
- **Reliability:** 99.5% storefront uptime; subscription billing and order capture degrade gracefully (queue writes) if downstream services fail.
- **Performance:** storefront p95 < 1.5 s; forecast batch completes nightly within a 2-hour window.
- **Security & privacy:** PCI via Stripe (no raw card data), role-based access (customer / warehouse / admin), PII encrypted at rest.
- **Mobile-first:** subscription management and warehouse surfaces fully usable on a phone.
- **Data foundation:** every demand-relevant event (confirm, skip, swap, pause, cancel, delivery outcome) captured in an append-only event stream from day one.
- **Extensibility:** schema and services stay product-agnostic (SKU/catalog/plan abstractions) so Phase 2 staples are added by seeding data, not redesigning.

---

## 6. Key Metrics

- **North star:** active subscriptions delivered on time without stockout or staleness.
- Month-1/3/6 retention; cycle-confirm rate (target 85%+); pause/skip vs. cancel ratio; forecast WAPE; on-time delivery %; gross margin after shipping per order (≥ 30% floor); CAC payback in cycles; referral share of new subscribers.

---

## 7. Risks & Mitigations

| Risk                                          | Mitigation                                                                                                            |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Single-product concentration                  | Deliberate: focus is the strategy. Phase 2 staples are pre-planned; the platform is already multi-SKU capable         |
| Shipping cost erodes margin (heavy product)   | Margin-protection rules in `MARGIN_AND_SHIPPING_MODEL.md`: 30% GM floor, zone guardrails, Family as hero plan         |
| Supply variability (import delays, customs)   | Two vetted suppliers per variety; safety stock (shelf-stable product makes this cheap); one strict quality spec       |
| Subscription fatigue / churn                  | Pause/skip/swap friction kept near zero; win-back via cadence adjustment, not discounts                               |
| Trust — communities buy from people they know | Diaspora-community launch (churches, associations, WhatsApp), freshness/quality guarantee, transparent all-in pricing |
| Regulatory (FDA import, labeling)             | Licensed 3PL; compliance fields on both SKUs from day one                                                             |

---

## 8. Open Questions

1. Grind (coarse/fine) as SKU attribute vs. separate SKUs — decide before seed data grows.
2. 3PL location for parcel economics: central (Dallas/Memphis) vs. East Coast diaspora density?
3. Exact price points within the published ranges — pending final landed-cost + carrier quotes.
4. When does Phase 2 unlock? Proposed graduation criteria: 1,000+ active subscribers, ≥ 75% month-3 retention, GM ≥ 34% for two consecutive months.

---

_Companion docs: [GTM.md](./GTM.md) · [PRODUCT_STRATEGY.md](./PRODUCT_STRATEGY.md) · [PRICING_STRATEGY.md](./PRICING_STRATEGY.md) · [MARGIN_AND_SHIPPING_MODEL.md](./MARGIN_AND_SHIPPING_MODEL.md) · [IMPLEMENTATION_STRATEGY.md](./IMPLEMENTATION_STRATEGY.md) · [ARCHITECTURE.md](./ARCHITECTURE.md)_
