# Oja — Product Requirements Document (PRD)

**Version:** 0.1 (Draft)
**Owner:** Zenith AI Automation Agency
**Last updated:** 2026-07-09

---

## 1. Overview

Oja (Yoruba: *"market"*) is an AI-powered, just-in-time (JIT) supply chain platform for authentic African raw foods in North America — "the Sysco of African food." It connects farms, processors, and importers to grocery stores, restaurants, churches, and households, using demand forecasting to move the right SKUs, in the right quantities, at the right time.

### 1.1 Problem

African food distribution in North America runs on guesswork:

- **Stores** over-order slow movers and stock out of staples (garri, egusi, palm oil, stockfish) in the same week, because ordering is based on memory and gut feel.
- **Importers** ship blind — container decisions are made months ahead with no downstream demand signal, so gluts and shortages alternate.
- **Restaurants and caterers** have no reliable wholesale channel; they buy retail at retail prices when their supplier runs dry.
- **Households** drive across town chasing fresh cassava or plantain that may or may not be in stock, or pay 2–3× markup on marketplace resellers.
- **Spoilage** is severe: perishables (fresh produce, frozen fish, fresh peppers) rot in transit or on shelves because inventory isn't matched to consumption.

The root cause is a missing **demand-intelligence layer**. Everyone in the chain is guessing.

### 1.2 Solution

Oja is a B2B2C platform with three pillars:

1. **Demand signal capture** — customers log recurring consumption ("pantry profiles") rather than only placing one-off orders. Stores share sell-through; households set replenishment cadences.
2. **AI demand engine** — forecasts SKU-level demand by region and by account weeks ahead, factoring seasonality (Ramadan, Christmas, Nigerian Independence Day, wedding season), community events, and price elasticity.
3. **JIT logistics network** — pre-positions inventory at regional micro-warehouses (cross-docks) sized to forecast, then routes last-mile delivery to stores, restaurants, and homes on a predictable cadence.

### 1.3 Goals (12 months post-MVP)

| Goal | Metric | Target |
|---|---|---|
| Prove demand-signal model | Accounts with active pantry profile | 2,000 households, 60 stores/restaurants |
| Reduce stockouts for B2B accounts | Stockout rate on top-20 SKUs | < 5% (baseline est. 25–40%) |
| Reduce waste | Spoilage as % of perishable GMV | < 8% |
| Forecast quality | WAPE on 4-week SKU-region forecast | < 25% |
| Unit economics | Contribution margin per order | Positive by month 9 |

### 1.4 Non-goals (v1)

- No cooked/prepared food or meal kits.
- No international consumer shipping (US + Canada only).
- No open marketplace where third parties list arbitrary products — Oja curates and owns the catalog.
- No in-house farming; Oja is the distribution + intelligence layer.

---

## 2. Users & Personas

### P1 — Store Owner ("Mama Ngozi", African grocery, Houston)
Runs a 2,500 sq ft store. Orders weekly from 3–4 importers by phone/WhatsApp. Pain: stockouts of staples, dead stock of misjudged items, no data. Needs: reliable weekly replenishment, wholesale pricing, sell-through insights.

### P2 — Restaurant / Caterer ("Kwame", Ghanaian restaurant, Toronto)
Needs consistent quality and quantity of raw inputs (goat, fufu flours, palm oil, peppers). Pain: supplier inconsistency forces retail-price emergency buys. Needs: standing orders, quality grading, invoicing/net terms.

### P3 — Household Subscriber ("Amara", nurse, Atlanta suburbs)
Cooks Nigerian food for a family of five, shops monthly at an African store 40 minutes away. Pain: distance, stockouts, price opacity. Needs: pantry subscription with flexible cadence, freshness guarantee, fair prices.

### P4 — Community Buyer ("Deacon Sam", church in DMV area)
Buys in bulk for events and a community co-op buying club. Needs: group orders, bulk pricing, scheduled delivery windows.

### P5 — Supplier ("Adebayo Exports", Lagos processor)
Ships garri, fufu flours, dried fish. Pain: no visibility into North American demand; payment delays. Needs: forward demand commitments, clear specs, predictable payment.

### Internal personas
- **Ops/Warehouse associate** — receives, quality-checks, picks, packs at micro-warehouse.
- **Admin/Category manager** — manages catalog, pricing, supplier POs, forecast overrides.

---

## 3. Product Scope

### 3.1 MVP (Phase 1, ~90 days) — "Single-city pilot"

One metro (recommended: Houston or Atlanta), one micro-warehouse (3PL or leased cross-dock), ~150-SKU curated catalog.

**F1. Catalog & Storefront**
- Curated SKU catalog with African-food-specific taxonomy (grains & flours, tubers, oils, dried fish & proteins, spices & seasonings, fresh produce, frozen).
- SKU attributes: origin country, brand, unit size, wholesale/retail price, perishability class, halal flag, substitutions.
- Search + browse; bilingual-friendly naming (English + common local names, e.g. "Egusi (melon seed)").

**F2. Ordering**
- B2C: cart checkout (Stripe), delivery-window selection.
- B2B: wholesale price tier, minimum order value, PO reference, net-15 terms (manual approval in MVP).
- Group/community orders: shareable order links that aggregate into one delivery (Phase 2 if time-constrained).

**F3. Pantry Profiles (demand signal — the moat)**
- Household: select staples + consumption cadence ("5 kg garri / month"); generates a proposed recurring basket the user confirms/edits before each cycle (subscribe-with-review, not blind auto-ship).
- Store/restaurant: standing weekly order template + optional sell-through entry (manual in MVP; POS integration later).
- Every skip/edit/add is captured as a labeled demand signal.

**F4. Demand Engine v0**
- MVP is heuristic + statistical, not deep ML: moving averages per SKU-region blended with pantry-profile commitments and manual category-manager adjustments.
- Output: 4-week rolling SKU-level demand forecast per warehouse; reorder-point suggestions for procurement.
- All forecasts logged vs. actuals from day one to train v1 models.

**F5. Procurement & Inventory**
- Supplier records, purchase orders, expected-arrival tracking.
- Inventory ledger: receive → QC → putaway → pick → ship; lot/expiry tracking for perishables; FEFO (first-expired-first-out) picking.

**F6. Fulfillment**
- Pick lists and packing flows (mobile-friendly web app for warehouse).
- Delivery: route batching by zone + delivery day; third-party last-mile (e.g., local courier / Onfleet-style routing) in MVP.
- Order tracking + SMS/email notifications.

**F7. Admin Console**
- Catalog, pricing, customers, orders, inventory, forecasts (with override), supplier POs.

### 3.2 Phase 2 (months 4–9)
- ML forecast v1 (gradient-boosted / hierarchical time-series with seasonality + events calendar).
- POS/sell-through integrations for stores (Square, Clover).
- Second metro + inter-warehouse rebalancing.
- Group buying, referral loops, church/association partnerships productized.
- Supplier portal: forecast sharing, forward commitments.

### 3.3 Phase 3 (months 10–18)
- Import-level planning: container consolidation recommendations from aggregate forecast.
- Dynamic pricing & markdown automation for expiry risk.
- Cold-chain expansion; broader fresh/frozen assortment.
- Canada launch (Toronto) with customs/compliance workflow.

---

## 4. Functional Requirements (MVP detail)

| ID | Requirement | Priority |
|---|---|---|
| FR-1 | Customer can create account as Household, Store, Restaurant, or Community buyer; B2B requires business verification before wholesale pricing unlocks | P0 |
| FR-2 | Customer can browse/search catalog with local-name synonyms | P0 |
| FR-3 | Customer can place one-off order with Stripe payment; B2B can request net terms | P0 |
| FR-4 | Customer can create a pantry profile and receive a pre-filled recurring basket for confirmation each cycle | P0 |
| FR-5 | System generates 4-week SKU-region forecast, refreshed nightly | P0 |
| FR-6 | Admin can create supplier POs from reorder suggestions and receive inventory against them | P0 |
| FR-7 | Warehouse app supports receive/QC/pick/pack with lot + expiry and FEFO enforcement | P0 |
| FR-8 | Orders are batched into delivery routes by zone and window; customers get status notifications | P0 |
| FR-9 | Admin can override any forecast/reorder point with a reason code (overrides logged for model training) | P1 |
| FR-10 | Store accounts can log weekly sell-through per SKU in < 3 minutes | P1 |
| FR-11 | Substitution flow: if a SKU is short, customer's pre-approved substitutes apply automatically | P1 |
| FR-12 | Group order links aggregate multiple payers into one fulfillment | P2 |

---

## 5. Non-functional Requirements

- **Trust & food safety:** lot traceability end-to-end; recall query ("which orders contained lot X") in < 5 minutes; FDA/CFIA labeling compliance fields on every SKU.
- **Reliability:** 99.5% storefront uptime; order capture must degrade gracefully (queue writes) if downstream services fail.
- **Performance:** storefront p95 < 1.5 s; forecast batch completes nightly within a 2-hour window.
- **Security & privacy:** PCI via Stripe (no raw card data), role-based access (customer / warehouse / admin), PII encrypted at rest.
- **Mobile-first:** all customer and warehouse surfaces usable on a phone; warehouse flows operable with one hand / gloves (large tap targets, barcode scan via camera).
- **Data foundation:** every demand-relevant event (order, skip, edit, substitution, stockout view) captured in an analytics event stream from day one.

---

## 6. Key Metrics

- **North star:** weekly fulfilled demand (kg + GMV) served without stockout or spoilage.
- Forecast WAPE (SKU-region, 4-week horizon); % of demand covered by pantry profiles / standing orders (target 60%+ — this is what makes JIT work); stockout rate on top-20 SKUs; spoilage %; subscriber cycle retention (target 85%+ confirm rate); B2B account 4-week reorder rate; contribution margin per order.

---

## 7. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Cold-start: no history to forecast from | Pantry profiles + standing orders are *committed* demand, not predicted; start catalog with shelf-stable staples (garri, flours, oils, dried fish) where mistakes are cheap |
| Supply variability (import delays, customs) | Multi-supplier per top SKU; safety stock policies by perishability class; substitution flows |
| Thin margins on staple goods | JIT reduces carrying + spoilage cost; blend margin with premium/fresh SKUs; B2B volume anchors |
| Trust — communities buy from people they know | Launch through churches, associations, and existing store partnerships (stores as customers *and* pickup points), not against them |
| Regulatory (FDA import, state food handling) | Licensed 3PL/commissary for MVP; compliance fields in catalog schema from day one |

---

## 8. Open Questions

1. Launch metro: Houston vs. Atlanta vs. DMV (largest African diaspora density vs. logistics cost)?
2. MVP last-mile: own vans vs. courier marketplace?
3. Net-terms underwriting for B2B — manual only, or partner (e.g., B2B BNPL) at MVP?
4. Do stores get a white-label storefront (stores as micro-fulfillment partners) in Phase 2 or 3?

---

*Companion docs: [GTM.md](./GTM.md) · [PRODUCT_STRATEGY.md](./PRODUCT_STRATEGY.md) · [PRICING_STRATEGY.md](./PRICING_STRATEGY.md) · [IMPLEMENTATION_STRATEGY.md](./IMPLEMENTATION_STRATEGY.md) · [ARCHITECTURE.md](./ARCHITECTURE.md)*
