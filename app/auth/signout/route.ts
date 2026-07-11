import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseServer, supabaseUser } from "@/lib/supabase/server";
import { recordLogout } from "@/server/repositories/identity";
import { SESSION_COOKIE } from "@/lib/auth";
import { captureError } from "@/lib/observability";

export async function POST(request: Request) {
  const supabase = await supabaseServer();
  try {
    const user = await supabaseUser();
    if (user) await recordLogout(user.id);
    if (supabase) await supabase.auth.signOut();
  } catch (e) {
    captureError(e, { route: "auth/signout" });
  }
  const jar = await cookies();
  jar.delete(SESSION_COOKIE); // clear legacy dev session too
  return NextResponse.redirect(new URL("/", new URL(request.url).origin));
}
