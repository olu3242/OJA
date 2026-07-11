# Google OAuth Flow (Supabase Auth, PKCE)

```mermaid
sequenceDiagram
    autonumber
    participant B as Browser
    participant App as Next.js (GAARII)
    participant SB as Supabase Auth (GoTrue)
    participant G as Google
    participant DB as Canonical Postgres

    B->>App: click "Sign in / Sign up with Google"
    App->>SB: signInWithOAuth(google, redirectTo=/auth/callback, PKCE)
    SB->>G: authorize (state + code_challenge)
    G-->>B: Google account chooser / consent
    B->>SB: redirect with auth code
    SB-->>B: 302 → {site}/auth/callback?code=…
    B->>App: GET /auth/callback?code
    App->>SB: exchangeCodeForSession(code) [verifies PKCE + state]
    SB-->>App: session (JWT) + user {id, email, identities[google.sub]}
    App->>DB: provisionUser() — ONE transaction:
    Note over App,DB: profile upsert (id = auth uid)<br/>oauth_accounts unique(provider, sub)<br/>personal organization + owner membership<br/>household_customer role grant<br/>legacy account link by verified email<br/>login_history signup/signin
    App-->>B: redirect → /onboarding (new) or /account (returning)

    rect rgb(240,240,240)
    Note over B,App: every subsequent request
    B->>App: request (auth cookies)
    App->>SB: middleware getUser() → silent token refresh
    end

    B->>App: POST /auth/signout
    App->>DB: login_history(logout)
    App->>SB: auth.signOut() (revokes refresh token)
```

**No duplicate users, by construction:** `profiles.id` = Supabase auth uid
(1:1), `oauth_accounts` is unique on `(provider, provider_subject)`, Supabase
itself keys OAuth users by verified email, and provisioning is a single
idempotent transaction (replay-safe — proven in
`tests/canonical/provisioning.test.ts`).

**Environments:** the redirect base resolves `NEXT_PUBLIC_SITE_URL` →
`VERCEL_URL` (previews) → `http://localhost:3000`, and the `next` parameter
only accepts same-site relative paths (open-redirect guard, unit-tested).
