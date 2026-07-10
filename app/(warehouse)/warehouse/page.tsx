import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { currentAccount } from "@/lib/auth";
import {
  deliveredAction,
  dispatchAction,
  receiveAction,
  waveAction,
} from "@/lib/actions";
import { stockOnHand } from "@/server/services/inventory";

export const metadata = { title: "Warehouse" };
export const dynamic = "force-dynamic";

export default async function WarehousePage() {
  const account = await currentAccount();
  if (!account || (account.role !== "WAREHOUSE" && account.role !== "ADMIN"))
    redirect("/login");

  const warehouse = await db.warehouse.findFirst();
  const openPos = await db.purchaseOrder.findMany({
    where: { status: { in: ["PLACED", "PARTIALLY_RECEIVED"] } },
    include: { lines: { include: { sku: true } }, supplier: true },
  });
  const paidOrders = await db.order.count({ where: { status: "PAID" } });
  const packedOrders = await db.order.findMany({ where: { status: "PACKED" } });
  const shippedOrders = await db.order.findMany({
    where: { status: "SHIPPED" },
  });
  const skus = await db.sku.findMany({ where: { active: true } });
  const stock = warehouse
    ? await Promise.all(
        skus.map(async (s) => ({
          code: s.code,
          onHand: await stockOnHand(s.id, warehouse.id),
        })),
      )
    : [];

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-10">
      <h1 className="mb-6 text-3xl font-extrabold text-oja-green-deep">
        Warehouse{warehouse ? ` — ${warehouse.name}` : ""}
      </h1>

      <section className="mb-8 grid gap-3 sm:grid-cols-3">
        {stock.map((s) => (
          <div
            key={s.code}
            className="rounded-xl border border-oja-green/20 bg-white p-4"
          >
            <div className="text-xs font-bold text-oja-green-deep/60">
              {s.code}
            </div>
            <div className="text-2xl font-extrabold text-oja-green-deep">
              {s.onHand} lb
            </div>
          </div>
        ))}
        <div className="rounded-xl border border-oja-green/20 bg-white p-4">
          <div className="text-xs font-bold text-oja-green-deep/60">
            ORDERS AWAITING PICK
          </div>
          <div className="text-2xl font-extrabold text-oja-orange">
            {paidOrders}
          </div>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-xl font-bold text-oja-green-deep">
          Receive against PO
        </h2>
        {openPos.length === 0 && (
          <p className="text-sm text-oja-green-deep/60">No open POs.</p>
        )}
        {openPos.map((po) => (
          <div
            key={po.id}
            className="mb-4 rounded-xl border border-oja-green/20 bg-white p-4"
          >
            <p className="mb-2 text-sm font-bold text-oja-green-deep">
              PO {po.id.slice(-6)} · {po.supplier.name}
              {po.expectedAt &&
                ` · expected ${new Date(po.expectedAt).toLocaleDateString()}`}
            </p>
            {po.lines.map((line) => (
              <form
                key={line.id}
                action={receiveAction}
                className="mb-2 flex flex-wrap items-center gap-2 text-sm"
              >
                <input type="hidden" name="poLineId" value={line.id} />
                <span className="w-40 font-semibold">{line.sku.code}</span>
                <span className="text-oja-green-deep/60">
                  {line.receivedUnits}/{line.qtyUnits} lb received
                </span>
                <input
                  name="qtyUnits"
                  type="number"
                  min={1}
                  defaultValue={line.qtyUnits - line.receivedUnits}
                  className="w-24 rounded border border-oja-green/30 px-2 py-1"
                />
                <input
                  name="lotCode"
                  required
                  placeholder="Lot code"
                  className="w-32 rounded border border-oja-green/30 px-2 py-1"
                />
                <input
                  name="expiresAt"
                  type="date"
                  className="rounded border border-oja-green/30 px-2 py-1"
                />
                <label className="flex items-center gap-1">
                  <input type="checkbox" name="qcPassed" defaultChecked /> QC
                  pass
                </label>
                <button
                  type="submit"
                  className="rounded-full bg-oja-green px-4 py-1 font-bold text-white"
                >
                  Receive
                </button>
              </form>
            ))}
          </div>
        ))}
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-xl font-bold text-oja-green-deep">
          Pick & pack (FEFO)
        </h2>
        {warehouse && (
          <form action={waveAction}>
            <input type="hidden" name="warehouseId" value={warehouse.id} />
            <button
              type="submit"
              className="rounded-full bg-oja-orange px-5 py-2 font-bold text-white"
            >
              Generate wave & pick{" "}
              {paidOrders > 0 ? `(${paidOrders} orders)` : ""}
            </button>
          </form>
        )}
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-xl font-bold text-oja-green-deep">Dispatch</h2>
        {packedOrders.length === 0 && (
          <p className="text-sm text-oja-green-deep/60">Nothing packed.</p>
        )}
        {packedOrders.map((o) => (
          <form
            key={o.id}
            action={dispatchAction}
            className="mb-2 flex items-center gap-3 text-sm"
          >
            <input type="hidden" name="orderId" value={o.id} />
            <span className="font-semibold">Order {o.id.slice(-6)}</span>
            <span>
              {o.city}, {o.state}
            </span>
            <button
              type="submit"
              className="rounded-full bg-oja-green px-4 py-1 font-bold text-white"
            >
              Ship
            </button>
          </form>
        ))}
      </section>

      <section>
        <h2 className="mb-3 text-xl font-bold text-oja-green-deep">
          In transit
        </h2>
        {shippedOrders.map((o) => (
          <form
            key={o.id}
            action={deliveredAction}
            className="mb-2 flex items-center gap-3 text-sm"
          >
            <input type="hidden" name="orderId" value={o.id} />
            <span className="font-semibold">
              {o.carrier} {o.trackingCode}
            </span>
            <button
              type="submit"
              className="rounded-full border-2 border-oja-green px-4 py-1 font-bold text-oja-green"
            >
              Mark delivered
            </button>
          </form>
        ))}
      </section>
    </main>
  );
}
