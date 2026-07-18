import { randomBytes } from "node:crypto";
import { canonicalPool } from "@/lib/canonical-db";
import { resolveCustomer } from "@/server/repositories/payments";
import { computeTax } from "@/server/repositories/tax";

/**
 * Automatic invoice generation (WS10 scoped-next) over the existing canonical
 * `invoices` / `invoice_items` tables. Each line's tax is resolved from
 * `tax_rates` by the customer's country+region; subtotal/tax/total are summed
 * and stored. Invoice numbers are unique (`invoices.number` unique constraint).
 */
export type InvoiceLineInput = {
  description: string;
  qty?: number;
  unitPriceCents: number;
};

export type GeneratedInvoice = {
  id: string;
  number: string;
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  currency: string;
};

function invoiceNumber(): string {
  return `INV-${Date.now().toString(36).toUpperCase()}-${randomBytes(3)
    .toString("hex")
    .toUpperCase()}`;
}

export async function generateInvoice(input: {
  accountId: string;
  orderId?: string | null;
  currency?: string;
  country?: string;
  region?: string | null;
  dueAt?: Date | null;
  lines: InvoiceLineInput[];
}): Promise<GeneratedInvoice> {
  const resolved = await resolveCustomer(input.accountId);
  if (!resolved)
    throw new Error(`no canonical customer for ${input.accountId}`);
  if (input.lines.length === 0)
    throw new Error("invoice needs at least one line");
  const currency = input.currency ?? "USD";
  const country = input.country ?? "US";

  const client = await canonicalPool.connect();
  try {
    await client.query("begin");

    let subtotal = 0;
    let tax = 0;
    const lineRows: { desc: string; qty: number; unit: number }[] = [];
    for (const l of input.lines) {
      const qty = l.qty ?? 1;
      const lineTotal = qty * l.unitPriceCents;
      subtotal += lineTotal;
      tax += (await computeTax(lineTotal, country, input.region)).taxCents;
      lineRows.push({ desc: l.description, qty, unit: l.unitPriceCents });
    }
    const total = subtotal + tax;

    const inv = await client.query(
      `insert into public.invoices
         (organization_id, customer_id, order_id, number, currency,
          subtotal_cents, tax_cents, total_cents, due_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       returning id, number`,
      [
        resolved.orgId,
        resolved.customerId,
        input.orderId ?? null,
        invoiceNumber(),
        currency,
        subtotal,
        tax,
        total,
        input.dueAt ?? null,
      ],
    );
    const invoiceId = inv.rows[0].id as string;

    for (const l of lineRows) {
      await client.query(
        `insert into public.invoice_items
           (organization_id, invoice_id, description, qty, unit_price_cents)
         values ($1,$2,$3,$4,$5)`,
        [resolved.orgId, invoiceId, l.desc, l.qty, l.unit],
      );
    }

    await client.query("commit");
    return {
      id: invoiceId,
      number: inv.rows[0].number,
      subtotalCents: subtotal,
      taxCents: tax,
      totalCents: total,
      currency,
    };
  } catch (e) {
    await client.query("rollback");
    throw e;
  } finally {
    client.release();
  }
}

export async function listInvoices(accountId: string) {
  const resolved = await resolveCustomer(accountId);
  if (!resolved) return [];
  const r = await canonicalPool.query(
    `select id, number, currency, subtotal_cents, tax_cents, total_cents,
            due_at, paid_at, created_at
       from public.invoices
      where customer_id = $1 and deleted_at is null
      order by created_at desc`,
    [resolved.customerId],
  );
  // bigint cents columns arrive as strings from node-pg → coerce to numbers.
  return r.rows.map((row) => ({
    id: row.id as string,
    number: row.number as string,
    currency: row.currency as string,
    subtotalCents: Number(row.subtotal_cents),
    taxCents: Number(row.tax_cents),
    totalCents: Number(row.total_cents),
    dueAt: row.due_at as Date | null,
    paidAt: row.paid_at as Date | null,
    createdAt: row.created_at as Date,
  }));
}

export async function markInvoicePaid(invoiceId: string): Promise<void> {
  await canonicalPool.query(
    `update public.invoices set paid_at = now()::date, version = version + 1
      where id = $1 and paid_at is null`,
    [invoiceId],
  );
}

export type InvoiceTotals = {
  invoiceCount: number;
  outstandingCents: number;
  paidCents: number;
};

/** Finance roll-up: outstanding (unpaid) vs paid invoice totals. */
export async function invoiceTotals(): Promise<InvoiceTotals> {
  const r = await canonicalPool.query(
    `select
       count(*)::int n,
       coalesce(sum(total_cents) filter (where paid_at is null), 0) outstanding,
       coalesce(sum(total_cents) filter (where paid_at is not null), 0) paid
     from public.invoices where deleted_at is null`,
  );
  return {
    invoiceCount: Number(r.rows[0].n),
    outstandingCents: Number(r.rows[0].outstanding),
    paidCents: Number(r.rows[0].paid),
  };
}
