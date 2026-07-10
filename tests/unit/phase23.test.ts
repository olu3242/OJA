import { describe, expect, it } from "vitest";
import { groupDiscountPct } from "@/server/services/group";
import {
  quarterlyRebateCents,
  slaCreditCents,
  wholesaleUnitPriceCents,
} from "@/server/services/wholesale";
import { planPrice, regionSurchargeCents } from "@/lib/pricing";

describe("group-order discount ladder (PRICING_STRATEGY §3)", () => {
  it("tiers by aggregated order value", () => {
    expect(groupDiscountPct(20_000)).toBe(0);
    expect(groupDiscountPct(30_000)).toBe(0.05);
    expect(groupDiscountPct(75_000)).toBe(0.1);
    expect(groupDiscountPct(150_000)).toBe(0.15);
  });
});

describe("wholesale economics (PRICING_STRATEGY §4)", () => {
  it("prices wholesale at landed cost × markup band", () => {
    expect(wholesaleUnitPriceCents(150)).toBe(183); // 1.22×
  });
  it("credits 2× the shortfall value on SLA breach", () => {
    expect(slaCreditCents(5000)).toBe(10_000);
  });
  it("pays 1.5% rebate only above $12k/quarter", () => {
    expect(quarterlyRebateCents(1_000_000)).toBe(0);
    expect(quarterlyRebateCents(1_500_000)).toBe(22_500);
  });
});

describe("Canada readiness (task 5.3)", () => {
  it("prices CAD plans with the FX buffer, rounded to whole dollars", () => {
    const family = planPrice("FAMILY", "CA");
    expect(family.currency).toBe("CAD");
    expect(family.cents).toBe(9300); // 6400 × 1.45 ≈ 9280 → 9300
    expect(planPrice("FAMILY", "US")).toEqual({ currency: "USD", cents: 6400 });
  });
  it("surcharges remote territories, not provinces", () => {
    expect(regionSurchargeCents("CA", "NU")).toBe(2000);
    expect(regionSurchargeCents("CA", "ON")).toBe(0);
    expect(regionSurchargeCents("US", "AK")).toBe(1500);
  });
});
