import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { applySecurityHeaders } from "@/lib/security-headers";

/**
 * Edge middleware: (1) refreshes the Supabase auth cookies on every request so
 * sessions never silently expire mid-visit (no-op when Supabase env is absent),
 * and (2) applies the baseline security headers to every response. Session
 * refresh is skipped when unconfigured; headers are always applied.
 */
export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    return applySecurityHeaders(NextResponse.next());
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (all) => {
        for (const { name, value } of all) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of all)
          response.cookies.set(name, value, options);
      },
    },
  });
  // getUser() validates the JWT against Supabase and refreshes if expired.
  await supabase.auth.getUser();
  return applySecurityHeaders(response);
}

export const config = {
  // Session refresh + headers on pages; probes stay dependency-light (excluded).
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/webhooks|api/health|api/live|api/ready|api/status).*)",
  ],
};
