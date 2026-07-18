import { beforeAll, describe, expect, it } from "vitest";
import { migrate } from "../../scripts/canonical";
import { adminClient } from "./helpers";
import { resetDb } from "../helpers";
import { convergeAccount } from "@/server/repositories/convergence";
import {
  generateInvoice,
  listInvoices,
  markInvoicePaid,
  invoiceTotals,
} from "@/server/repositories/invoices";

describe("invoice generation", () => {
  let household: { id: string };

  beforeAll(async () => {
    await migrate();
    const fx = await resetDb();
    household = fx.household;
    const c = await adminClient();
    await c.query(`delete from public.invoice_items`);
    await c.query(`delete from public.invoices`);
    await c.end();
    // Fresh legacy id each run → converge creates its canonical customer + org.
    await convergeAccount(household.id);
  });

  it("generates an invoice with line items and correct totals", async () => {
    const inv = await generateInvoice({
      accountId: household.id,
      country: "US",
      region: "TX", // grocery-exempt → 0 tax
      lines: [
        {
          description: "Family garri subscription",
          qty: 1,
          unitPriceCents: 6400,
        },
        {
          description: "Delivery-zone surcharge",
          qty: 1,
          unitPriceCents: 1500,
        },
      ],
    });
    expect(inv.subtotalCents).toBe(7900);
    expect(inv.taxCents).toBe(0); // TX grocery exemption
    expect(inv.totalCents).toBe(7900);
    expect(inv.number).toMatch(/^INV-/);

    const c = await adminClient();
    const items = await c.query(
      `select count(*)::int n from public.invoice_items where invoice_id = $1`,
      [inv.id],
    );
    await c.end();
    expect(items.rows[0].n).toBe(2);
  });

  it("applies tax for a non-exempt region", async () => {
    const c = await adminClient();
    await c.query(
      `insert into public.tax_rates (country, region, name, rate)
       values ('US','NV-INV','NV tax',0.0685) on conflict do nothing`,
    );
    await c.end();
    const inv = await generateInvoice({
      accountId: household.id,
      country: "US",
      region: "NV-INV",
      lines: [{ description: "one-time", unitPriceCents: 10000 }],
    });
    expect(inv.taxCents).toBe(685);
    expect(inv.totalCents).toBe(10685);
  });

  it("lists invoices and marks one paid; totals reconcile", async () => {
    const list = await listInvoices(household.id);
    expect(list.length).toBeGreaterThanOrEqual(2);

    const before = await invoiceTotals();
    expect(before.outstandingCents).toBeGreaterThan(0);

    await markInvoicePaid(list[0].id);
    const after = await invoiceTotals();
    expect(after.paidCents).toBe(before.paidCents + list[0].totalCents);
    expect(after.outstandingCents).toBe(
      before.outstandingCents - list[0].totalCents,
    );
  });

  it("rejects an empty invoice", async () => {
    await expect(
      generateInvoice({ accountId: household.id, lines: [] }),
    ).rejects.toThrow(/at least one line/);
  });
});
