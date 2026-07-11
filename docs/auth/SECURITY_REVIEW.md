# Security Review — Google Auth + Canonical Schema

Reviewer role: Security Engineer. Scope: OAuth flow, identity provisioning,
RLS/tenancy, secrets, audit. Verdict feeds the GO/NO-GO in
PRODUCTION_READINESS.md.

## Authentication & session

| Control                                                                       | Status | Evidence                                                                                                |
| ----------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------- |
| OAuth 2.0 + PKCE via Supabase GoTrue (no tokens in URLs beyond one-time code) | ✅     | `signInWithOAuth` → `exchangeCodeForSession` (`app/auth/callback/route.ts`)                             |
| State/CSRF protection                                                         | ✅     | handled by GoTrue + PKCE verifier cookie                                                                |
| Verified-email requirement before provisioning/linking                        | ✅     | callback rejects `email_verified === false`                                                             |
| Open-redirect guard on `next` param                                           | ✅     | relative-path allowlist, unit-tested (`redirect.ts`)                                                    |
| Session refresh                                                               | ✅     | middleware `getUser()` rotates tokens on every request                                                  |
| Logout revokes refresh token + clears legacy cookie + logged                  | ✅     | `app/auth/signout/route.ts`                                                                             |
| Duplicate-user prevention                                                     | ✅     | `profiles.id = auth.uid` (1:1), `oauth_accounts unique(provider, subject)`, unique email; replay-tested |
| Account linking is verified-email-based, never user-supplied                  | ✅     | callback resolves legacy account server-side by Google-verified email                                   |
| Login/audit trail                                                             | ✅     | `login_history` (signup/signin/link/logout), `audit_logs` triggers                                      |

## Tenancy & authorization

| Control                                                          | Status | Evidence                                                                |
| ---------------------------------------------------------------- | ------ | ----------------------------------------------------------------------- |
| RLS enabled on 123/123 tables, deny-by-default                   | ✅     | `canonical:verify` = 0 rlsDisabled; forensic tables have no user policy |
| Tenant isolation (org membership)                                | ✅     | `rls.test.ts`: cross-tenant read + write blocked                        |
| Privilege escalation guard                                       | ✅     | `user_roles` writes restricted to platform admin; tested                |
| Policy helper functions SECURITY DEFINER with pinned search_path | ✅     | prevents recursion + shadowing                                          |
| Soft-deleted rows invisible to tenants                           | ✅     | tested                                                                  |
| Views run as invoker (no RLS bypass)                             | ✅     | `security_invoker = true`                                               |
| anon surface: catalog read + waitlist insert only, no read-back  | ✅     | tested (INSERT…RETURNING correctly denied)                              |

## Secrets & data

- No secrets in the repo; `.env.example` documents names only. Service-role
  key is server-only (never `NEXT_PUBLIC_*`).
- Payment tables store provider tokens (`provider_ref`), never PANs (PCI SAQ-A posture).
- API keys stored hashed (`api_keys.hashed_key`); POS webhook secrets stored hashed.
- PII concentrated in `profiles`/`customers` (RLS-scoped); `login_history` IPs
  admin-readable only.

## Residual risks (tracked, not blocking)

1. **Dev sign-in fallback** — rendered only in non-production builds; remove
   entirely once OTP ships (`login/page.tsx` gate).
2. **Supabase service key blast radius** — bypasses RLS by design; keep to
   server runtime env, rotate on staff departure.
3. **Rate limiting** — Supabase Auth has built-in limits; app-level limits on
   `/api/webhooks/*` recommended before scale (tracked in G3 checklist).
4. **MFA** — not in scope; Supabase supports TOTP when required for admins.
5. **Session/device registry** — tables exist; population wired for
   login/logout only; per-device revocation UI is future work.
