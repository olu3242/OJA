import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { isSupabaseConfigured } from "./redirect";

/** Server-side Supabase client bound to the request's cookies (PKCE flow). */
export async function supabaseServer() {
  if (!isSupabaseConfigured()) return null;
  const jar = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => jar.getAll(),
        setAll: (all) => {
          try {
            for (const { name, value, options } of all)
              jar.set(name, value, options);
          } catch {
            // Server Components can't set cookies; middleware handles refresh.
          }
        },
      },
    },
  );
}

/** The authenticated Supabase user for this request (verified server-side). */
export async function supabaseUser() {
  const supabase = await supabaseServer();
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user;
}
