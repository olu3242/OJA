import type { NextResponse } from "next/server";

/**
 * Baseline security headers applied to every page response (WS7). Values chosen
 * to harden without breaking Next.js App Router: `frame-ancestors 'none'` +
 * `X-Frame-Options: DENY` stop clickjacking; `nosniff` stops MIME sniffing;
 * HSTS forces HTTPS at the edge. The CSP keeps `'unsafe-inline'` for scripts and
 * styles because Next's streaming hydration and Tailwind inject inline content;
 * tightening to nonces is a documented follow-up (see PRODUCTION_READINESS).
 */
const CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "img-src 'self' data: https:",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' 'unsafe-inline'",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://accounts.google.com",
  "form-action 'self'",
].join("; ");

export const SECURITY_HEADERS: Record<string, string> = {
  "Content-Security-Policy": CSP,
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  "X-DNS-Prefetch-Control": "off",
};

export function applySecurityHeaders(response: NextResponse): NextResponse {
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(name, value);
  }
  return response;
}
