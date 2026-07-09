# Oja — The Sysco of African Food

**AI-powered, just-in-time supply chain for authentic African raw foods.**

Oja (Yoruba: _"market"_) is a B2B2C food-distribution platform that connects African farms, processors, and importers directly to grocery stores, restaurants, churches, and households across the United States and Canada — using AI demand forecasting to ship the right food, in the right quantity, at the right time. No more stockouts. No more waste. No more guessing.

---

## Why Oja

African food distribution in North America today runs on guesswork: independent stores over-order and under-order the same week, importers ship blind, and families drive across town chasing fresh cassava, plantain, or crayfish that may or may not be in stock. Oja replaces that guesswork with a demand-intelligence layer sitting on top of a just-in-time (JIT) logistics network — the same principle Sysco applies to restaurant supply, applied to the African food ecosystem.

## What's in this package

| File / Folder                     | Contents                                                                                                                                                                   |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/PRD.md`                     | Full Product Requirements Document                                                                                                                                         |
| `docs/GTM.md`                     | Go-to-Market strategy                                                                                                                                                      |
| `docs/PRODUCT_STRATEGY.md`        | Product strategy, tiers, roadmap                                                                                                                                           |
| `docs/PRICING_STRATEGY.md`        | Pricing model across B2B and B2C                                                                                                                                           |
| `docs/IMPLEMENTATION_STRATEGY.md` | 90-day MVP + phased rollout plan                                                                                                                                           |
| `docs/ARCHITECTURE.md`            | System, data, and supply chain architecture diagrams                                                                                                                       |
| `landing-page/index.html`         | Standalone marketing landing page (nav, hero, FAQ, footer)                                                                                                                 |
| `package.json`                    | Project manifest for the landing page / future app shell                                                                                                                   |
| `claude-fable-5/`                 | Execution package for building the real product with Claude Fable 5 — `CLAUDE.md` (agent brief), `EXECUTION_PLAN.md` (phased build tasks), `PROGRESS_LOG.md` (running log) |

## Building with Claude Fable 5

The `claude-fable-5/` folder is the handoff point for actually building Oja (beyond this strategy + landing page package). Point Claude Code (running the `claude-fable-5` model) at this repo and have it start with `claude-fable-5/CLAUDE.md`, which in turn walks it through `claude-fable-5/EXECUTION_PLAN.md` phase by phase.

## Quick start (landing page)

```bash
cd landing-page
# open directly in a browser
open index.html
# or serve locally
npx serve .
```

## Core concept

1. **Demand signal capture** — households, stores, and restaurants log recurring consumption (a "pantry profile") instead of placing one-off orders.
2. **AI demand engine** — forecasts regional and household-level demand for each SKU (garri, egusi, palm oil, stockfish, plantain flour, etc.) weeks ahead.
3. **JIT procurement & cross-dock** — Oja pre-positions inventory at regional micro-warehouses sized to forecasted demand, minimizing dead stock and spoilage.
4. **Last-mile fulfillment** — routes to stores, restaurants, and direct-to-door subscriptions on a predictable cadence.

## License

Proprietary — Zenith AI Automation Agency / Oja, all rights reserved.
