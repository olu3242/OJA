"use client";

import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { oauthCallbackUrl } from "@/lib/supabase/redirect";

/** Google Sign In / Sign Up — same OAuth grant; provisioning decides which. */
export function GoogleSignInButton({
  label,
  next,
}: {
  label: string;
  next?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = supabaseBrowser();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: oauthCallbackUrl(next),
          queryParams: { access_type: "offline", prompt: "select_account" },
        },
      });
      if (error) throw error;
      // Browser is redirected to Google; loading state persists until nav.
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Sign-in failed — please retry.",
      );
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={start}
        disabled={loading}
        aria-busy={loading}
        className="flex items-center justify-center gap-3 rounded-full border-2 border-oja-green bg-white px-6 py-3 font-bold text-oja-green-deep transition-colors hover:bg-oja-green/5 focus-visible:ring-2 focus-visible:ring-oja-orange/50 focus-visible:ring-offset-2 focus-visible:ring-offset-oja-cream focus-visible:outline-none disabled:pointer-events-none disabled:opacity-60"
      >
        <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
          <path
            fill="#EA4335"
            d="M24 9.5c3.5 0 6.6 1.2 9 3.5l6.7-6.7C35.6 2.4 30.2 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.8 6.1C12.3 13.4 17.7 9.5 24 9.5z"
          />
          <path
            fill="#4285F4"
            d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z"
          />
          <path
            fill="#FBBC05"
            d="M10.4 28.7a14.5 14.5 0 0 1 0-9.4l-7.8-6.1a24 24 0 0 0 0 21.6l7.8-6.1z"
          />
          <path
            fill="#34A853"
            d="M24 48c6.2 0 11.4-2 15.2-5.6l-7.5-5.8c-2.1 1.4-4.7 2.2-7.7 2.2-6.3 0-11.7-3.9-13.6-9.4l-7.8 6.1C6.5 42.6 14.6 48 24 48z"
          />
        </svg>
        {loading ? "Redirecting to Google…" : label}
      </button>
      {error && (
        <p role="alert" className="text-sm font-semibold text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
