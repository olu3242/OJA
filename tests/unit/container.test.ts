import { describe, expect, it } from "vitest";
import { planContainers } from "@/server/services/container";

describe("container-consolidation planner", () => {
  it("books zero containers when covered", () => {
    const plan = planContainers({
      weeklyDemandLbs: [{ skuCode: "GAR-WHT-IJEBU", lbs: 100 }],
      horizonWeeks: 12,
      onHandLbs: 2000,
      inboundLbs: 0,
    });
    expect(plan.shortfallLbs).toBe(0);
    expect(plan.containers).toBe(0);
  });

  it("sizes containers to the shortfall and allocates mix by demand share", () => {
    const plan = planContainers({
      weeklyDemandLbs: [
        { skuCode: "GAR-WHT-IJEBU", lbs: 1500 },
        { skuCode: "GAR-YEL", lbs: 500 },
      ],
      horizonWeeks: 12,
      onHandLbs: 1000,
      inboundLbs: 1000,
      capacityLbs: 24000,
    });
    // need 24000 − 2000 = 22000 → 1 container
    expect(plan.shortfallLbs).toBe(22000);
    expect(plan.containers).toBe(1);
    const white = plan.mix.find((m) => m.skuCode === "GAR-WHT-IJEBU")!;
    const yellow = plan.mix.find((m) => m.skuCode === "GAR-YEL")!;
    expect(white.lbs).toBe(18000); // 75% share
    expect(yellow.lbs).toBe(6000); // 25% share
  });

  it("flags urgent booking when cover is inside the lead time", () => {
    const plan = planContainers({
      weeklyDemandLbs: [{ skuCode: "GAR-WHT-IJEBU", lbs: 1000 }],
      horizonWeeks: 12,
      onHandLbs: 2000, // 2 weeks cover < 8-week lead time
      inboundLbs: 0,
    });
    expect(plan.orderByWeeks).toBe(0);
  });
});
