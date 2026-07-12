# Oja Design System — Component Convergence

Single source of truth for UI. Every screen consumes `components/ui`; no
page-specific copies of buttons, cards, inputs, badges, tiles, or layout
wrappers remain.

## Phase 1 — Audit (before)

The app had **no component library** — ~10 App-Router pages each inlined their
own Tailwind. The "duplicates" were repeated inline JSX patterns, not competing
files. Measured across `app/**/*.tsx`:

| Existing pattern (inline)                                         | Locations (pages)                                                       | Usages | Replacement            | Status  |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------- | -----: | ---------------------- | ------- |
| Orange fill button `rounded-full bg-oja-orange …`                 | home, layout, login, onboarding, subscribe, wholesale, group×2, account |     17 | `Button` (primary)     | ✅ Done |
| Green fill button `rounded-full bg-oja-green …`                   | warehouse×2, admin×2                                                    |      4 | `Button` (success)     | ✅ Done |
| Green outline button `rounded-full border-2 border-oja-green …`   | home, account, group, warehouse                                         |      5 | `Button` (secondary)   | ✅ Done |
| White card panel `rounded-xl border border-oja-green/20 bg-white` | account×2, group×2, warehouse×2, admin×2, wholesale                     |     11 | `Card` / `cardClasses` | ✅ Done |
| Form input `rounded-lg border border-oja-green/30 bg-white …`     | login, subscribe, onboarding, wholesale, group, account (via forms)     |    ~20 | `Input`                | ✅ Done |
| Select (same styling)                                             | subscribe×2, wholesale, onboarding×3, group×2                           |      8 | `Select`               | ✅ Done |
| Textarea (same styling)                                           | wholesale                                                               |      1 | `Textarea`             | ✅ Done |
| Compact input `rounded border … px-2 py-1`                        | warehouse×3                                                             |      3 | `Input` (`sm`)         | ✅ Done |
| Status pill `rounded-full px-3 py-1 text-xs font-bold`            | account, admin                                                          |      2 | `Badge`                | ✅ Done |
| KPI tile (label + big value)                                      | admin×6, warehouse×4                                                    |    ~10 | `StatTile`             | ✅ Done |
| Page H1 `text-3xl font-extrabold text-oja-green-deep`             | every page                                                              |     10 | `PageTitle`            | ✅ Done |
| Section H2 `text-xl font-bold text-oja-green-deep`                | account, warehouse×4, admin×7                                           |    ~12 | `SectionTitle`         | ✅ Done |
| Empty/muted line `text-sm text-oja-green-deep/60`                 | warehouse×2, admin×3, account                                           |     ~6 | `EmptyState`           | ✅ Done |
| Error/notice box                                                  | login×2, onboarding                                                     |      3 | `Alert`                | ✅ Done |
| Page container `mx-auto w-full max-w-* flex-1 px-6 py-*`          | every page                                                              |     10 | `PageMain`             | ✅ Done |

**Not present in the codebase** (so not built — building unused primitives would
create dead code, violating the convergence goal): Modal, Dialog, Drawer, Sheet,
Tabs, Toast, Pagination, Breadcrumb, Avatar, Radio, Switch, Checkbox (one raw
checkbox remains inline in warehouse QC), Table, Spinner, Skeleton, and page-level
Loading/Error states. These are documented here as intentional non-builds; add
them under `components/ui` when a real screen first needs one.

## Phase 2 — The library (`components/ui`)

`Button` (+`buttonClasses`), `Card` (+`cardClasses`), `Badge`, `Input`,
`Select`, `Textarea`, `Alert`, `StatTile`, `PageMain`, `PageTitle`,
`SectionTitle`, `EmptyState`. One barrel (`components/ui/index.ts`); one class
joiner (`lib/cn.ts`). `*Classes` helpers let non-`<div>`/`<button>` elements
(`<Link>`, `<form>`) adopt the exact look without copying strings.

## Phase 3 — Styling tokens

All primitives reference the brand tokens declared in `app/globals.css`
(`--color-oja-*`). Standardized: radius (`rounded-full` buttons, `rounded-xl`
cards, `rounded-lg` inputs), three button sizes / two field sizes, one card
padding scale, `transition-colors` everywhere, consistent `hover:` states, and —
new across the board — `focus-visible` rings and `disabled` styling that most
inline buttons previously lacked (an accessibility win applied in one place).

## Phase 4 — Layouts

`PageMain` is the shared page shell (centered, width-capped, consistent
`px-6 py-12` rhythm; `centered` variant for auth/marketing). Route-group layouts
(`(customer)`) keep the shared nav.

## Phases 5–6 — Responsive & a11y

Verified home/login at 390 px (mobile) and 1280 px (desktop): **zero horizontal
overflow** at either width. Inputs keep their `aria-label`s; `Alert` `error`
carries `role="alert"`; buttons gained visible focus rings; semantic elements
(`<section>`, `<form>`, `<details>`) preserved via the `*Classes` helpers rather
than being flattened to `<div>`.

## Documented exceptions (intentionally not centralized)

- **Text-link actions** (`underline` buttons: pause/resume/swap/cancel, sign-out)
  — inline text affordances, not the fill/outline button component.
- **Subscribe plan radio-cards** — interactive `has-checked:` selection cards, a
  distinct pattern used only on `/subscribe`.
- **Google sign-in button** — brand-specific control (white bg + Google mark);
  brought up to the shared a11y/hover/focus standard but kept bespoke.
- **Dev sign-in `<details>`** — non-production disclosure element.

## Verification

`npm run typecheck` · `lint` · `format:check` · `build` · `test` (82 passing)
all green. Commerce flow unchanged (subscriptions, cycles, group orders,
wholesale, pricing, orders, admin KPIs, RLS multi-tenant isolation are covered by
the suite and untouched by this UI-only refactor).
