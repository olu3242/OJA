import { beforeAll, describe, expect, it } from "vitest";
import { migrate } from "../../scripts/canonical";
import { adminClient } from "./helpers";
import { resetDb } from "../helpers";
import { convergeAccount } from "@/server/repositories/convergence";
import { resolveCustomer } from "@/server/repositories/payments";
import {
  createPromo,
  redeemPromo,
  PromoError,
} from "@/server/repositories/promos";

describe("promo code redemption", () => {
  let orgId: string;
  let orderId: string;

  beforeAll(async () => {
    await migrate();
    const fx = await resetDb();
    await convergeAccount(fx.household.id);
    const resolved = await resolveCustomer(fx.household.id);
    orgId = resolved!.orgId;
    const c = await adminClient();
    await c.query(`delete from public.discounts`);
    await c.query(`delete from public.promo_codes where code like 'TEST-%'`);
    const o = await c.query(
      `insert into public.orders
         (organization_id, customer_id, status, currency, subtotal_cents, total_cents,
          ship_line1, ship_city, ship_region, ship_postal_code, ship_country)
       values ($1,$2,'paid','USD',6400,6400,'1 St','Houston','TX','77001','US')
       returning id`,
      [orgId, resolved!.customerId],
    );
    orderId = o.rows[0].id;
    await c.end();
  });

  it("redeems a valid code and records a discount", async () => {
    await createPromo({ code: "TEST-WELCOME", firstDeliveryOnly: true });
    const res = await redeemPromo({
      code: "TEST-WELCOME",
      orgId,
      orderId,
      orderAmountCents: 6400,
      isFirstDelivery: true,
    });
    expect(res.discountCents).toBe(640); // 10% default

    const c = await adminClient();
    const d = await c.query(
      `select amount_cents, kind from public.discounts where id = $1`,
      [res.discountId],
    );
    const p = await c.query(
      `select redemptions from public.promo_codes where code = 'TEST-WELCOME'`,
    );
    await c.end();
    expect(d.rows[0]).toMatchObject({
      amount_cents: 640,
      kind: "first_delivery",
    });
    expect(p.rows[0].redemptions).toBe(1);
  });

  it("rejects an unknown code", async () => {
    await expect(
      redeemPromo({ code: "NOPE", orgId, orderId, orderAmountCents: 100 }),
    ).rejects.toThrow(PromoError);
  });

  it("enforces first-delivery-only", async () => {
    await createPromo({ code: "TEST-FIRST", firstDeliveryOnly: true });
    await expect(
      redeemPromo({
        code: "TEST-FIRST",
        orgId,
        orderId,
        orderAmountCents: 6400,
        isFirstDelivery: false,
      }),
    ).rejects.toThrow(/first-delivery only/);
  });

  it("enforces max redemptions atomically", async () => {
    await createPromo({ code: "TEST-ONCE", maxRedemptions: 1 });
    await redeemPromo({
      code: "TEST-ONCE",
      orgId,
      orderId,
      orderAmountCents: 1000,
      isFirstDelivery: true,
    });
    await expect(
      redeemPromo({
        code: "TEST-ONCE",
        orgId,
        orderId,
        orderAmountCents: 1000,
        isFirstDelivery: true,
      }),
    ).rejects.toThrow(/fully redeemed/);
  });

  it("rejects an expired code", async () => {
    await createPromo({
      code: "TEST-OLD",
      expiresAt: new Date("2020-01-01"),
    });
    await expect(
      redeemPromo({
        code: "TEST-OLD",
        orgId,
        orderId,
        orderAmountCents: 1000,
        isFirstDelivery: true,
      }),
    ).rejects.toThrow(/expired/);
  });
});
