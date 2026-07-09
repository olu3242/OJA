# Oja — Progress Log

Append-only session log. Newest entry at the bottom. Every build session ends with an entry: date, tasks done, decisions made, next up, blockers.

Entry template:

```
## YYYY-MM-DD — <short session title>

- **Tasks completed:** <EXECUTION_PLAN.md task IDs>
- **Decisions:** <anything chosen that wasn't fully specified, and why>
- **Next up:** <first unchecked task to start next session>
- **Blockers:** <missing keys, unanswered product questions, failing infra — or "none">
```

---

## 2026-07-09 — Repo bootstrap (pre-build)

- **Tasks completed:** n/a (Phase 0 not started — this session created the strategy + execution package itself)
- **Decisions:**
  - Repo structure locked per README: `docs/` strategy set (PRD, GTM, product/pricing/implementation strategy, architecture), `landing-page/` static marketing page, `claude-fable-5/` execution package.
  - Stack committed in CLAUDE.md: Next.js App Router + tRPC + Prisma/Postgres + Tailwind; forecast v0 as TypeScript nightly job, ML deferred to Phase 2.
  - Launch metro provisionally Houston (final call pending supplier diligence — PRD open question #1).
- **Next up:** Task 0.1 — scaffold Next.js app shell.
- **Blockers:** none for 0.1–0.8; Stripe/Twilio/Resend keys needed before 1.2 and 1.8 (stub adapters until then).

## 2026-07-09 — Task 0.1: Next.js app shell scaffolded

- **Tasks completed:** 0.1
- **Decisions:**
  - Scaffolded via `create-next-app@latest` → Next.js 16.2 (App Router, Turbopack), React 19, TypeScript 5, Tailwind v4 (`@tailwindcss/postcss`), ESLint 9 flat config with `eslint-config-next`.
  - Added Prettier 3 + `eslint-config-prettier`; `format`/`format:check`/`typecheck` scripts. Prettier ignores `landing-page/` (kept byte-for-byte untouched per task spec).
  - Dropped the scaffold's Geist Google-font loading in favor of a system font stack — avoids build-time font downloads and matches the landing page's stack.
  - Oja brand tokens (green/orange/cream palette from the landing page) defined as Tailwind theme colors (`oja-green`, `oja-orange`, …) in `app/globals.css`.
  - Root `package.json` scripts now drive the Next app (`dev`/`build`/`start`/`lint`); landing page still servable via `npm run landing`.
  - Prettier also reformatted the markdown docs (tables/emphasis normalization) — content unchanged.
- **Verified:** `npm run typecheck`, `npm run lint`, and `npm run build` all green.
- **Next up:** Task 0.2 — Prisma + Postgres with docker-compose and `.env.example`.
- **Blockers:** none.
