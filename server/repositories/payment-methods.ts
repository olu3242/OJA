import { canonicalPool } from "@/lib/canonical-db";
import { resolveCustomer } from "@/server/repositories/payments";

/**
 * Payment-method vault (Execution 2 onboarding / Execution 5 payment). Writes the
 * EXISTING canonical `payment_methods` table — no schema is replaced. Only a
 * gateway TOKEN (`provider_ref`) plus the display-safe brand/last4/expiry is
 * stored; a raw PAN never touches this system (PCI scope stays with the gateway).
 * The "exactly one default per customer" invariant is enforced transactionally:
 * the first saved method becomes the default, and promoting one demotes the rest.
 */
export type PaymentMethod = {
  id: string;
  provider: string;
  brand: string | null;
  last4: string | null;
  expMonth: number | null;
  expYear: number | null;
  isDefault: boolean;
};

function mapRow(r: Record<string, unknown>): PaymentMethod {
  return {
    id: r.id as string,
    provider: r.provider as string,
    brand: (r.brand as string | null) ?? null,
    last4:
      r.last4 === null || r.last4 === undefined ? null : String(r.last4).trim(),
    expMonth: r.exp_month === null ? null : Number(r.exp_month),
    expYear: r.exp_year === null ? null : Number(r.exp_year),
    isDefault: r.is_default as boolean,
  };
}

/**
 * Vault a tokenized payment method for the account's canonical customer. Becomes
 * the default when it is the customer's first method or `makeDefault` is set.
 */
export async function savePaymentMethod(input: {
  accountId: string;
  providerRef: string;
  provider?: string;
  brand?: string | null;
  last4?: string | null;
  expMonth?: number | null;
  expYear?: number | null;
  makeDefault?: boolean;
}): Promise<PaymentMethod> {
  const resolved = await resolveCustomer(input.accountId);
  if (!resolved) {
    throw new Error(`no canonical customer for account ${input.accountId}`);
  }
  const provider = input.provider ?? "stripe";
  const c = await canonicalPool.connect();
  try {
    await c.query("begin");
    const existing = await c.query(
      `select count(*)::int as n from public.payment_methods
        where customer_id = $1 and deleted_at is null`,
      [resolved.customerId],
    );
    const isFirst = Number(existing.rows[0].n) === 0;
    const makeDefault = isFirst || input.makeDefault === true;
    if (makeDefault) {
      await c.query(
        `update public.payment_methods set is_default = false
          where customer_id = $1 and deleted_at is null and is_default = true`,
        [resolved.customerId],
      );
    }
    const row = await c.query(
      `insert into public.payment_methods
         (organization_id, customer_id, provider, provider_ref, brand, last4,
          exp_month, exp_year, is_default)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       returning id, provider, brand, last4, exp_month, exp_year, is_default`,
      [
        resolved.orgId,
        resolved.customerId,
        provider,
        input.providerRef,
        input.brand ?? null,
        input.last4 ?? null,
        input.expMonth ?? null,
        input.expYear ?? null,
        makeDefault,
      ],
    );
    await c.query("commit");
    return mapRow(row.rows[0]);
  } catch (e) {
    await c.query("rollback");
    throw e;
  } finally {
    c.release();
  }
}

/** All vaulted methods for the account, default first, newest next. */
export async function listPaymentMethods(
  accountId: string,
): Promise<PaymentMethod[]> {
  const resolved = await resolveCustomer(accountId);
  if (!resolved) return [];
  const r = await canonicalPool.query(
    `select id, provider, brand, last4, exp_month, exp_year, is_default
       from public.payment_methods
      where customer_id = $1 and deleted_at is null
      order by is_default desc, created_at desc`,
    [resolved.customerId],
  );
  return r.rows.map(mapRow);
}

/** Promote one method to default, demoting the customer's others (transactional). */
export async function setDefaultPaymentMethod(
  accountId: string,
  methodId: string,
): Promise<PaymentMethod> {
  const resolved = await resolveCustomer(accountId);
  if (!resolved) {
    throw new Error(`no canonical customer for account ${accountId}`);
  }
  const c = await canonicalPool.connect();
  try {
    await c.query("begin");
    const owned = await c.query(
      `select id from public.payment_methods
        where id = $1 and customer_id = $2 and deleted_at is null`,
      [methodId, resolved.customerId],
    );
    if (owned.rowCount === 0) {
      throw new Error(`payment method ${methodId} not found for customer`);
    }
    await c.query(
      `update public.payment_methods set is_default = false
        where customer_id = $1 and deleted_at is null and id <> $2`,
      [resolved.customerId, methodId],
    );
    const row = await c.query(
      `update public.payment_methods set is_default = true
        where id = $1
        returning id, provider, brand, last4, exp_month, exp_year, is_default`,
      [methodId],
    );
    await c.query("commit");
    return mapRow(row.rows[0]);
  } catch (e) {
    await c.query("rollback");
    throw e;
  } finally {
    c.release();
  }
}
