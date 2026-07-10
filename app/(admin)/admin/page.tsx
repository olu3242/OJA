import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { currentAccount } from "@/lib/auth";
import { createCaller } from "@/server/router";
import { draftPoAction, placePoAction, runForecastAction } from "@/lib/actions";

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

  const tiles: [string, string][] = [
    ["Active subscribers", String(dash.subscribers.active)],
    ["Cycle-confirm rate", pct(dash.cycleConfirmRate)],
    ["On-time ship rate", pct(dash.onTimeShipRate)],
    ["GM after shipping", pct(dash.grossMarginAfterShipping)],
    ["WAPE v0 / v1", `${pct(dash.wape.v0)} / ${pct(dash.wape.v1)}`],
    ["Refunds", String(dash.refunds)],
  ];

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
      <h1 className="mb-6 text-3xl font-extrabold text-oja-green-deep">
        Admin — north star
      </h1>

      <section className="mb-10 grid gap-3 sm:grid-cols-3">
        {tiles.map(([label, value]) => (
          <div
            key={label}
            className="rounded-xl border border-oja-green/20 bg-white p-4"
          >
            <div className="text-xs font-bold tracking-wide text-oja-green-deep/60 uppercase">
              {label}
            </div>
            <div className="text-2xl font-extrabold text-oja-green-deep">
              {value}
            </div>
          </div>
        ))}
      </section>

      <section className="mb-10">
        <h2 className="mb-3 text-xl font-bold text-oja-green-deep">
          Demand engine
        </h2>
        <div className="flex flex-wrap items-center gap-3">
          <form action={runForecastAction}>
            <button
              type="submit"
              className="rounded-full bg-oja-orange px-5 py-2 font-bold text-white"
            >
              Run forecast now
            </button>
          </form>
          {warehouse && suppliers[0] && suggestions.length > 0 && (
            <form action={draftPoAction}>
              <input type="hidden" name="warehouseId" value={warehouse.id} />
              <input type="hidden" name="supplierId" value={suppliers[0].id} />
              <button
                type="submit"
                className="rounded-full bg-oja-green px-5 py-2 font-bold text-white"
              >
                Draft PO from suggestions
              </button>
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
        <h2 className="mb-3 text-xl font-bold text-oja-green-deep">
          Draft POs
        </h2>
        {draftPos.length === 0 && (
          <p className="text-sm text-oja-green-deep/60">None.</p>
        )}
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
            <button
              type="submit"
              className="rounded-full bg-oja-green px-4 py-1 font-bold text-white"
            >
              Place
            </button>
          </form>
        ))}
      </section>

      <section className="mb-10 grid gap-6 sm:grid-cols-2">
        <div>
          <h2 className="mb-3 text-xl font-bold text-oja-green-deep">
            Container plan (12-week)
          </h2>
          {containerPlan ? (
            <p className="text-sm">
              Shortfall {containerPlan.shortfallLbs.toLocaleString()} lb →{" "}
              <b>{containerPlan.containers}</b> container(s); book within{" "}
              <b>{containerPlan.orderByWeeks.toFixed(1)}</b> weeks.
            </p>
          ) : (
            <p className="text-sm text-oja-green-deep/60">
              No warehouse configured.
            </p>
          )}
        </div>
        <div>
          <h2 className="mb-3 text-xl font-bold text-oja-green-deep">
            Fresh deals (markdown ladder)
          </h2>
          {freshDeals.length === 0 && (
            <p className="text-sm text-oja-green-deep/60">
              No lots at expiry risk.
            </p>
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
        <h2 className="mb-3 text-xl font-bold text-oja-green-deep">
          Wholesale waitlist ({leads.length})
        </h2>
        <ul className="text-sm">
          {leads.slice(0, 10).map((l) => (
            <li key={l.id}>
              <b>{l.businessName}</b> ({l.businessType}) — {l.email}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
