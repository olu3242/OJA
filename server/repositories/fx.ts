import { canonicalPool } from "@/lib/canonical-db";

/**
 * Foreign-exchange (WS10 scoped-next) over the existing canonical
 * `exchange_rates` table. Stores dated rates (historical FX preserved) and
 * converts amounts, applying an optional FX buffer (spread) for pricing safety.
 * A same-currency conversion is always identity; a missing rate throws rather
 * than silently mis-pricing.
 */
export async function upsertRate(input: {
  base: string;
  quote: string;
  rate: number;
  asOf?: Date;
}): Promise<void> {
  const asOf = (input.asOf ?? new Date()).toISOString().slice(0, 10);
  await canonicalPool.query(
    `insert into public.exchange_rates (base, quote, rate, as_of)
     values ($1,$2,$3,$4::date)
     on conflict (base, quote, as_of) do update set rate = excluded.rate`,
    [input.base, input.quote, input.rate, asOf],
  );
}

/** Latest rate at or before `asOf` (default today); null if none recorded. */
export async function getRate(
  base: string,
  quote: string,
  asOf?: Date,
): Promise<number | null> {
  if (base === quote) return 1;
  const on = (asOf ?? new Date()).toISOString().slice(0, 10);
  const r = await canonicalPool.query(
    `select rate from public.exchange_rates
      where base = $1 and quote = $2 and as_of <= $3::date
      order by as_of desc limit 1`,
    [base, quote, on],
  );
  return r.rowCount ? Number(r.rows[0].rate) : null;
}

export type ConvertOptions = { asOf?: Date; bufferPct?: number };

/**
 * Convert minor units between currencies using the latest recorded rate.
 * `bufferPct` (e.g. 0.02 for 2%) widens the rate in the customer-unfavourable
 * direction to absorb FX drift; omit for a raw conversion.
 */
export async function convert(
  amountCents: number,
  from: string,
  to: string,
  opts: ConvertOptions = {},
): Promise<number> {
  if (from === to) return amountCents;
  const rate = await getRate(from, to, opts.asOf);
  if (rate === null) {
    throw new Error(`no exchange rate for ${from}->${to}`);
  }
  const buffered = rate * (1 + (opts.bufferPct ?? 0));
  return Math.round(amountCents * buffered);
}
