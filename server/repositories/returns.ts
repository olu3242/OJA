import { canonicalPool } from "@/lib/canonical-db";
import { issueCredit } from "@/server/repositories/payments";

/**
 * Returns / RMA flow (Execution 6) over the existing canonical `returns` table.
 * request → approve → close-with-credit: an approved return is settled by
 * crediting the customer's wallet (refund-to-credit), tying the credit back to
 * the return via `reference_id`. Status transitions are guarded so a return
 * can't be closed before approval.
 */
export type ReturnStatus = "requested" | "approved" | "waived" | "closed";

async function orgOfOrder(
  orderId: string,
): Promise<{ orgId: string; customerId: string }> {
  const r = await canonicalPool.query(
    `select organization_id, customer_id from public.orders where id = $1`,
    [orderId],
  );
  if (r.rowCount === 0) throw new Error(`order ${orderId} not found`);
  return {
    orgId: r.rows[0].organization_id,
    customerId: r.rows[0].customer_id,
  };
}

export async function requestReturn(input: {
  orderId: string;
  reasonCode: string;
  notes?: string;
}): Promise<{ id: string; status: ReturnStatus }> {
  const { orgId } = await orgOfOrder(input.orderId);
  const r = await canonicalPool.query(
    `insert into public.returns (organization_id, order_id, reason_code, status, notes)
     values ($1,$2,$3,'requested',$4)
     returning id, status`,
    [orgId, input.orderId, input.reasonCode, input.notes ?? null],
  );
  return { id: r.rows[0].id, status: r.rows[0].status };
}

export async function approveReturn(returnId: string): Promise<void> {
  const r = await canonicalPool.query(
    `update public.returns set status = 'approved'
      where id = $1 and status = 'requested'`,
    [returnId],
  );
  if (r.rowCount === 0) {
    throw new Error(`return ${returnId} not in 'requested' state`);
  }
}

export async function waiveReturn(returnId: string): Promise<void> {
  await canonicalPool.query(
    `update public.returns set status = 'waived' where id = $1 and status = 'requested'`,
    [returnId],
  );
}

/**
 * Settle an approved return by crediting the customer's wallet, then close it.
 * Idempotent-ish: closing an already-closed return is rejected.
 */
export async function closeReturnWithCredit(
  returnId: string,
  amountCents: number,
): Promise<{ walletBalanceCents: number }> {
  const ret = await canonicalPool.query(
    `select order_id, status, organization_id from public.returns where id = $1`,
    [returnId],
  );
  if (ret.rowCount === 0) throw new Error(`return ${returnId} not found`);
  if (ret.rows[0].status !== "approved") {
    throw new Error(
      `return ${returnId} must be 'approved' to close (is ${ret.rows[0].status})`,
    );
  }
  const { orgId, customerId } = await orgOfOrder(ret.rows[0].order_id);
  const credit = await issueCredit({
    orgId,
    customerId,
    amountCents,
    currency: "USD",
    reason: "return",
    referenceId: returnId,
  });
  await canonicalPool.query(
    `update public.returns set status = 'closed' where id = $1`,
    [returnId],
  );
  return credit;
}

export async function listReturns(status: ReturnStatus = "requested") {
  const r = await canonicalPool.query(
    `select id, order_id, reason_code, status, notes, created_at
       from public.returns
      where status = $1 and deleted_at is null
      order by created_at desc`,
    [status],
  );
  return r.rows;
}
