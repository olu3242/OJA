# GAARII — Product Strategy

**Version:** 0.2 (Draft — single-product subscription MVP) · **Last updated:** 2026-07-09

> **Explicit product decision:** the MVP sells **one product only — Premium Nigerian Garri** (White/Ijebu and Yellow). Everything else (egusi, beans, rice, yam flour, fufu, plantain flour, palm oil, …) is planned for later phases. This keeps operations, sourcing, inventory, quality control, branding, and forecasting radically simpler. GAARII is a single-product subscription company, not a grocery marketplace.

---

## 1. Strategic Thesis

The African food category in North America is supply-constrained not because food is scarce, but because **demand is illegible**. Whoever makes demand legible controls the category: they buy better, ship leaner, waste less, and price fairer than anyone guessing.

The fastest way to make demand legible is not a 150-SKU catalog — it's **one high-frequency staple sold only by subscription**, where every customer is committed, recurring, and measurable. So GAARII's strategy is deliberately ordered:

1. **Own committed demand for one product** (garri subscriptions with pantry management) —
2. **so sourcing, QC, and JIT fulfillment can be genuinely excellent** (one spec, one supply chain, fresh stock) —
3. **so unit economics hold** (30% GM floor after shipping; margin-protected plans) —
4. **so the proven engine expands product by product** into the full Nigerian pantry — each new staple inheriting the subscriber base, forecast machinery, and trust already built.

The subscription is the visible product; the household demand graph is the company.

## 2. The Moat (in order of durability)

| Moat                                                  | Why it compounds                                                                                                                          |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Committed demand (100% subscription revenue)          | Every subscriber is contractual, recurring demand — forecast is a schedule, not a guess; structurally impossible for spot sellers to copy |
| Household consumption graph (variety × size × season) | Every confirm, skip, swap, and pause labels the dataset; nobody has per-household garri consumption data at any scale                     |
| One-product quality bar                               | A single sourcing spec + batch QC makes "premium" defensible; multi-category rivals can't match focus                                     |
| Supplier allocation                                   | Forward visibility on one product earns priority allocation and spec compliance from the best Nigerian processors                         |
| Community trust & brand                               | "The garri company" is a memorable, ownable identity; diaspora distribution is relationship-gated — slow to build, slow to lose           |

## 3. Product Tiers

### MVP (Phase 1) — GAARII subscription, the only product

- **Subscription only. One product: Premium Garri.** White (Ijebu) or Yellow, coarse or fine grind. Monthly deliveries, nationwide U.S., pantry management built in (pause/skip/swap/cancel anytime).
- Margin-protected monthly plans, all-in (shipping, packaging, supplier cost, payment fees, spoilage/loss allowance, and margin included) — the only difference between plans is quantity:
  - **Starter** — $24–$34/mo · 3–5 lb of Premium Garri · best for singles/couples
  - **Family** — $49–$79/mo · 10–15 lb of Premium Garri · best for families (hero plan)
  - **Stock-Up** — $89–$119/mo · 20–25 lb of Premium Garri · best for bulk households
- See `PRICING_STRATEGY.md` and `MARGIN_AND_SHIPPING_MODEL.md`. Positioning: **not the cheapest garri seller — the reliable monthly pantry-staple subscription.**

### Deferred tiers (post-MVP)

- **One-off retail ordering** — not in MVP; subscription only.
- **B2B wholesale (stores/restaurants)** — waitlist during MVP; channel opens once the household loop is proven.
- **Group/community buying** — Phase 2+, built on the same plan machinery.
- **Supplier portal** — Phase 2+: shared forecasts, forward commitments, faster payment rails.

## 4. Roadmap Arc

**Phase 1 — MVP: Garri only.**
✅ One product: Premium Garri · White Garri (Ijebu) · Yellow Garri · subscription only · nationwide U.S. delivery · monthly deliveries · pantry management · pause/skip/cancel anytime.
Success = 1,500 active subscribers, ≥ 75% month-3 retention, ≥ 30% GM after shipping, on-time delivery ≥ 97%.

**Phase 2 — Nigerian pantry staples.**
Egusi · beans · rice · yam flour (elubo) · fufu · plantain flour · palm oil — added one at a time, each with its own sourcing spec and quality bar, on the same subscription machinery. B2B wholesale channel opens from the waitlist. ML forecast v1.
Success = each new staple reaches attach-rate and margin targets without degrading garri reliability.

**Phase 3 — AI-powered pantry management.**
Complete Nigerian pantry · **AI Pantry Assistant** · **smart auto-replenishment** · **family consumption forecasting** · **recipe recommendations** · **heritage gifting**.
Success = majority of subscriber baskets managed automatically; GAARII is the default Nigerian pantry layer for diaspora households.

## 5. Product Principles

1. **One product, done properly.** Any feature or SKU that dilutes garri quality, reliability, or focus is deferred — no matter how obvious the revenue looks.
2. **Signal over sale.** Features that increase legible, committed demand outrank features that only add one-off GMV.
3. **Confirm, don't surprise.** Recurring commerce must be reviewable (cycle-confirm) with frictionless pause/skip/cancel, or trust dies with the first unwanted box.
4. **Margin floor is law.** No shipped plan below 30% GM after shipping — pricing, zones, and promos all bend to this (see `MARGIN_AND_SHIPPING_MODEL.md`).
5. **Extensible platform, disciplined surface.** The schema and services stay product-agnostic; the storefront exposes exactly one product until Phase 2 graduation criteria are met.
6. **WhatsApp-real.** Meet subscribers in the channels they actually use; the web app is the system of record, not the only interface.
7. **Instrument everything from day one.** The demand engine's ceiling is set by what we log in month one.

## 6. Competitive Landscape

- **Online resellers / Amazon sellers:** high markups, unknown freshness, no subscription reliability. GAARII wins on quality control + never-run-out reliability, not price per pound.
- **African grocery stores:** valued community institutions but stock unpredictably; GAARII is a complement in the MVP (and a wholesale customer base in Phase 2), not a competitor storefront.
- **Mainstream grocery delivery (Instacart et al.):** thin, inconsistent African assortment; no sourcing control. Coexists.
- **Real risk:** a copycat garri subscription. Defense: supplier allocation + quality spec + community brand + the consumption dataset, compounded fast.

## 7. Strategic Bets & Kill Criteria

| Bet                                                          | Kill/pivot signal                                                                                         |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| Households will subscribe to a single-staple delivery        | < 500 active subscribers or month-3 retention < 60% after 2 quarters of community-led GTM                 |
| Shipped garri can clear a 30% GM floor at these price points | Blended GM < 30% for 2 consecutive months after zone guardrails are active → reprice or restructure plans |
| Focus beats assortment (single product > marketplace)        | Churn surveys consistently cite "wanted more products" AND Phase 1 targets met early → accelerate Phase 2 |
| Community-institution channel beats paid acquisition         | Blended community CAC exceeds paid CAC for 2 consecutive quarters                                         |
