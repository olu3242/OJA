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
  const jar = await cookies();
  const accountId = verifySessionToken(jar.get(SESSION_COOKIE)?.value);
  if (!accountId) return null;
  return db.account.findUnique({ where: { id: accountId } });
}
