import Link from "next/link";
import { redirect } from "next/navigation";
import { currentAccount } from "@/lib/auth";
import { createCaller } from "@/server/router";
import { PageMain, PageTitle, SectionTitle, StatTile } from "@/components/ui";

export const metadata = { title: "Executive" };
export const dynamic = "force-dynamic";

const usd = (cents: number) => `$${(cents / 100).toFixed(2)}`;
const pct = (v: number | null) =>
  v == null ? "—" : `${(v * 100).toFixed(1)}%`;

/**
 * Executive dashboard (Execution 7) — a single high-level view composing the
 * already-exposed commerce, finance, and fulfilment KPIs. Read-only; degrades
 * gracefully when the canonical DB (payments/invoices) is unconfigured.
 */
export default async function ExecPage() {
  const account = await currentAccount();
  if (!account || account.role !== "ADMIN") redirect("/login");
  const caller = createCaller({ account });

  const [dash, pay, invoices] = await Promise.all([
    caller.admin.dashboard(),
    caller.admin.paymentMetrics().catch(() => null),
    caller.admin.invoiceTotals().catch(() => null),
  ]);

  return (
    <PageMain width="5xl">
      <div className="mb-6 flex items-center justify-between">
        <PageTitle>Executive summary</PageTitle>
        <Link href="/admin" className="text-sm text-oja-orange underline">
          ← north star
        </Link>
      </div>

      <SectionTitle className="mb-3">Growth</SectionTitle>
      <section className="mb-10 grid gap-3 sm:grid-cols-4">
        <StatTile
          label="Active subscribers"
          value={dash.subscribers.active}
          accent
        />
        <StatTile label="Paused" value={dash.subscribers.paused} />
        <StatTile label="Cancelled" value={dash.subscribers.cancelled} />
        {pay && <StatTile label="MRR" value={usd(pay.mrrCents)} />}
      </section>

      {pay && (
        <>
          <SectionTitle className="mb-3">Revenue & margin</SectionTitle>
          <section className="mb-10 grid gap-3 sm:grid-cols-4">
            <StatTile label="Net revenue" value={usd(pay.netCents)} accent />
            <StatTile
              label="GM after shipping"
              value={pct(dash.grossMarginAfterShipping)}
            />
            <StatTile label="Refund rate" value={`${pay.refundRatePct}%`} />
            {invoices && (
              <StatTile
                label="Outstanding"
                value={usd(invoices.outstandingCents)}
                accent={invoices.outstandingCents > 0}
              />
            )}
          </section>
        </>
      )}

      <SectionTitle className="mb-3">Operations</SectionTitle>
      <section className="grid gap-3 sm:grid-cols-3">
        <StatTile
          label="Cycle-confirm rate"
          value={pct(dash.cycleConfirmRate)}
        />
        <StatTile label="On-time ship" value={pct(dash.onTimeShipRate)} />
        <StatTile label="Forecast WAPE v1" value={pct(dash.wape.v1)} />
      </section>
    </PageMain>
  );
}
