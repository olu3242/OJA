import { describe, expect, it } from "vitest";
import { markdownPct, shelfLifeRemaining } from "@/server/services/markdown";

describe("expiry markdown ladder (Fresh Deals)", () => {
  it("follows the −15%/−30% ladder", () => {
    expect(markdownPct(0.9)).toBe(0);
    expect(markdownPct(0.4)).toBe(0.15);
    expect(markdownPct(0.25)).toBe(0.15);
    expect(markdownPct(0.2)).toBe(0.3);
    expect(markdownPct(0.05)).toBe(0.3);
  });

  it("computes shelf-life fraction remaining", () => {
    const received = new Date("2026-01-01");
    const expires = new Date("2026-12-31");
    const halfway = new Date("2026-07-01");
    const r = shelfLifeRemaining(received, expires, halfway);
    expect(r).toBeGreaterThan(0.45);
    expect(r).toBeLessThan(0.55);
    expect(shelfLifeRemaining(received, expires, new Date("2027-01-05"))).toBe(
      0,
    );
  });
});
