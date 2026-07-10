import { describe, expect, it } from "vitest";
import {
  PLANS,
  grossMargin,
  meetsMarginFloor,
  zoneSurchargeCents,
} from "@/lib/pricing";

describe("Garri plans", () => {
  it("defines exactly the three margin-protected plans", () => {
    expect(Object.keys(PLANS)).toEqual(["STARTER", "FAMILY", "STOCK_UP"]);
    expect(PLANS.STARTER.priceMinCents).toBe(2400);
    expect(PLANS.STARTER.priceMaxCents).toBe(3400);
    expect(PLANS.FAMILY.priceMinCents).toBe(4900);
    expect(PLANS.FAMILY.priceMaxCents).toBe(7900);
    expect(PLANS.STOCK_UP.priceMinCents).toBe(8900);
    expect(PLANS.STOCK_UP.priceMaxCents).toBe(11900);
  });

  it("keeps default prices inside the published ranges, Family as hero", () => {
    for (const plan of Object.values(PLANS)) {
      expect(plan.defaultPriceCents).toBeGreaterThanOrEqual(plan.priceMinCents);
      expect(plan.defaultPriceCents).toBeLessThanOrEqual(plan.priceMaxCents);
      expect(plan.defaultLbs).toBeGreaterThanOrEqual(plan.lbsMin);
      expect(plan.defaultLbs).toBeLessThanOrEqual(plan.lbsMax);
    }
    expect(PLANS.FAMILY.hero).toBe(true);
  });

  it("clears the 30% GM floor at default prices with modeled all-in costs", () => {
    // All-in cost model per MARGIN_AND_SHIPPING_MODEL.md: product $1.50/lb,
    // packaging $2, commercial parcel rate by weight band (low-zone table:
    // ~$9.70 for 5 lb, ~$13.33 for 10 lb), ~3% payment, 2% shrink. Starter
    // only clears the floor at commercial rates — the doc's explicit warning.
    const parcel = { STARTER: 1000, FAMILY: 1900, STOCK_UP: 2850 } as const;
    for (const [key, plan] of Object.entries(PLANS)) {
      const cost =
        plan.defaultLbs * 150 +
        200 +
        parcel[key as keyof typeof parcel] +
        Math.round(plan.defaultPriceCents * 0.03) +
        Math.round(plan.defaultPriceCents * 0.02);
      expect(
        meetsMarginFloor(plan.defaultPriceCents, cost),
        `${key} below floor`,
      ).toBe(true);
    }
  });

  it("applies zone surcharges for expensive states only", () => {
    expect(zoneSurchargeCents("AK")).toBe(1500);
    expect(zoneSurchargeCents("hi")).toBe(1500);
    expect(zoneSurchargeCents("TX")).toBe(0);
  });

  it("computes gross margin", () => {
    expect(grossMargin(10000, 7000)).toBeCloseTo(0.3);
  });
});
