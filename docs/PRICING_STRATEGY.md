# Oja — Pricing Strategy

**Version:** 0.1 (Draft) · **Last updated:** 2026-07-09

---

## 1. Principles

1. **Transparent and fair, not cheapest.** The category's pain is unreliability and opaque markup, not absolute price. Oja prices visibly below online resellers, roughly at parity with good local stores, and earns margin through supply-chain efficiency rather than scarcity markup.
2. **Reward committed demand.** The customer behaviors that power the forecast (subscriptions, standing orders, pre-orders) always get the best economics. Pricing _is_ the incentive design for the data flywheel.
3. **Margin is made in the chain, not at checkout.** JIT + forecast accuracy reduce spoilage and working capital; that's the structural margin source that lets shelf prices stay fair.
4. **Perishability-aware.** Fresh/frozen carry different margin structures and markdown ladders than shelf-stable staples.

## 2. Cost Structure (per-order view, MVP metro)

Landed cost (FOB + freight + customs + inbound) → warehouse cost (receive/QC/pick/pack, est. 6–9% of GMV at MVP volume) → last-mile (batch-routed; target $6–9/B2C drop, $12–18/B2B pallet-drop) → payment/platform (~3%) → spoilage reserve (perishables 4–10% by class, shelf-stable <1%).

Target blended gross margin: **22–28% B2C, 14–18% B2B** at MVP; +4–6 pts by month 12 via forecast-driven buying and route density.

## 3. B2C Pricing

### Oja Market (one-off)

- Retail price = landed cost × class multiplier (shelf-stable ~1.45×, frozen ~1.55×, fresh ~1.65×), sanity-checked weekly against a basket of local-store and online-reseller prices (target: 10–20% under resellers, ±5% of local stores).
- Delivery fee $5.99; free over $75. Delivery-window pricing: cheaper on high-density route days (nudges customers into batchable windows — pricing supports JIT).

### Oja Pantry (subscription) — flagship

- No membership fee at MVP (remove friction; the _data_ is the payment). Member pricing 5–8% below Market on subscribed SKUs.
- Free delivery over $50; priority windows; freshness guarantee (refund without return).
- Evaluate a paid membership ($9.99/mo with deeper perks) only after cycle-confirm retention > 80%.

### Oja Together (group orders)

- Tiered discount by aggregated order value: 5% at $300, 10% at $750, 15% at $1,500 — mirrors the wholesale ladder so groups feel wholesale-adjacent.
- Single delivery point; optional coordinator credit (2%) instead of cash commission.

## 4. B2B Pricing

### Oja Wholesale (free tier)

- Wholesale price ≈ landed cost × 1.18–1.25 depending on SKU velocity class. MOV $250/delivery. Payment on delivery (card/ACH).

### Oja Wholesale+ ($79/mo per location)

- Standing-order templates + sell-through analytics + net-15 terms (net-30 after 12 clean weeks) + stockout-protection SLA on up to 20 contracted SKUs (if Oja shorts a contracted SKU, 2× the shortfall value in credit).
- Volume rebate: 1.5% quarterly rebate above $12k/quarter — paid as credit, reinforcing consolidation onto Oja.
- The subscription fee is deliberately modest: its job is commitment and data, not revenue.

## 5. Dynamic & Markdown Pricing (Phase 2+)

- **Expiry-risk markdowns:** automated ladder for perishables as lots approach expiry (e.g., −15% at 40% shelf-life remaining, −30% at 20%), surfaced as "Fresh Deals" — converts potential spoilage into sales and price-sensitive acquisition.
- **Pre-order pricing:** seasonal-event pre-orders (Ramadan, Christmas) priced 5% below in-season — pulls demand forward where forecasting is hardest.
- **Surge honesty:** during supply shocks (import delays), show "supply constrained" messaging with modest increases and substitution suggestions rather than silent 2× markup — protecting the fairness brand.

## 6. Supplier-Side Economics

- Standard terms: net-30 on receipt-and-QC; **fast-pay option** (net-7 at 1.5% discount) — cheaper than factoring for suppliers, margin accretive for Oja.
- Phase 3+: financing against Oja forward-demand commitments (fee-based), priority-allocation program.

## 7. Guardrails & Governance

- Weekly competitive price index on top-40 SKUs; auto-flag any SKU drifting > 10% above local-store benchmark.
- No SKU sold below fully-landed cost except explicit markdown-ladder or promo with expiry date.
- Price changes on staples capped at ±7%/week to preserve trust; category-manager approval above that.
- Every promo tagged with intent (acquisition / cycle-save / spoilage-avoid / density-building) so promo ROI is measurable against the demand engine's counterfactual forecast.

## 8. Open Questions

1. Pantry membership fee: test in metro 2 or wait for retention proof?
2. B2B rebate vs. straight lower price — which drives consolidation better for this buyer psychology?
3. Delivery-fee structure in low-density suburbs: subsidize for growth or gate behind group orders?
