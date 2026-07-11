import { loginAction } from "@/lib/actions";
import { isSupabaseConfigured } from "@/lib/supabase/redirect";
import { GoogleSignInButton } from "./google-button";

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
    <main className="mx-auto flex max-w-sm flex-1 flex-col justify-center gap-6 px-6 py-16">
      <h1 className="text-2xl font-extrabold text-oja-green-deep">
        Welcome to GAARII<span className="text-oja-orange">.</span>
      </h1>

      {error && (
        <p
          role="alert"
          className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800"
        >
          {ERRORS[error] ?? "Something went wrong — please try again."}
        </p>
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
        <p className="rounded-lg border border-oja-green/20 bg-white px-4 py-3 text-sm text-oja-green-deep/70">
          Google sign-in activates when <code>NEXT_PUBLIC_SUPABASE_URL</code>{" "}
          and <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> are set (see
          docs/auth/DEPLOYMENT_GUIDE.md).
        </p>
      )}

      {process.env.NODE_ENV !== "production" && (
        <details className="rounded-lg border border-oja-green/20 bg-white p-4">
          <summary className="cursor-pointer text-sm font-bold text-oja-green-deep/70">
            Development sign-in (disabled in production)
          </summary>
          <form action={loginAction} className="mt-3 flex flex-col gap-3">
            <input
              type="email"
              name="email"
              required
              placeholder="you@email.com"
              aria-label="Email address"
              className="rounded-lg border border-oja-green/30 bg-white px-4 py-3"
            />
            <input
              type="text"
              name="name"
              placeholder="Your name (optional)"
              aria-label="Your name"
              className="rounded-lg border border-oja-green/30 bg-white px-4 py-3"
            />
            <button
              type="submit"
              className="rounded-full bg-oja-orange px-6 py-3 font-bold text-white"
            >
              Continue
            </button>
          </form>
        </details>
      )}
    </main>
  );
}
