# GAARII — America's First Premium Garri Subscription

**One product. Premium Nigerian garri. Delivered monthly, nationwide across the U.S.**

GAARII (consumer brand of the Oja platform; _garri_ is the beloved Nigerian cassava staple, Oja is Yoruba for _"market"_) is a single-product subscription company. The MVP sells exactly one thing — **Premium Nigerian Garri**, in White (Ijebu) and Yellow varieties — as a monthly subscription with pantry management built in: pause, skip, swap, or cancel anytime. AI demand forecasting keeps stock fresh and deliveries ahead of empty pantries. No stockouts. No stale bags. No guessing.

> **Brand note:** GAARII is the customer-facing brand for the MVP. "Oja" remains the platform/company name used in internal architecture and planning docs — the underlying platform is deliberately built to expand beyond garri in later phases.

---

## Why GAARII

Getting good garri in America is harder than it should be: households drive store to store chasing a bag that may be out of stock, online resellers charge steep markups for garri of unknown age and origin, and quality varies bag to bag. GAARII replaces that with one controlled product specification, premium sourcing from trusted Nigerian processors, and a reliable monthly subscription — deliberately **not** competing to be the cheapest garri seller, but to be the pantry staple you never think about again.

## Roadmap

| Phase                                 | Scope                                                                                                                                                                 |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Phase 1 (MVP) — Garri only**        | One product: Premium Garri (White/Ijebu + Yellow) · subscription only · nationwide U.S. delivery · monthly deliveries · pantry management · pause/skip/cancel anytime |
| **Phase 2 — Nigerian pantry staples** | Egusi · beans · rice · yam flour (elubo) · fufu · plantain flour · palm oil                                                                                           |
| **Phase 3 — AI-powered pantry**       | Complete Nigerian pantry · AI pantry assistant · smart auto-replenishment · family consumption forecasting · recipe recommendations · heritage gifting                |

## What's in this package

| File / Folder                       | Contents                                                                                                                                                                   |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/PRD.md`                       | Full Product Requirements Document                                                                                                                                         |
| `docs/GTM.md`                       | Go-to-Market strategy                                                                                                                                                      |
| `docs/PRODUCT_STRATEGY.md`          | Product strategy, tiers, roadmap                                                                                                                                           |
| `docs/PRICING_STRATEGY.md`          | Pricing model (margin-protected, Garri-only MVP)                                                                                                                           |
| `docs/MARGIN_AND_SHIPPING_MODEL.md` | Margin & shipping protection model for the household subscription                                                                                                          |
| `docs/IMPLEMENTATION_STRATEGY.md`   | 90-day MVP + phased rollout plan                                                                                                                                           |
| `docs/ARCHITECTURE.md`              | System, data, and supply chain architecture diagrams                                                                                                                       |
| `landing-page/index.html`           | Standalone marketing landing page (nav, hero, subscriptions, pricing, FAQ, footer)                                                                                         |
| `app/`, `prisma/`, `lib/`           | Next.js app shell + Prisma schema/seed (garri-only seed data; schema extensible for later phases)                                                                          |
| `package.json`                      | Project manifest for the app shell and landing page                                                                                                                        |
| `claude-fable-5/`                   | Execution package for building the real product with Claude Fable 5 — `CLAUDE.md` (agent brief), `EXECUTION_PLAN.md` (phased build tasks), `PROGRESS_LOG.md` (running log) |

## Building with Claude Fable 5

The `claude-fable-5/` folder is the handoff point for actually building GAARII (beyond this strategy + landing page package). Point Claude Code (running the `claude-fable-5` model) at this repo and have it start with `claude-fable-5/CLAUDE.md`, which in turn walks it through `claude-fable-5/EXECUTION_PLAN.md` phase by phase.

## Quick start

```bash
# landing page
npm run landing        # or open landing-page/index.html directly

# app shell
npm install
npm run db:up          # Postgres via docker compose
npm run db:migrate     # apply migrations
npx prisma db seed     # seed the two garri SKUs
npm run dev
```

## Core concept

1. **Committed demand** — subscribers set a Garri plan (variety, grind, quantity, cadence) instead of placing one-off orders; pantry management (pause/skip/swap) keeps it honest.
2. **AI demand engine** — forecasts household- and region-level garri consumption weeks ahead, including seasonal and celebration spikes.
3. **JIT procurement** — inventory is pre-positioned to forecasted demand, so garri stays fresh and working capital stays lean.
4. **Nationwide fulfillment** — monthly parcel delivery across the U.S., shipping included in every plan price.

The platform (catalog, inventory ledger, demand engine) is intentionally product-agnostic so Phase 2 staples can be added without redesign — but the MVP exposes only garri.

## License

Proprietary — Zenith AI Automation Agency / Oja, all rights reserved.
