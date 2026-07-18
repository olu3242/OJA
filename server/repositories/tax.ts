import { canonicalPool } from "@/lib/canonical-db";

/**
 * Tax calculation (WS10 scoped-next) over the existing canonical `tax_rates`
 * table. Groceries are largely zero-rated (US/TX exemption, CA basic-grocery
 * zero-rating are seeded at 0), but the module resolves any configured
 * country+region rate so non-exempt jurisdictions or future VAT slot in without
 * code changes. Region-specific rates win over a country-wide fallback.
 */
export async function taxRateFor(
  country: string,
  region?: string | null,
): Promise<number> {
  const r = await canonicalPool.query(
    `select rate
       from public.tax_rates
      where active = true and country = $1
        and (region = $2 or region is null)
      order by (region is null) asc
      limit 1`,
    [country, region ?? null],
  );
  return r.rowCount ? Number(r.rows[0].rate) : 0;
}

/** Tax in minor units for an amount at a given rate (banker-free round-half-up). */
export function taxCents(amountCents: number, rate: number): number {
  return Math.round(amountCents * rate);
}

export type TaxResult = { rate: number; taxCents: number };

export async function computeTax(
  amountCents: number,
  country: string,
  region?: string | null,
): Promise<TaxResult> {
  const rate = await taxRateFor(country, region);
  return { rate, taxCents: taxCents(amountCents, rate) };
}
