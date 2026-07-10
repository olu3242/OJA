import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { resetDb } from "../helpers";
import { subscribe, pause, swap } from "@/server/services/subscriptions";
import {
  confirmCycle,
  generateUpcomingCycles,
  skipCycle,
} from "@/server/services/cycles";
import {
  committedWeeklyByVariety,
  draftPoFromSuggestions,
  effectiveForecast,
  overrideForecast,
  reorderSuggestions,
  runForecast,
  seasonalIndex,
} from "@/server/services/forecast";

/**
 * Gate G2 (task 2.9): pantry management drives committed demand; the forecast
 * job turns it into reorder suggestions and a one-click PO draft; overrides
 * are versioned inserts with reason codes.
 */
describe("Gate G2 — pantry & demand engine v0 e2e", () => {
  let fx: Awaited<ReturnType<typeof resetDb>>;

  beforeAll(async () => {
    fx = await resetDb();
  });

  it("captures pantry management as demand events", async () => {
    const a = await subscribe({
      accountId: fx.household.id,
      plan: "STOCK_UP",
      variety: "WHITE_IJEBU",
      address: {
        line1: "1 Fufu Ln",
        city: "Dallas",
        state: "TX",
        zip: "75001",
      },
    });
    // Second household: subscribe then skip + pause (signal, not churn)
    const other = await db.account.create({
      data: { email: "tunde@test.gaarii", name: "Tunde", role: "HOUSEHOLD" },
    });
    const b = await subscribe({
      accountId: other.id,
      plan: "STARTER",
      variety: "YELLOW",
      address: { line1: "2 Eko St", city: "Austin", state: "TX", zip: "73301" },
    });
    await skipCycle(b.firstCycle.id);
    await pause(b.subscription.id);
    await swap(a.subscription.id, { grind: "FINE" });

    const types = (await db.demandEvent.findMany()).map((e) => e.type).sort();
    expect(types).toEqual(
      ["PAUSE", "SKIP", "SUBSCRIBE", "SUBSCRIBE", "SWAP"].sort(),
    );
  });

  it("computes committed weekly demand from ACTIVE subscriptions only", async () => {
    const committed = await committedWeeklyByVariety();
    // Stock-Up: 22 lb / 30 days × 7 ≈ 5.13 lb/week; paused Starter contributes 0
    expect(committed.WHITE_IJEBU).toBeCloseTo((22 / 30) * 7, 2);
    expect(committed.YELLOW).toBe(0);
  });

  it("runs the nightly forecast: versioned V0 + V1-shadow inserts", async () => {
    await runForecast({ now: new Date("2026-07-10T08:00:00Z") });
    const v0 = await db.forecast.findMany({ where: { source: "V0" } });
    const v1 = await db.forecast.findMany({ where: { source: "V1" } });
    expect(v0.length).toBe(8); // 2 SKUs × 4 weeks
    expect(v1.length).toBe(8);

    // Committed-demand floor: white forecast ≥ ceil(5.13) = 6 lb/week
    for (const f of v0.filter((f) => f.skuId === fx.white.id)) {
      expect(f.qtyUnits).toBeGreaterThanOrEqual(6);
    }

    // Re-running inserts a new version — never updates (ledger invariant)
    await runForecast({ now: new Date("2026-07-10T09:00:00Z") });
    const versions = await db.forecast.findMany({
      where: { source: "V0", skuId: fx.white.id },
      select: { version: true },
    });
    expect(new Set(versions.map((v) => v.version))).toEqual(new Set([1, 2]));
  });

  it("applies the seasonal events calendar in V1 shadow mode", () => {
    expect(seasonalIndex(new Date("2026-12-15"))).toBe(1.3); // Christmas
    expect(seasonalIndex(new Date("2026-03-03"))).toBe(1.0);
  });

  it("suggests reorders (forecast − on-hand − inbound + safety) and drafts a PO", async () => {
    const suggestions = await reorderSuggestions(fx.warehouse.id);
    const white = suggestions.find((s) => s.skuCode === "GAR-WHT-IJEBU");
    expect(white).toBeDefined();
    expect(white!.suggestedUnits).toBeGreaterThanOrEqual(30); // 4wk×6 + 6 safety, no stock

    const po = await draftPoFromSuggestions(fx.warehouse.id, fx.supplier.id);
    expect(po).not.toBeNull();
    expect(po!.status).toBe("DRAFT");
    expect(po!.lines.some((l) => l.skuId === fx.white.id)).toBe(true);
  });

  it("records overrides as versioned inserts with reason codes (task 2.7)", async () => {
    const base = await db.forecast.findFirstOrThrow({
      where: { source: "V0", skuId: fx.white.id },
      orderBy: { version: "desc" },
    });
    const override = await overrideForecast(
      base.id,
      base.qtyUnits + 50,
      "church-event-preorder",
    );
    expect(override.source).toBe("OVERRIDE");
    expect(override.overrideOfId).toBe(base.id);
    expect(override.reasonCode).toBe("church-event-preorder");

    const effective = await effectiveForecast(
      fx.white.id,
      fx.warehouse.id,
      base.weekStart,
    );
    expect(effective!.id).toBe(override.id); // override wins
  });

  it("generates the next cycle on cadence and nudges the subscriber (task 2.8)", async () => {
    // Resolve the open cycle first (one open cycle at a time)
    const openCycle = await db.cycle.findFirstOrThrow({
      where: {
        status: "UPCOMING",
        subscription: { accountId: fx.household.id },
      },
    });
    await confirmCycle(openCycle.id);

    const { created } = await generateUpcomingCycles();
    expect(created).toBeGreaterThanOrEqual(1);
    const nudges = await db.notificationLog.findMany({
      where: { template: "cycle_confirm_nudge" },
    });
    expect(nudges.length).toBeGreaterThanOrEqual(1);
  });
});
