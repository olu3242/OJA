import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Session refresh middleware: rotates the Supabase auth cookies on every
 * request so sessions never silently expire mid-visit. No-op when Supabase
 * env is absent (local dev without a project).
 */
export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return NextResponse.next();

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
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/webhooks).*)"],
};
