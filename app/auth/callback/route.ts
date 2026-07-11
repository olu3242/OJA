import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { provisionUser } from "@/server/repositories/identity";
import { db } from "@/lib/db";
import { captureError } from "@/lib/observability";

/**
 * OAuth callback (PKCE): exchanges the auth code for a session, then runs
 * idempotent provisioning — profile, personal tenant, role, onboarding state,
 * legacy-account linking by verified email — before landing the user.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const rawNext = url.searchParams.get("next") ?? "/onboarding";
  const next =
    rawNext.startsWith("/") && !rawNext.startsWith("//")
      ? rawNext
      : "/onboarding";

  const supabase = await supabaseServer();
  if (!supabase) {
    return NextResponse.redirect(
      new URL("/login?error=auth_unconfigured", url.origin),
    );
  }
  if (!code) {
    return NextResponse.redirect(
      new URL("/login?error=missing_code", url.origin),
    );
  }

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) {
    captureError(error ?? new Error("no user after code exchange"), {
      route: "auth/callback",
    });
    return NextResponse.redirect(
      new URL("/login?error=oauth_failed", url.origin),
    );
  }

  const user = data.user;
  const google = user.identities?.find((i) => i.provider === "google");
  const email = user.email ?? google?.identity_data?.email;
  if (!email || (google && user.user_metadata?.email_verified === false)) {
    await supabase.auth.signOut();
    return NextResponse.redirect(
      new URL("/login?error=email_unverified", url.origin),
    );
  }

  try {
    // Existing-account linking: a pre-Supabase account with the same
    // (Google-verified) email is attached to this profile, never duplicated.
    const legacy = await db.account
      .findUnique({ where: { email: email.toLowerCase() } })
      .catch(() => null);

    const result = await provisionUser({
      userId: user.id,
      email,
      fullName: (user.user_metadata?.full_name as string) ?? null,
      avatarUrl: (user.user_metadata?.avatar_url as string) ?? null,
      provider: "google",
      providerSubject: google?.id ?? user.id,
      ip: request.headers.get("x-forwarded-for")?.split(",")[0] ?? null,
      userAgent: request.headers.get("user-agent"),
      legacyAccountId: legacy?.id ?? null,
    });

    const dest = result.created
      ? "/onboarding"
      : next === "/onboarding"
        ? "/account"
        : next;
    return NextResponse.redirect(new URL(dest, url.origin));
  } catch (e) {
    captureError(e, { route: "auth/callback", userId: user.id });
    return NextResponse.redirect(
      new URL("/login?error=provisioning_failed", url.origin),
    );
  }
}
