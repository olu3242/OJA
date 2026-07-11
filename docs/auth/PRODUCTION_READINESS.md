# Production Readiness — Google Auth + Canonical Schema

Roles: Principal Architect · Staff Backend Engineer · Database Architect ·
Security Engineer. Companion docs: ERD.md · OAUTH_FLOW.md · MIGRATION_REPORT.md ·
RLS_REPORT.md · SECURITY_REVIEW.md · DEPLOYMENT_GUIDE.md.

## Test report

All executed against live Postgres 16 (same engine as Supabase), in CI via a
service container.

| Suite                                              | Coverage                                                                                                                                                                                          | Result      |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| `tests/canonical/migration.test.ts`                | 100% migration success, re-runnability, 118+ required tables present, all conventions (columns/triggers/RLS/FK indexes), optimistic locking, audit triggers                                       | ✅ 5/5      |
| `tests/canonical/rls.test.ts`                      | tenant isolation (read+write), soft-delete invisibility, profiles self-scope, role-escalation guard, admin escalation, anon surface, invoker views                                                | ✅ 8/8      |
| `tests/canonical/provisioning.test.ts`             | signup provisioning (profile/tenant/role/onboarding/history), replay idempotency (no duplicate users/orgs/memberships), identity-collision refusal, legacy linking, onboarding completion + authz | ✅ 5/5      |
| OAuth redirect unit tests                          | localhost/preview/production resolution, open-redirect guard                                                                                                                                      | ✅          |
| Legacy platform suites (gates G1/G2/G3 + channels) | unchanged, still green                                                                                                                                                                            | ✅ 41 tests |
| Playwright browser e2e                             | subscribe→confirm flow                                                                                                                                                                            | ✅          |
| Lint / typecheck / format / build                  | zero errors                                                                                                                                                                                       | ✅          |

**No duplicate users** (constraint + replay test) · **no orphaned records**
(FKs on every relationship; forensic stores intentionally FK-free to survive
subject deletion, documented) · **100% migration success** (transactional,
checksum-locked).

## What is production-ready today

- Canonical schema: 123 tables / 18 domains, mechanically-enforced
  conventions, RLS everywhere, seed data, views + materialized KPI view.
- Auth code path: PKCE Google sign-in/up, callback exchange, idempotent
  provisioning (profile → tenant → role → onboarding), existing-account
  linking, session refresh middleware, logout, login history, audit logs.
- Multi-tenancy + RBAC (8 roles / 14 permissions), country support (US/CA),
  event store, referral/wholesale/supplier/POS/forecast/notification/file/
  marketing/analytics/admin domains modeled and policied.

## Conditions to flip auth live (external, not code)

| #   | Condition                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Owner  |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| C1  | Supabase project created; `canonical:migrate` + `verify` run against it                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | DevOps |
| C2  | Google OAuth client created; provider enabled in Supabase; redirect URLs configured for all three environments                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | DevOps |
| C3  | Env vars set per DEPLOYMENT_GUIDE §3 (service key server-side only)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | DevOps |
| C4  | Post-deploy smoke per DEPLOYMENT_GUIDE §4 (signup → onboarding → signout → signin)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Eng    |
| C5  | Commerce convergence is staged and flag-gated behind the tested legacy Prisma path. **Shipped:** (1) idempotent batch backfill (`npm run converge`); (2) self-verifying dual-read parity (`v_commerce_kpis`, `parityCheck`, hourly `legacy_convergence` job); (3) live dual-write mirror across the full commerce surface — subscriptions, cycles/orders, wholesale standing orders, group orders, and refunds (order status transitions + `refunds` rows) — behind `canonical_dual_write` (env kill-switch, best-effort, reconciled by the hourly job); (4) parity-gated read cutover behind `canonical_read` (`subscription.mineSource`, legacy fallback for unmirrored accounts). Both flags default OFF; roll forward per domain once parity holds in production. | Eng    |

## GO / NO-GO recommendation

**GO — conditional.** Ship the code and schema now; enable the Google provider
the moment C1–C3 are satisfied (an afternoon of dashboard work, no code
changes). The implementation is real end-to-end — the only mocked thing in
this repo remains the payment/carrier/notification adapters that were already
stubbed behind interfaces, and authentication is **not** among them: the flow
runs GoTrue + PKCE + the exact SQL tested here. A hard NO-GO applies only to
flipping commerce writes onto the canonical tables today (C5): that migration
is mapped (ERD.md) but deliberately staged so the tested, revenue-bearing
Prisma path keeps running while domains move over one at a time.
