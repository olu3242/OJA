# Deployment Guide — Google Auth + Canonical Schema

## 1. Supabase project

1. Create a Supabase project (region near your users; e.g. `us-east-1`).
2. Apply the canonical schema:
   ```bash
   SUPABASE_DB_URL="postgresql://postgres:...@db.<ref>.supabase.co:5432/postgres" \
     npm run canonical:migrate
   npm run canonical:verify   # must exit 0
   npm run canonical:report   # regenerates docs/auth/*_REPORT.md
   ```
   The migrations are Supabase-aware: the `auth` schema/roles shims are
   guarded no-ops there.

## 2. Google Cloud OAuth client

1. Google Cloud Console → APIs & Services → Credentials → **OAuth client ID
   (Web application)**.
2. Authorized JavaScript origins — one per environment:
   - `http://localhost:3000`
   - `https://<preview-domain>.vercel.app`
   - `https://gaarii.com`
3. Authorized redirect URI (Supabase handles the provider leg):
   - `https://<project-ref>.supabase.co/auth/v1/callback`
4. Supabase Dashboard → Authentication → Providers → Google: paste client ID
   - secret, enable.
5. Supabase Dashboard → Authentication → URL Configuration:
   - Site URL: `https://gaarii.com`
   - Additional redirect URLs: `http://localhost:3000/auth/callback`,
     `https://*.vercel.app/auth/callback`, `https://gaarii.com/auth/callback`

## 3. App environment variables

| Variable                        | localhost                  | preview                   | production           |
| ------------------------------- | -------------------------- | ------------------------- | -------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | project URL                | project URL               | project URL          |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key                   | anon key                  | anon key             |
| `SUPABASE_SERVICE_ROLE_KEY`     | service key (server only!) | 〃                        | 〃                   |
| `SUPABASE_DB_URL`               | local PG or project DB     | project DB (pooled)       | project DB (pooled)  |
| `NEXT_PUBLIC_SITE_URL`          | unset (defaults localhost) | unset (uses `VERCEL_URL`) | `https://gaarii.com` |
| `SESSION_SECRET`                | any                        | strong secret             | strong secret        |

Redirects resolve automatically per environment (`lib/supabase/redirect.ts`,
unit-tested): explicit site URL → Vercel preview URL → localhost.

## 4. Deploy order

1. `npm run canonical:migrate && npm run canonical:verify` against the project DB.
2. Deploy the Next.js app (Vercel/Fly). Middleware immediately starts
   refreshing sessions; `/login` renders the Google buttons once env is set.
3. Smoke: sign in with a Google test account → expect `/onboarding`, a row in
   `profiles`, `organizations` (kind=personal), `organization_members`,
   `user_roles` (household_customer), `oauth_accounts`, `login_history(signup)`.
4. Sign out (`POST /auth/signout`) → `login_history(logout)`, cookies cleared.
5. Re-sign-in → `login_history(signin)`, **no new rows** in
   profiles/organizations/members (idempotency).

## 5. Rollback

- App: redeploy previous build (auth cookies remain valid).
- Schema: migrations are forward-only; write a compensating migration.
  `canonical_migrations.checksum` blocks silent edits of applied files.

## 6. Local development without a Supabase project

Everything except the Google redirect works locally: the canonical schema,
provisioning, RLS, and tests run against local Postgres
(`npm run canonical:migrate && npm test`). `/login` shows the dev sign-in
(hidden in production builds) until Supabase env vars exist.
