import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import type { Account } from "@/lib/generated/prisma/client";

// Minimal session auth for the MVP scaffold: HMAC-signed account-id cookie.
// Replace with a real auth provider (email OTP per PRD) before pilot launch.
export const SESSION_COOKIE = "gaarii_session";
const secret = () => process.env.SESSION_SECRET ?? "dev-secret-change-me";

function sign(value: string): string {
  return createHmac("sha256", secret()).update(value).digest("hex");
}

export function sessionToken(accountId: string): string {
  return `${accountId}.${sign(accountId)}`;
}

export function verifySessionToken(token: string | undefined): string | null {
  if (!token) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const accountId = token.slice(0, dot);
  const mac = token.slice(dot + 1);
  const expected = sign(accountId);
  if (mac.length !== expected.length) return null;
  if (!timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return null;
  return accountId;
}

export async function currentAccount(): Promise<Account | null> {
  // 1) Supabase (Google OAuth) session — canonical identity, bridged to the
  //    commerce account via profiles.legacy_account_id (created on demand).
  try {
    const { supabaseUser } = await import("@/lib/supabase/server");
    const user = await supabaseUser();
    if (user?.email) {
      const { getProfile } = await import("@/server/repositories/identity");
      const { canonicalPool } = await import("@/lib/canonical-db");
      const profile = await getProfile(user.id);
      if (profile?.legacy_account_id) {
        const linked = await db.account.findUnique({
          where: { id: profile.legacy_account_id },
        });
        if (linked) return linked;
      }
      const account =
        (await db.account.findUnique({
          where: { email: user.email.toLowerCase() },
        })) ??
        (await db.account.create({
          data: {
            email: user.email.toLowerCase(),
            name: profile?.full_name ?? user.email.split("@")[0],
            role: "HOUSEHOLD",
          },
        }));
      await canonicalPool
        .query(
          `update public.profiles set legacy_account_id = $2, updated_by = $1
            where id = $1 and legacy_account_id is null`,
          [user.id, account.id],
        )
        .catch(() => undefined);
      return account;
    }
  } catch {
    // Supabase not configured/reachable — fall through to legacy session.
  }

  // 2) Legacy HMAC cookie session (dev fallback; disabled UI in production).
  const jar = await cookies();
  const accountId = verifySessionToken(jar.get(SESSION_COOKIE)?.value);
  if (!accountId) return null;
  return db.account.findUnique({ where: { id: accountId } });
}
