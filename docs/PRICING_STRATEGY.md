# Oja — Pricing Strategy

> **MVP scope:** every price point in this document refers to Garri exclusively. Multi-SKU pricing logic is designed to generalize (see tier structure) but should not be built or marketed until a second SKU is approved per the PRD's SKU-graduation criteria.

## 1. Pricing Philosophy

Oja prices to reward predictability. The more lead time and consistency a customer gives the AI demand engine (a stable Pantry Profile, a standing PO, advance notice on bulk events), the better price they receive — because predictability is exactly what makes the JIT model economically efficient. This is not just a pricing gimmick; it directly reinforces the product's core mechanic.

## 2. Cost Structure Inputs

Unit pricing across all tiers is built up from:

- **Landed cost of goods** — farm/processor price + export handling + ocean freight + import duties/customs
- **Warehousing** — regional cross-dock storage, cold/dry storage fees
- **Packaging** — bags, boxes, insulation for perishable-adjacent SKUs
- **Last-mile fulfillment** — route-based delivery cost per stop, or carrier/parcel cost for household
- **Payment processing fees**
- **Returns/spoilage allowance**
- **Marketing (CAC amortization)**
- **Target gross margin and contribution to EBITDA**

## 3. B2C Household Pricing (Subscription) — Garri Only

| Tier                     | Est. Garri Weight/Delivery | Frequency                | Illustrative Price Range* | Target Gross Margin |
| ------------------------ | -------------------------- | ------------------------ | ------------------------- | ------------------- |
| Starter (Single/Student) | 3–5 lb                     | Monthly                  | $24–$34 shipped           | 32–38%              |
| Family                   | 10–15 lb                   | Monthly or every 3 weeks | $49–$79 shipped           | 34–40%              |
| Stock-Up / Large Family  | 20–25 lb                   | Monthly or bi-weekly     | $89–$119 shipped          | 36–42%              |

_Updated margin-protected ranges. These prices assume shipping is included for the lower 48 states and that Oja uses commercial parcel rates, route density, or local drop delivery where available. Final launch pricing must still be validated against actual landed Garri cost, packaging, payment fees, and zone-based carrier quotes._

**Why the old pricing changed:** the prior $10–$18 Starter and $22–$45 Family ranges underpriced the shipped subscription. Online U.S. garri benchmarks commonly show about $12.99 for 5 lb, $25.99 for 10 lb, and $49.99 for 20 lb before/around shipping. Current USPS Ground Advantage starts at $7.90 retail and commercial marketplace tables show about $9.70 for 5 lb and $13.33 for 10 lb in low zones, while UPS/FedEx residential routes can be materially higher. A subscription price must therefore include a shipping buffer, payment fee buffer, packaging, shrink/spoilage allowance, CAC payback, and margin.

**Pricing formula:**

```text
Subscription price =
  landed product cost
+ packaging and label cost
+ carrier or local route cost
+ payment processing
+ shrink / replacement allowance
+ CAC amortization
+ target contribution margin
```

**Margin rule:** do not sell any shipped household plan below a 30% gross-margin floor after shipping. If zone-based shipping pushes margin below the floor, either add a shipping surcharge, reduce package weight, move the household to a local delivery route, or require a higher-volume Stock-Up plan.

**Mechanics:**

- First-delivery discount (10–15% off) to reduce activation friction.
- Skip/pause/swap available anytime — flexibility protects retention without discounting the core price.
- Referral credit (e.g., $10–15 credit per successful referral, capped) funds household-side growth loop.
- Household margin improves over time as route density in a metro increases (delivery cost per stop falls) — savings can be selectively passed back as loyalty pricing.

## 4. B2B Pricing — Retail Stores & Restaurants

**Model:** Wholesale tiering by monthly volume commitment, structured as a standing PO with a base cadence (weekly recommended).

| Volume Tier                           | Illustrative Monthly Spend Band | Discount off list wholesale | Notes                                        |
| ------------------------------------- | ------------------------------- | --------------------------- | -------------------------------------------- |
| Tier 1 (New/Small store)              | Entry-level                     | Base wholesale price        | Includes free "stockout audit" at onboarding |
| Tier 2 (Established store)            | Mid-volume                      | 5–8% off base               | Priority routing slot                        |
| Tier 3 (Multi-location / high-volume) | High-volume                     | 10–15% off base             | Dedicated account manager, custom SLA        |

**Restaurant pricing** mirrors Tier 1–2 structure but priced at case-level foodservice units rather than retail-pack units, with a reliability SLA (e.g., committed delivery window) as part of the offer — restaurants are paying as much for certainty as for price.

## 5. Community / Bulk / Event Pricing

Lead-time-based discount ladder — the earlier an organization commits, the better the price, because it gives the AI engine and procurement team room to source efficiently:

| Lead Time Given | Discount                                                     |
| --------------- | ------------------------------------------------------------ |
| 30+ days        | Best price tier                                              |
| 14–29 days      | Mid price tier                                               |
| <14 days        | Standard/rush pricing (no discount, subject to availability) |

## 6. Wholesale / Enterprise Contracts

Custom-negotiated pricing for multi-location chains and institutional buyers, typically structured as:

- Annual or multi-quarter volume commitment
- Quarterly price review tied to landed cost movement (currency, freight)
- Dedicated forecasting support (Oja's demand model applied specifically to the account's location footprint)

## 7. Gift & Holiday Boxes (v2 seasonal line)

Premium, higher-margin one-time purchase product (not subscription) timed to Christmas, Easter, Eid, and back-to-school — captures seasonal demand spikes and functions as a top-of-funnel acquisition product for the core subscription.

## 8. Unit Economics Guardrails (to formalize in Financial Model)

- **CAC targets:** community/referral-driven household CAC held well below first-year subscription contribution margin; direct-sales B2B CAC amortized against multi-year account LTV given lower store/restaurant churn once integrated.
- **LTV\:CAC target:** ≥ 3:1 across blended household base by month 12.
- **Target blended gross margin:** trending from high-20s% at launch (higher fulfillment cost per stop, low density) toward high-30s%+ as route density and supplier terms improve.
- **Price reviews:** quarterly, tied to landed cost and freight movement — pricing is a living system, not a set-and-forget table.

## 9. Pricing Risks & Guardrails

- Avoid racing to the bottom against Costco/Sam's Club on raw unit price — Oja's value proposition is _availability + convenience + category depth_, not lowest price per pound.
- Protect restaurant/store SLA pricing from erosion — reliability is the premium being sold, not just goods.
- Monitor currency exposure on imported SKUs and build a pricing buffer rather than passing every FX swing directly to customers.
