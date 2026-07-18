import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { migrate } from "../../scripts/canonical";
import { adminClient } from "./helpers";
import { taxRateFor, taxCents, computeTax } from "@/server/repositories/tax";

describe("tax calculation", () => {
  beforeAll(async () => {
    await migrate();
    // A non-exempt region to prove non-zero rates resolve.
    const c = await adminClient();
    await c.query(
      `insert into public.tax_rates (country, region, name, rate)
       values ('US','CA-TEST','CA sales tax', 0.0725)
       on conflict do nothing`,
    );
    await c.end();
  });

  afterAll(async () => {
    const c = await adminClient();
    await c.query(`delete from public.tax_rates where region = 'CA-TEST'`);
    await c.end();
  });

  it("returns 0 for the zero-rated grocery jurisdictions (TX, ON)", async () => {
    expect(await taxRateFor("US", "TX")).toBe(0);
    expect(await taxRateFor("CA", "ON")).toBe(0);
  });

  it("resolves a region-specific rate", async () => {
    expect(await taxRateFor("US", "CA-TEST")).toBeCloseTo(0.0725, 4);
  });

  it("falls back to 0 when no rate is configured", async () => {
    expect(await taxRateFor("GB", "LDN")).toBe(0);
  });

  it("computes tax in minor units", async () => {
    expect(taxCents(10000, 0.0725)).toBe(725);
    expect(taxCents(9999, 0.0725)).toBe(725); // round-half-up
    const t = await computeTax(20000, "US", "CA-TEST");
    expect(t).toEqual({ rate: 0.0725, taxCents: 1450 });
    expect((await computeTax(20000, "US", "TX")).taxCents).toBe(0);
  });
});
