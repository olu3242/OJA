# Oja — Go-to-Market Strategy

**Version:** 0.1 (Draft) · **Last updated:** 2026-07-09

---

## 1. Market

- ~4.6M sub-Saharan African immigrants in the US (plus second generation and Caribbean/Black-American crossover demand), heavily clustered in a handful of metros: Houston/DFW, Atlanta, DC-Maryland-Virginia (DMV), NYC/NJ, Minneapolis, Chicago, Toronto, Montreal.
- The category is served today by: (a) ~3,000+ independent African/Caribbean grocery stores, (b) a fragmented importer/wholesaler layer, (c) high-markup online resellers with unreliable stock.
- Estimated addressable spend: African diaspora households spend disproportionately on groceries tied to home cuisine; even a conservative $150/month of "African-specific" basket per household across ~1.5M actively-cooking households implies a **$2.7B+/yr** retail category in North America, before B2B restaurant/catering volume.

**Wedge:** nobody owns the demand data. Sysco won restaurant supply with logistics scale; Oja's wedge is _demand intelligence first, logistics second_ — start where forecast advantage matters most (staples with steady consumption) and expand outward.

## 2. Positioning

- **For B2B (stores, restaurants):** "Never stock out of your top sellers again. One supplier, one weekly delivery, wholesale prices, and data on what your customers actually buy."
- **For B2C (households):** "Your African pantry, always full. Authentic staples, fair prices, delivered on your schedule."
- **Against incumbents:** not another importer, and not a marketplace reseller — Oja is the operating system for the category. Stores are customers and partners, not roadkill.

Brand: _Oja_ = market. Tone: proudly African, modern, trustworthy, abundant. The anti-"ethnic aisle."

## 3. Beachhead & Sequencing

**Metro 1 (MVP, days 0–90): Houston** (alternative: Atlanta — decide via supplier-side diligence).
Rationale: largest Nigerian population in the US, dense store/restaurant clusters (Bissonnet/Harwin corridor), port city (import logistics), favorable warehouse costs.

Sequence inside the metro:

1. **10 anchor B2B accounts** (stores + restaurants) signed before the warehouse opens — standing weekly orders provide baseline volume that de-risks JIT.
2. **Community-institution launch for B2C**: churches, mosques, Nigerian/Ghanaian/Ethiopian associations, African student unions. Group-buy events → pantry-profile signups.
3. **Digital fill-in**: geo-targeted Instagram/TikTok/WhatsApp content (recipes, "restock day" drops), diaspora food creators, Google Search for high-intent terms ("buy garri Houston").

**Metro 2 (months 6–9): Atlanta.** **Metro 3 (months 10–15): DMV.** **Canada (months 12–18): Toronto.** Expansion trigger: Metro N-1 hits ≥ 60% forecast-covered demand and positive contribution margin.

## 4. Acquisition Playbooks

### B2B (direct sales, founder-led at first)

- Hit list of every African grocery + restaurant in metro (map scrape + community knowledge). In-person visits; offer: free stockout audit → 2 free weeks of top-5 staple replenishment → standing order.
- Kill the spreadsheet/WhatsApp order: onboarding = we build their order template for them in one visit.
- Referral: $250 credit per referred B2B account that completes 4 weekly orders.

### B2C (community-led growth)

- **Church/association partnerships:** revenue share or fundraising tie-in ("your congregation's orders fund the building project"), on-site group-order Sundays.
- **Aunty ambassadors:** respected community cooks get codes + commission; WhatsApp broadcast lists are the channel that actually converts in this demographic.
- **Content:** short-form recipe + price-transparency content ("what stockfish should cost"); SEO pages per dish/ingredient.
- **Launch offer:** first delivery 10–15% off (first delivery only — never a permanent discount on the recurring price, per `MARGIN_AND_SHIPPING_MODEL.md`) + freshness guarantee (full refund, no return needed).

### Suppliers

- Court 2–3 importers per top-20 SKU with the pitch: _forward demand visibility + faster payment_ in exchange for priority allocation and quality specs. Suppliers are recruited before customers see an empty shelf, never after.

## 5. Retention & Expansion Loops

- Pantry cycle confirm flow (5-taps-or-less) is the core retention surface; skipped cycles trigger win-back with substitution suggestions, not generic discounts.
- B2B QBR-lite: monthly one-pager per store — "your top movers, your stockouts avoided, what to add." Data becomes the lock-in.
- Group orders convert participants → individual subscribers (each group order captures N new addresses + baskets).
- Seasonal moments (Ramadan, Easter, Christmas, Independence Days, wedding season) get dedicated catalogs and pre-order campaigns — these are also the demand engine's hardest tests, so pre-orders double as forecast insurance.

## 6. Budget & Targets (first 12 months, directional)

| Channel                         | Budget share | Primary KPI                  |
| ------------------------------- | ------------ | ---------------------------- |
| Founder-led B2B sales           | 25%          | 60 active B2B accounts       |
| Community partnerships & events | 25%          | 800 subscribers sourced      |
| Ambassadors/referrals           | 15%          | 25% of new B2C via referral  |
| Paid social + search            | 20%          | CAC < $35 B2C blended        |
| Content/SEO/brand               | 15%          | 30% organic share of signups |

Guardrails: B2C CAC payback < 3 pantry cycles; B2B CAC payback < 6 weekly orders.

## 7. Risks

- **Channel conflict:** stores fearing disintermediation → lead B2B-first publicly; B2C delivery zones initially complement (suburbs) rather than cannibalize store trade areas; offer stores pickup-point economics.
- **Trust:** cash-and-relationship category → in-person presence, community anchors, freshness guarantee, WhatsApp-native support.
- **Price perception:** undercutting resellers while staying above race-to-bottom; publish transparent pricing (see PRICING_STRATEGY.md).
