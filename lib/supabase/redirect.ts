/**
 * Environment-aware OAuth redirect base (localhost / preview / production).
 * Priority: explicit NEXT_PUBLIC_SITE_URL (production) → Vercel preview URL →
 * localhost. Google Console must allowlist each environment's
 * `${base}/auth/callback` (see docs/auth/DEPLOYMENT_GUIDE.md).
 */
export function siteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  const vercel = process.env.NEXT_PUBLIC_VERCEL_URL ?? process.env.VERCEL_URL;
  if (vercel) return `https://${vercel.replace(/\/$/, "")}`;
  return "http://localhost:3000";
}

export function oauthCallbackUrl(next?: string): string {
  const base = `${siteUrl()}/auth/callback`;
  if (!next) return base;
  // Only allow same-site relative paths — never open redirects.
  const safe = next.startsWith("/") && !next.startsWith("//") ? next : "/";
  return `${base}?next=${encodeURIComponent(safe)}`;
}

export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
