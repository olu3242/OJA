import Link from "next/link";
import { redirect } from "next/navigation";
import { currentAccount } from "@/lib/auth";
import { createCaller } from "@/server/router";
import {
  EmptyState,
  PageMain,
  PageTitle,
  SectionTitle,
  StatTile,
} from "@/components/ui";

export const metadata = { title: "Finance" };
export const dynamic = "force-dynamic";

const usd = (cents: number) => `$${(cents / 100).toFixed(2)}`;

/**
 * Finance dashboard (WS10 / Execution 7). Live roll-up over the canonical
 * payment ledger + invoices; tolerates an unconfigured canonical DB by
 * degrading each tile rather than failing the page.
 */
export default async function FinancePage() {
  const account = await currentAccount();
  if (!account || account.role !== "ADMIN") redirect("/login");
  const caller = createCaller({ account });

  const [pay, invoices, dlqDepth] = await Promise.all([
    caller.admin.paymentMetrics().catch(() => null),
    caller.admin.invoiceTotals().catch(() => null),
    caller.admin.deadLetterCount().catch(() => 0),
  ]);

  return (
    <PageMain width="5xl">
      <div className="mb-6 flex items-center justify-between">
        <PageTitle>Finance</PageTitle>
        <Link href="/admin" className="text-sm text-oja-orange underline">
          ← north star
        </Link>
      </div>

      {!pay && !invoices && (
        <EmptyState>
          Finance metrics require the canonical database (convergence).
          Configure
          <code> SUPABASE_DB_URL</code> to populate this dashboard.
        </EmptyState>
      )}

      {pay && (
        <section className="mb-10">
          <SectionTitle className="mb-3">Revenue (ledger)</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-4">
            <StatTile label="Net revenue" value={usd(pay.netCents)} accent />
            <StatTile label="MRR" value={usd(pay.mrrCents)} />
            <StatTile label="Captured" value={usd(pay.capturedCents)} />
            <StatTile label="Refunded" value={usd(pay.refundedCents)} />
          </div>
        </section>
      )}

      {(pay || invoices) && (
        <section className="mb-10">
          <SectionTitle className="mb-3">Billing & health</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-4">
            {invoices && (
              <>
                <StatTile
                  label="Outstanding invoices"
                  value={usd(invoices.outstandingCents)}
                  accent={invoices.outstandingCents > 0}
                />
                <StatTile
                  label="Paid invoices"
                  value={usd(invoices.paidCents)}
                />
                <StatTile label="Invoices" value={invoices.invoiceCount} />
              </>
            )}
            {pay && (
              <StatTile label="Refund rate" value={`${pay.refundRatePct}%`} />
            )}
            <StatTile
              label="Dead letters"
              value={dlqDepth}
              accent={dlqDepth > 0}
            />
          </div>
        </section>
      )}
    </PageMain>
  );
}
