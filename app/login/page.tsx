import { loginAction } from "@/lib/actions";
import { isSupabaseConfigured } from "@/lib/supabase/redirect";
import { GoogleSignInButton } from "./google-button";
import { Alert, Button, Input, PageMain, PageTitle } from "@/components/ui";

export const metadata = { title: "Sign in" };

const ERRORS: Record<string, string> = {
  oauth_failed: "Google sign-in failed. Please try again.",
  missing_code: "The sign-in link was incomplete. Please try again.",
  email_unverified:
    "Your Google email is unverified — verify it with Google first.",
  provisioning_failed:
    "We couldn't finish setting up your account. Please retry.",
  auth_unconfigured: "Google sign-in isn't configured in this environment.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next } = await searchParams;
  const googleReady = isSupabaseConfigured();

  return (
    <PageMain width="sm" centered>
      <PageTitle size="sm">
        Welcome to GAARII<span className="text-oja-orange">.</span>
      </PageTitle>

      {error && (
        <Alert variant="error">
          {ERRORS[error] ?? "Something went wrong — please try again."}
        </Alert>
      )}

      {googleReady ? (
        <div className="flex flex-col gap-3">
          <GoogleSignInButton label="Sign in with Google" next={next} />
          <GoogleSignInButton label="Sign up with Google" next="/onboarding" />
          <p className="text-xs text-oja-green-deep/60">
            One Google account, one GAARII profile — if you subscribed before
            with the same email, your history links automatically.
          </p>
        </div>
      ) : (
        <Alert variant="info">
          Google sign-in activates when <code>NEXT_PUBLIC_SUPABASE_URL</code>{" "}
          and <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> are set (see
          docs/auth/DEPLOYMENT_GUIDE.md).
        </Alert>
      )}

      {process.env.NODE_ENV !== "production" && (
        <details className="rounded-lg border border-oja-green/20 bg-white p-4">
          <summary className="cursor-pointer text-sm font-bold text-oja-green-deep/70">
            Development sign-in (disabled in production)
          </summary>
          <form action={loginAction} className="mt-3 flex flex-col gap-3">
            <Input
              type="email"
              name="email"
              required
              placeholder="you@email.com"
              aria-label="Email address"
            />
            <Input
              type="text"
              name="name"
              placeholder="Your name (optional)"
              aria-label="Your name"
            />
            <Button type="submit">Continue</Button>
          </form>
        </details>
      )}
    </PageMain>
  );
}
