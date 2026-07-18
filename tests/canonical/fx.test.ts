import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { migrate } from "../../scripts/canonical";
import { adminClient } from "./helpers";
import { upsertRate, getRate, convert } from "@/server/repositories/fx";

describe("foreign exchange", () => {
  beforeAll(async () => {
    await migrate();
    const c = await adminClient();
    await c.query(
      `delete from public.exchange_rates where base='USD' and quote='CAD'`,
    );
    await c.end();
    await upsertRate({
      base: "USD",
      quote: "CAD",
      rate: 1.35,
      asOf: new Date("2026-01-01"),
    });
    await upsertRate({
      base: "USD",
      quote: "CAD",
      rate: 1.4,
      asOf: new Date("2026-06-01"),
    });
  });

  afterAll(async () => {
    const c = await adminClient();
    await c.query(
      `delete from public.exchange_rates where base='USD' and quote='CAD'`,
    );
    await c.end();
  });

  it("same-currency conversion is identity", async () => {
    expect(await getRate("USD", "USD")).toBe(1);
    expect(await convert(5000, "USD", "USD")).toBe(5000);
  });

  it("uses the latest rate at or before the as-of date (historical FX)", async () => {
    expect(await getRate("USD", "CAD", new Date("2026-03-01"))).toBe(1.35);
    expect(await getRate("USD", "CAD", new Date("2026-07-01"))).toBe(1.4);
  });

  it("converts minor units at the dated rate", async () => {
    // $100.00 USD at 1.35 → $135.00 CAD
    expect(
      await convert(10000, "USD", "CAD", { asOf: new Date("2026-02-01") }),
    ).toBe(13500);
  });

  it("applies an FX buffer", async () => {
    // 1.4 × 1.02 = 1.428 → 10000 × 1.428 = 14280
    expect(
      await convert(10000, "USD", "CAD", {
        asOf: new Date("2026-06-15"),
        bufferPct: 0.02,
      }),
    ).toBe(14280);
  });

  it("throws when no rate is recorded", async () => {
    await expect(convert(100, "USD", "NGN")).rejects.toThrow(
      /no exchange rate/,
    );
  });
});
