import { beforeAll, describe, expect, it } from "vitest";
import { migrate } from "../../scripts/canonical";
import { adminClient } from "./helpers";
import { resetDb } from "../helpers";
import { convergeAccount } from "@/server/repositories/convergence";
import { resolveCustomer } from "@/server/repositories/payments";
import {
  requestReturn,
  approveReturn,
  closeReturnWithCredit,
  listReturns,
} from "@/server/repositories/returns";

describe("returns / RMA flow", () => {
  let orderId: string;
  let customerId: string;

  beforeAll(async () => {
    await migrate();
    const fx = await resetDb();
    await convergeAccount(fx.household.id);
    const resolved = await resolveCustomer(fx.household.id);
    customerId = resolved!.customerId;
    // Insert a canonical order to return against.
    const c = await adminClient();
    await c.query(`delete from public.returns`);
    const o = await c.query(
      `insert into public.orders
         (organization_id, customer_id, status, currency, subtotal_cents, total_cents,
          ship_line1, ship_city, ship_region, ship_postal_code, ship_country)
       values ($1,$2,'delivered','USD',6400,6400,'1 St','Houston','TX','77001','US')
       returning id`,
      [resolved!.orgId, customerId],
    );
    orderId = o.rows[0].id;
    await c.end();
  });

  it("requests → approves → closes with a wallet credit", async () => {
    const req = await requestReturn({
      orderId,
      reasonCode: "damaged",
      notes: "bag torn in transit",
    });
    expect(req.status).toBe("requested");

    await approveReturn(req.id);
    const credit = await closeReturnWithCredit(req.id, 6400);
    expect(credit.walletBalanceCents).toBeGreaterThanOrEqual(6400);

    const c = await adminClient();
    const ret = await c.query(
      `select status from public.returns where id = $1`,
      [req.id],
    );
    const cr = await c.query(
      `select amount_cents, reason, reference_id from public.credits
         where reference_id = $1`,
      [req.id],
    );
    await c.end();
    expect(ret.rows[0].status).toBe("closed");
    expect(cr.rows[0]).toMatchObject({ amount_cents: 6400, reason: "return" });
  });

  it("cannot close a return that was not approved", async () => {
    const req = await requestReturn({ orderId, reasonCode: "quality" });
    await expect(closeReturnWithCredit(req.id, 100)).rejects.toThrow(
      /must be 'approved'/,
    );
  });

  it("cannot approve a return twice (guarded transition)", async () => {
    const req = await requestReturn({ orderId, reasonCode: "late" });
    await approveReturn(req.id);
    await expect(approveReturn(req.id)).rejects.toThrow(/not in 'requested'/);
  });

  it("lists requested returns", async () => {
    const list = await listReturns("requested");
    expect(list.every((r) => r.status === "requested")).toBe(true);
  });
});
