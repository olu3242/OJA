import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { resetDb } from "../helpers";
import {
  createGroupOrder,
  closeGroupOrder,
  joinGroupOrder,
} from "@/server/services/group";
import { ingestSellThrough, sellThroughWeekly } from "@/server/services/pos";
import {
  approveWholesaleLead,
  createStandingOrder,
} from "@/server/services/wholesale";
import { electFastPay, supplierPortalView } from "@/server/services/supplier";
import {
  recommendForecastSource,
  runForecast,
} from "@/server/services/forecast";
import { createPurchaseOrder } from "@/server/services/procurement";
import { subscribe } from "@/server/services/subscriptions";

/** Phase 2/3 channels: group buying, POS ingestion, wholesale, supplier portal, Canada. */
describe("Phase 2/3 — channels & expansion", () => {
  let fx: Awaited<ReturnType<typeof resetDb>>;

  beforeAll(async () => {
    fx = await resetDb();
  });

  it("aggregates a group order into one discounted delivery (tasks 3.3/4.4)", async () => {
    const g = await createGroupOrder(fx.household.id, {
      line1: "RCCG Parish Hall",
      city: "Katy",
      state: "TX",
      zip: "77494",
    });

    // 6 Family members → 6 × $64 = $384 gross → 5% tier
    for (let i = 0; i < 6; i++) {
      const member = await db.account.create({
        data: {
          email: `member${i}@test.gaarii`,
          name: `Member ${i}`,
          role: "HOUSEHOLD",
        },
      });
      await joinGroupOrder(
        g.code,
        member.id,
        "FAMILY",
        i % 2 ? "YELLOW" : "WHITE_IJEBU",
      );
    }

    const { order, discount, members } = await closeGroupOrder(g.code);
    expect(members).toBe(6);
    expect(discount).toBe(0.05);
    expect(order.status).toBe("PAID");
    expect(order.lines).toHaveLength(2); // both varieties aggregated
    expect(order.lines.reduce((s, l) => s + l.qtyUnits, 0)).toBe(72); // 6 × 12 lb
    expect(order.totalCents).toBe(6 * Math.round(6400 * 0.95));

    // Idempotency: closing twice fails cleanly
    await expect(closeGroupOrder(g.code)).rejects.toThrow(/CLOSED/);
  });

  it("ingests POS sell-through into the demand-event stream (task 4.2)", async () => {
    const store = await db.account.create({
      data: {
        email: "store@test.gaarii",
        name: "Mama Ngozi",
        role: "STORE",
        b2bVerified: true,
      },
    });
    const results = await ingestSellThrough({
      source: "square",
      storeAccountId: store.id,
      entries: [
        { skuCode: "GAR-WHT-IJEBU", unitsSold: 40, periodEnd: "2026-07-09" },
        { skuCode: "GAR-YEL", unitsSold: 15, periodEnd: "2026-07-09" },
        { skuCode: "NOT-A-SKU", unitsSold: 5, periodEnd: "2026-07-09" },
      ],
    });
    expect(results.filter((r) => r.accepted)).toHaveLength(2);
    expect(results.find((r) => r.skuCode === "NOT-A-SKU")!.accepted).toBe(
      false,
    );

    const weekly = await sellThroughWeekly(
      fx.white.id,
      new Date(Date.now() - 7 * 24 * 3600 * 1000),
    );
    expect(weekly).toBe(40);
  });

  it("graduates a waitlist lead into a verified store with a standing order (tasks 2.4/4.6)", async () => {
    const lead = await db.wholesaleLead.create({
      data: {
        businessName: "Bissonnet Afro Market",
        email: "buyer@bissonnet.test",
        businessType: "store",
      },
    });
    const account = await approveWholesaleLead(lead.id);
    expect(account.role).toBe("STORE");
    expect(account.b2bVerified).toBe(true);

    const standing = await createStandingOrder({
      accountId: account.id,
      variety: "WHITE_IJEBU",
      qtyLbs: 100,
    });
    expect(standing.cadenceDays).toBe(7);
    expect(standing.qtyLbs).toBe(100);
    expect(standing.priceCents).toBe(183 * 100); // landed 150 × 1.22 per lb

    // Guardrail: unverified households can't open wholesale standing orders
    await expect(
      createStandingOrder({
        accountId: fx.household.id,
        variety: "YELLOW",
        qtyLbs: 100,
      }),
    ).rejects.toThrow(/verified B2B/);
  });

  it("shares forward forecast + fast-pay election on the supplier portal (task 4.5)", async () => {
    await createPurchaseOrder({
      supplierId: fx.supplier.id,
      warehouseId: fx.warehouse.id,
      place: true,
      lines: [{ skuId: fx.white.id, qtyUnits: 200, unitCostCents: 150 }],
    });
    await runForecast();

    const view = await supplierPortalView(fx.supplier.id);
    expect(view.forecastShare).toHaveLength(1);
    expect(view.forecastShare[0].skuCode).toBe("GAR-WHT-IJEBU");
    expect(view.forecastShare[0].weeks).toHaveLength(4);
    expect(view.openPos).toHaveLength(1);

    const updated = await electFastPay(fx.supplier.id, true);
    expect(updated.fastPay).toBe(true);
  });

  it("keeps V1 in shadow until it beats V0 on WAPE (task 4.1 cutover gate)", async () => {
    const rec = await recommendForecastSource();
    expect(rec.recommended).toBe("V0"); // no proven V1 win yet
  });

  it("subscribes a Canadian household in CAD with province guardrails (task 5.3)", async () => {
    const eze = await db.account.create({
      data: { email: "eze@test.gaarii", name: "Eze", role: "HOUSEHOLD" },
    });
    const { subscription } = await subscribe({
      accountId: eze.id,
      plan: "FAMILY",
      variety: "WHITE_IJEBU",
      address: {
        line1: "22 Danforth Ave",
        city: "Toronto",
        state: "ON",
        zip: "M4K1N2",
        country: "CA",
      },
    });
    expect(subscription.currency).toBe("CAD");
    expect(subscription.priceCents).toBe(9300);

    const north = await db.account.create({
      data: { email: "north@test.gaarii", name: "North", role: "HOUSEHOLD" },
    });
    const remote = await subscribe({
      accountId: north.id,
      plan: "STARTER",
      variety: "YELLOW",
      address: {
        line1: "1 Tundra Way",
        city: "Iqaluit",
        state: "NU",
        zip: "X0A0H0",
        country: "CA",
      },
    });
    expect(remote.subscription.priceCents).toBe(
      Math.round((2900 * 1.45) / 100) * 100 + 2000, // CAD base + territory surcharge
    );
  });
});
