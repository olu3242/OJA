"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { SESSION_COOKIE, currentAccount, sessionToken } from "@/lib/auth";
import { createCaller } from "@/server/router";

async function caller() {
  return createCaller({ account: await currentAccount() });
}

/** Dev-auth login: find-or-create household account by email (stub — PRD wants OTP). */
export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  if (!email.includes("@")) redirect("/login?error=email");
  const name = String(formData.get("name") ?? "") || email.split("@")[0];
  const account =
    (await db.account.findUnique({ where: { email } })) ??
    (await db.account.create({ data: { email, name, role: "HOUSEHOLD" } }));
  const jar = await cookies();
  jar.set(SESSION_COOKIE, sessionToken(account.id), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
  redirect(
    account.role === "ADMIN"
      ? "/admin"
      : account.role === "WAREHOUSE"
        ? "/warehouse"
        : "/account",
  );
}

export async function logoutAction() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  redirect("/");
}

export async function subscribeAction(formData: FormData) {
  const c = await caller();
  await c.subscription.create({
    plan: formData.get("plan") as "STARTER" | "FAMILY" | "STOCK_UP",
    variety: formData.get("variety") as "WHITE_IJEBU" | "YELLOW",
    grind: (formData.get("grind") as "COARSE" | "FINE") ?? "COARSE",
    address: {
      line1: String(formData.get("line1")),
      city: String(formData.get("city")),
      state: String(formData.get("state")).toUpperCase(),
      zip: String(formData.get("zip")),
    },
  });
  redirect("/account");
}

export async function confirmCycleAction(formData: FormData) {
  const c = await caller();
  await c.cycle.confirm({ cycleId: String(formData.get("cycleId")) });
  redirect("/account");
}

export async function skipCycleAction(formData: FormData) {
  const c = await caller();
  await c.cycle.skip({ cycleId: String(formData.get("cycleId")) });
  redirect("/account");
}

export async function pauseAction(formData: FormData) {
  const c = await caller();
  await c.subscription.pause({ id: String(formData.get("id")) });
  redirect("/account");
}

export async function resumeAction(formData: FormData) {
  const c = await caller();
  await c.subscription.resume({ id: String(formData.get("id")) });
  redirect("/account");
}

export async function cancelAction(formData: FormData) {
  const c = await caller();
  await c.subscription.cancel({ id: String(formData.get("id")) });
  redirect("/account");
}

export async function swapAction(formData: FormData) {
  const c = await caller();
  await c.subscription.swap({
    id: String(formData.get("id")),
    variety: formData.get("variety") as "WHITE_IJEBU" | "YELLOW",
  });
  redirect("/account");
}

export async function wholesaleAction(formData: FormData) {
  const c = await caller();
  await c.wholesale.join({
    businessName: String(formData.get("businessName")),
    email: String(formData.get("email")),
    businessType: String(formData.get("businessType")),
    message: String(formData.get("message") ?? "") || undefined,
  });
  redirect("/wholesale?joined=1");
}

// Warehouse actions
export async function receiveAction(formData: FormData) {
  const c = await caller();
  await c.warehouse.receive({
    poLineId: String(formData.get("poLineId")),
    qtyUnits: Number(formData.get("qtyUnits")),
    lotCode: String(formData.get("lotCode")),
    expiresAt: formData.get("expiresAt")
      ? new Date(String(formData.get("expiresAt")))
      : undefined,
    qcPassed: formData.get("qcPassed") === "on",
    qcNotes: String(formData.get("qcNotes") ?? "") || undefined,
  });
  redirect("/warehouse");
}

export async function waveAction(formData: FormData) {
  const c = await caller();
  const waves = await c.warehouse.generateWave({
    warehouseId: String(formData.get("warehouseId")),
  });
  // Auto-confirm picks in the same action for the MVP flow (scan step later)
  for (const wave of waves) {
    await c.warehouse.confirmPick({
      orderId: wave.orderId,
      picks: wave.picks.map((p) => ({
        orderLineId: p.orderLineId,
        lotCode: p.lotCode,
        qtyUnits: p.qtyUnits,
      })),
    });
  }
  redirect("/warehouse");
}

export async function dispatchAction(formData: FormData) {
  const c = await caller();
  await c.warehouse.dispatch({ orderId: String(formData.get("orderId")) });
  redirect("/warehouse");
}

export async function deliveredAction(formData: FormData) {
  const c = await caller();
  await c.warehouse.markDelivered({ orderId: String(formData.get("orderId")) });
  redirect("/warehouse");
}

// Admin actions
export async function runForecastAction() {
  const c = await caller();
  await c.admin.runForecast();
  redirect("/admin");
}

export async function draftPoAction(formData: FormData) {
  const c = await caller();
  await c.admin.draftPo({
    warehouseId: String(formData.get("warehouseId")),
    supplierId: String(formData.get("supplierId")),
  });
  redirect("/admin");
}

export async function placePoAction(formData: FormData) {
  const c = await caller();
  await c.admin.placePo({ poId: String(formData.get("poId")) });
  redirect("/admin");
}

// Group orders (tasks 3.3 / 4.4)
export async function groupCreateAction(formData: FormData) {
  const c = await caller();
  const g = await c.group.create({
    address: {
      line1: String(formData.get("line1")),
      city: String(formData.get("city")),
      state: String(formData.get("state")).toUpperCase(),
      zip: String(formData.get("zip")),
    },
  });
  redirect(`/group/${g.code}`);
}

export async function groupJoinAction(formData: FormData) {
  const c = await caller();
  const code = String(formData.get("code"));
  await c.group.join({
    code,
    plan: formData.get("plan") as "STARTER" | "FAMILY" | "STOCK_UP",
    variety: formData.get("variety") as "WHITE_IJEBU" | "YELLOW",
  });
  redirect(`/group/${code}`);
}

export async function groupCloseAction(formData: FormData) {
  const c = await caller();
  const code = String(formData.get("code"));
  await c.group.close({ code });
  redirect(`/group/${code}`);
}

export async function electFastPayAction(formData: FormData) {
  const c = await caller();
  await c.supplier.electFastPay({
    supplierId: String(formData.get("supplierId")),
    fastPay: String(formData.get("fastPay")) === "true",
  });
  redirect("/supplier");
}
