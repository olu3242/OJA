# CLAUDE.md — Agent Brief for Building Oja

You are building **Oja**, an AI-powered, just-in-time supply chain platform for authentic African raw foods ("the Sysco of African food"). This file is your standing brief for every session in this repo. Read it fully before writing code.

## Start here, in order

1. This file (context + rules of engagement).
2. `EXECUTION_PLAN.md` (in this folder) — the phased task list. Find the first unchecked task in the current phase; that's your work.
3. `PROGRESS_LOG.md` (in this folder) — read the last 2–3 entries to pick up where the previous session left off. **Append an entry at the end of every session.**
4. The strategy docs in `../docs/` as needed:
   - `PRD.md` — requirements source of truth (esp. §3 scope and §4 functional requirements)
   - `ARCHITECTURE.md` — system/data design you must conform to
   - `IMPLEMENTATION_STRATEGY.md` — stack decisions and 90-day gates
   - `PRODUCT_STRATEGY.md`, `PRICING_STRATEGY.md`, `GTM.md` — business context for judgment calls

## What Oja is (30-second version)

Customers (households, stores, restaurants, community groups) register **committed recurring demand** — pantry profiles and standing orders — instead of only one-off purchases. A **demand engine** turns that plus order history into SKU-level regional forecasts. Procurement and micro-warehouse fulfillment run **just-in-time** against those forecasts. The demand data is the moat; the storefront and logistics are how it's earned.

## Stack (do not deviate without logging a decision)

- **Next.js (App Router) + React + TypeScript + Tailwind** — one codebase, three role-gated surfaces: customer storefront, warehouse app, admin console.
- **tRPC** for the API layer; **Prisma + Postgres** as system of record.
- **Stripe** payments; **Twilio** SMS/WhatsApp; **Resend** email (stub adapters until keys exist).
- Forecast v0 is a **TypeScript nightly job** (moving average + committed-demand floor) — no ML in Phase 1.
- Tests: **Vitest** (unit) + **Playwright** (e2e on the three critical flows: checkout, cycle-confirm, pick/pack).

## Non-negotiable invariants (from ARCHITECTURE.md)

1. **Inventory is an append-only ledger** (`inventory_txns`); stock on hand is always derived, never stored as a mutable counter.
2. **Every unit of a perishable SKU carries lot + expiry**; pick lists must enforce FEFO (first-expired-first-out).
3. **`demand_events` is append-only** and captures intent, not just transactions: cycle confirms, skips, edits, substitution acceptances, out-of-stock views. When you build any customer-facing interaction, ask "what demand signal does this emit?" and emit it.
4. **Forecast rows are versioned inserts, never updates**; admin overrides reference the forecast row and require a reason code.
5. **Recall query must stay fast**: lot → orders → customers is an indexed path with a test that exercises it.
6. **Roles gate everything**: household / store / restaurant / community / warehouse / admin. Wholesale prices must never render for unverified accounts.

## Working rules

- **One task at a time** from `EXECUTION_PLAN.md`; check it off in the same commit that completes it.
- **Definition of done**: code + migration (if schema changed) + tests for the behavior + task checked off + `PROGRESS_LOG.md` entry. Nothing is "done" without tests passing (`npm test`).
- **Commit style**: small, scoped, imperative subject (`Add FEFO ordering to pick-list generation`). Never commit secrets; env via `.env.example` updates.
- **Schema changes** always go through Prisma migrations — never edit the database or old migrations by hand.
- **When the plan is ambiguous**, prefer the PRD; if still ambiguous, make the smallest reasonable choice and record it in `PROGRESS_LOG.md` under "Decisions".
- **Do not gold-plate.** Phase 1 is P0 scope only (PRD §4). Resist building Phase 2 features early — the plan sequences them deliberately.
- **Mobile-first** for customer and warehouse surfaces; warehouse flows need large tap targets and camera barcode scanning.
- African-food domain care: SKU names always pair English + local names (e.g., "Egusi (melon seed)"); support halal flags, origin country, and perishability class as first-class catalog fields.

## Repo layout (target once app scaffold lands)

```
/app            Next.js App Router (customer / warehouse / admin route groups)
/server         tRPC routers, services (catalog, orders, pantry, inventory, procurement, fulfillment, demand-engine, pricing, notifications)
/prisma         schema.prisma + migrations + seed
/jobs           nightly forecast batch, cycle-generation cron
/lib            shared utils, event emission helpers
/tests          vitest + playwright
/docs           strategy docs (read-only context — don't edit unless asked)
/landing-page   static marketing page (already live; leave as-is)
/claude-fable-5 this execution package
```

## Session close-out checklist

- [ ] Tests pass locally
- [ ] Task(s) checked off in `EXECUTION_PLAN.md`
- [ ] `PROGRESS_LOG.md` entry appended (date, tasks done, decisions, next up, blockers)
- [ ] Committed and pushed to the working branch
