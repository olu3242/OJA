import { beforeAll, describe, expect, it } from "vitest";
import { migrate } from "../../scripts/canonical";
import { adminClient } from "./helpers";
import { resetDb } from "../helpers";
import { convergeAccount } from "@/server/repositories/convergence";
import {
  resolveCustomer,
  issueCredit,
  walletBalance,
  applyWalletCredit,
} from "@/server/repositories/payments";

/**
 * Wallet credit application against the existing canonical wallets/credits
 * ledger. Draws down min(balance, owed) under a row lock and books a negative
 * credit entry, so the wallet balance stays the running sum of its credit rows.
 */
describe("wallet credit application", () => {
  let orgId: string;
  let customerId: string;

  beforeAll(async () => {
    await migrate();
    const fx = await resetDb();
    await convergeAccount(fx.household.id);
    const resolved = await resolveCustomer(fx.household.id);
    orgId = resolved!.orgId;
    customerId = resolved!.customerId;
    const c = await adminClient();
    await c.query(
      `delete from public.credits where wallet_id in
         (select id from public.wallets where customer_id = $1)`,
      [customerId],
    );
    await c.query(`delete from public.wallets where customer_id = $1`, [
      customerId,
    ]);
    await c.end();
    // Seed a $5.00 wallet.
    await issueCredit({
      orgId,
      customerId,
      amountCents: 500,
      currency: "USD",
      reason: "goodwill",
    });
  });

  it("reads the current wallet balance", async () => {
    expect(await walletBalance(customerId)).toBe(500);
  });

  it("applies only up to the balance and leaves the rest to charge", async () => {
    const res = await applyWalletCredit({
      orgId,
      customerId,
      amountCents: 2000,
    });
    expect(res.creditAppliedCents).toBe(500);
    expect(res.remainingCents).toBe(1500);
    expect(await walletBalance(customerId)).toBe(0);
  });

  it("applies only up to the amount owed when the wallet is richer", async () => {
    await issueCredit({
      orgId,
      customerId,
      amountCents: 1000,
      currency: "USD",
      reason: "refund",
    });
    const res = await applyWalletCredit({
      orgId,
      customerId,
      amountCents: 300,
    });
    expect(res.creditAppliedCents).toBe(300);
    expect(res.remainingCents).toBe(0);
    expect(await walletBalance(customerId)).toBe(700);
  });

  it("is a no-op against an empty wallet", async () => {
    // Drain the remaining 700 first.
    await applyWalletCredit({ orgId, customerId, amountCents: 700 });
    expect(await walletBalance(customerId)).toBe(0);
    const res = await applyWalletCredit({
      orgId,
      customerId,
      amountCents: 1200,
    });
    expect(res.creditAppliedCents).toBe(0);
    expect(res.remainingCents).toBe(1200);
  });
});
