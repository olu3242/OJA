import { Fragment } from "react";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { currentAccount } from "@/lib/auth";
import { createCaller } from "@/server/router";
import { draftPoAction, placePoAction, runForecastAction } from "@/lib/actions";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  PageMain,
  PageTitle,
  SectionTitle,
  StatTile,
} from "@/components/ui";

export const metadata = { title: "Admin" };
export const dynamic = "force-dynamic";

function pct(v: number | null) {
  return v == null ? "—" : `${(v * 100).toFixed(1)}%`;
}

export default async function AdminPage() {
  const account = await currentAccount();
  if (!account || account.role !== "ADMIN") redirect("/login");
  const caller = createCaller({ account });

  const [dash, warehouse, suppliers, leads] = await Promise.all([
    caller.admin.dashboard(),
    db.warehouse.findFirst(),
    caller.admin.suppliers(),
    caller.admin.wholesaleLeads(),
  ]);
  const suggestions = warehouse
    ? await caller.admin.reorderSuggestions({ warehouseId: warehouse.id })
    : [];
  const draftPos = await db.purchaseOrder.findMany({
    where: { status: "DRAFT" },
    include: { lines: { include: { sku: true } } },
  });
  const containerPlan = warehouse
    ? await caller.admin.containerPlan({ warehouseId: warehouse.id })
    : null;
  const freshDeals = await caller.admin.freshDeals();
  // Convergence phase 2 dual-read panel — tolerate an unconfigured canonical DB.
  const parity = await caller.admin.convergenceParity().catch(() => null);
  // Read cutover: commerce KPI tiles from canonical when the flag is on, else
  // legacy — tolerate an unconfigured canonical DB by falling back to `dash`.
  const commerce = await caller.admin.commerceKpis().catch(() => null);
  const commerceSource = commerce?.source ?? "legacy";
  const activeSubs =
    commerce?.kpis.activeSubscriptions ?? dash.subscribers.active;
  const refundedOrders = commerce?.kpis.refundedOrders ?? dash.refunds;
  // Payment ledger KPIs (WS10) — tolerate an unconfigured canonical DB.
  const pay = await caller.admin.paymentMetrics().catch(() => null);
  // Dead-letter queue depth (WS9) — ops signal for stuck webhook/event handlers.
  const dlqDepth = await caller.admin.deadLetterCount().catch(() => 0);

  const tiles: [string, string][] = [
    [`Active subscribers · ${commerceSource}`, String(activeSubs)],
    ["Cycle-confirm rate", pct(dash.cycleConfirmRate)],
    ["On-time ship rate", pct(dash.onTimeShipRate)],
    ["GM after shipping", pct(dash.grossMarginAfterShipping)],
    ["WAPE v0 / v1", `${pct(dash.wape.v0)} / ${pct(dash.wape.v1)}`],
    [`Refunded orders · ${commerceSource}`, String(refundedOrders)],
  ];

  return (
    <PageMain width="5xl">
      <div className="mb-6 flex items-center justify-between">
        <PageTitle>Admin — north star</PageTitle>
        <div className="flex gap-4 text-sm">
          <a href="/admin/exec" className="text-oja-orange underline">
            Executive →
          </a>
          <a href="/admin/finance" className="text-oja-orange underline">
            Finance →
          </a>
        </div>
      </div>

      <section className="mb-10 grid gap-3 sm:grid-cols-3">
        {tiles.map(([label, value]) => (
          <StatTile key={label} label={label} value={value} />
        ))}
        <StatTile label="Dead letters" value={dlqDepth} accent={dlqDepth > 0} />
      </section>

      {pay && (
        <section className="mb-10">
          <SectionTitle className="mb-3">Payments (ledger)</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-4">
            <StatTile
              label="Net revenue"
              value={`$${(pay.netCents / 100).toFixed(2)}`}
              accent
            />
            <StatTile
              label="MRR"
              value={`$${(pay.mrrCents / 100).toFixed(2)}`}
            />
            <StatTile
              label="Captured"
              value={`$${(pay.capturedCents / 100).toFixed(2)}`}
            />
            <StatTile label="Refund rate" value={`${pay.refundRatePct}%`} />
          </div>
        </section>
      )}

      {parity && (
        <Card padding="sm" className="mb-10">
          <div className="mb-2 flex items-center justify-between">
            <SectionTitle>Canonical convergence (dual-read)</SectionTitle>
            <Badge variant={parity.inParity ? "success" : "warning"}>
              {parity.inParity ? "IN PARITY" : `${parity.drift.length} DRIFTED`}
            </Badge>
          </div>
          <div className="grid grid-cols-3 gap-2 text-sm">
            <div className="font-bold text-oja-green-deep/60">metric</div>
            <div className="font-bold text-oja-green-deep/60">legacy</div>
            <div className="font-bold text-oja-green-deep/60">canonical</div>
            {(
              [
                [
                  "customers",
                  parity.legacy.customers,
                  parity.canonical.customers,
                ],
                [
                  "active subs",
                  parity.legacy.activeSubscriptions,
                  parity.canonical.activeSubscriptions,
                ],
                ["orders", parity.legacy.orders, parity.canonical.orders],
                [
                  "revenue ¢",
                  parity.legacy.revenueCents,
                  parity.canonical.revenueCents,
                ],
              ] as [string, number, number][]
            ).map(([m, l, c]) => (
              <Fragment key={m}>
                <div>{m}</div>
                <div>{l}</div>
                <div className={l === c ? "" : "font-bold text-oja-orange"}>
                  {c}
                </div>
              </Fragment>
            ))}
          </div>
          {!parity.inParity && (
            <p className="mt-3 text-sm text-oja-green-deep/70">
              Run <code>npm run converge</code> (or the hourly{" "}
              <code>legacy_convergence</code> task) to reconcile before any read
              cutover.
            </p>
          )}
        </Card>
      )}

      <section className="mb-10">
        <SectionTitle className="mb-3">Demand engine</SectionTitle>
        <div className="flex flex-wrap items-center gap-3">
          <form action={runForecastAction}>
            <Button type="submit" size="sm">
              Run forecast now
            </Button>
          </form>
          {warehouse && suppliers[0] && suggestions.length > 0 && (
            <form action={draftPoAction}>
              <input type="hidden" name="warehouseId" value={warehouse.id} />
              <input type="hidden" name="supplierId" value={suppliers[0].id} />
              <Button type="submit" variant="success" size="sm">
                Draft PO from suggestions
              </Button>
            </form>
          )}
        </div>
        <ul className="mt-3 text-sm">
          {suggestions.map((s) => (
            <li key={s.skuId}>
              Reorder suggestion: <b>{s.skuCode}</b> → {s.suggestedUnits} lb
            </li>
          ))}
          {suggestions.length === 0 && (
            <li className="text-oja-green-deep/60">
              No reorder needed right now.
            </li>
          )}
        </ul>
      </section>

      <section className="mb-10">
        <SectionTitle className="mb-3">Draft POs</SectionTitle>
        {draftPos.length === 0 && <EmptyState>None.</EmptyState>}
        {draftPos.map((po) => (
          <form
            key={po.id}
            action={placePoAction}
            className="mb-2 flex items-center gap-3 text-sm"
          >
            <input type="hidden" name="poId" value={po.id} />
            <span>
              PO {po.id.slice(-6)}:{" "}
              {po.lines.map((l) => `${l.qtyUnits} lb ${l.sku.code}`).join(", ")}
            </span>
            <Button type="submit" variant="success" size="sm">
              Place
            </Button>
          </form>
        ))}
      </section>

      <section className="mb-10 grid gap-6 sm:grid-cols-2">
        <div>
          <SectionTitle className="mb-3">Container plan (12-week)</SectionTitle>
          {containerPlan ? (
            <p className="text-sm">
              Shortfall {containerPlan.shortfallLbs.toLocaleString()} lb →{" "}
              <b>{containerPlan.containers}</b> container(s); book within{" "}
              <b>{containerPlan.orderByWeeks.toFixed(1)}</b> weeks.
            </p>
          ) : (
            <EmptyState>No warehouse configured.</EmptyState>
          )}
        </div>
        <div>
          <SectionTitle className="mb-3">
            Fresh deals (markdown ladder)
          </SectionTitle>
          {freshDeals.length === 0 && (
            <EmptyState>No lots at expiry risk.</EmptyState>
          )}
          <ul className="text-sm">
            {freshDeals.map((d) => (
              <li key={d.lotCode}>
                {d.lotCode} ({d.skuCode}): {d.unitsOnHand} lb ·{" "}
                {(d.discountPct * 100).toFixed(0)}% off
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section>
        <SectionTitle className="mb-3">
          Wholesale waitlist ({leads.length})
        </SectionTitle>
        <ul className="text-sm">
          {leads.slice(0, 10).map((l) => (
            <li key={l.id}>
              <b>{l.businessName}</b> ({l.businessType}) — {l.email}
            </li>
          ))}
        </ul>
      </section>
    </PageMain>
  );
}
