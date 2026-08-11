import { beforeAll, describe, expect, it } from "vitest";
import { migrate } from "../../scripts/canonical";
import { adminClient } from "./helpers";
import { resetDb } from "../helpers";
import { convergeAccount } from "@/server/repositories/convergence";
import { resolveCustomer } from "@/server/repositories/payments";
import {
  savePaymentMethod,
  listPaymentMethods,
  setDefaultPaymentMethod,
} from "@/server/repositories/payment-methods";

/**
 * Payment-method vault against the existing canonical `payment_methods` table.
 * Asserts the single-default invariant and that only a gateway token + display
 * metadata (brand/last4) is ever persisted — never a PAN.
 */
describe("payment-method vault", () => {
  let accountId: string;
  let customerId: string;

  beforeAll(async () => {
    await migrate();
    const fx = await resetDb();
    accountId = fx.household.id;
    await convergeAccount(accountId);
    const resolved = await resolveCustomer(accountId);
    customerId = resolved!.customerId;
    const c = await adminClient();
    await c.query(`delete from public.payment_methods where customer_id = $1`, [
      customerId,
    ]);
    await c.end();
  });

  it("makes the first vaulted method the default", async () => {
    const pm = await savePaymentMethod({
      accountId,
      providerRef: "pm_tok_first",
      brand: "visa",
      last4: "4242",
      expMonth: 12,
      expYear: 2030,
    });
    expect(pm.isDefault).toBe(true);
    expect(pm.brand).toBe("visa");
    expect(pm.last4).toBe("4242");
  });

  it("keeps exactly one default when a second method is added as default", async () => {
    await savePaymentMethod({
      accountId,
      providerRef: "pm_tok_second",
      brand: "mastercard",
      last4: "5555",
      makeDefault: true,
    });
    const methods = await listPaymentMethods(accountId);
    expect(methods.filter((m) => m.isDefault)).toHaveLength(1);
    expect(methods.find((m) => m.isDefault)!.last4).toBe("5555");
    // A non-default add must not disturb the current default.
    await savePaymentMethod({
      accountId,
      providerRef: "pm_tok_third",
      brand: "amex",
      last4: "0005",
    });
    const after = await listPaymentMethods(accountId);
    expect(after.filter((m) => m.isDefault)).toHaveLength(1);
    expect(after.find((m) => m.isDefault)!.last4).toBe("5555");
  });

  it("persists only a token + display metadata — no PAN column exists or is written", async () => {
    const c = await adminClient();
    const cols = await c.query(
      `select column_name from information_schema.columns
        where table_schema = 'public' and table_name = 'payment_methods'`,
    );
    const names = cols.rows.map((r) => r.column_name as string);
    expect(names).not.toContain("card_number");
    expect(names).not.toContain("pan");
    expect(names).not.toContain("cvv");
    const stored = await c.query(
      `select provider_ref, last4 from public.payment_methods
        where customer_id = $1 and provider_ref = 'pm_tok_first'`,
      [customerId],
    );
    await c.end();
    // The stored reference is an opaque gateway token, and last4 is 4 chars.
    expect(stored.rows[0].provider_ref).toBe("pm_tok_first");
    expect(String(stored.rows[0].last4).trim()).toHaveLength(4);
  });

  it("switches the default explicitly, demoting the prior default", async () => {
    const methods = await listPaymentMethods(accountId);
    const amex = methods.find((m) => m.last4 === "0005")!;
    const promoted = await setDefaultPaymentMethod(accountId, amex.id);
    expect(promoted.isDefault).toBe(true);
    const after = await listPaymentMethods(accountId);
    expect(after.filter((m) => m.isDefault)).toHaveLength(1);
    expect(after[0].last4).toBe("0005"); // default sorts first
  });
});
