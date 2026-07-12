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
import {
  Button,
  Card,
  EmptyState,
  Input,
  PageMain,
  PageTitle,
  SectionTitle,
  StatTile,
} from "@/components/ui";

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
    <PageMain width="4xl">
      <PageTitle className="mb-6">
        Warehouse{warehouse ? ` — ${warehouse.name}` : ""}
      </PageTitle>

      <section className="mb-8 grid gap-3 sm:grid-cols-3">
        {stock.map((s) => (
          <StatTile key={s.code} label={s.code} value={`${s.onHand} lb`} />
        ))}
        <StatTile label="Orders awaiting pick" value={paidOrders} accent />
      </section>

      <section className="mb-8">
        <SectionTitle className="mb-3">Receive against PO</SectionTitle>
        {openPos.length === 0 && <EmptyState>No open POs.</EmptyState>}
        {openPos.map((po) => (
          <Card key={po.id} padding="sm" className="mb-4">
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
                <Input
                  fieldSize="sm"
                  name="qtyUnits"
                  type="number"
                  min={1}
                  defaultValue={line.qtyUnits - line.receivedUnits}
                  className="w-24"
                />
                <Input
                  fieldSize="sm"
                  name="lotCode"
                  required
                  placeholder="Lot code"
                  className="w-32"
                />
                <Input fieldSize="sm" name="expiresAt" type="date" />
                <label className="flex items-center gap-1">
                  <input type="checkbox" name="qcPassed" defaultChecked /> QC
                  pass
                </label>
                <Button type="submit" variant="success" size="sm">
                  Receive
                </Button>
              </form>
            ))}
          </Card>
        ))}
      </section>

      <section className="mb-8">
        <SectionTitle className="mb-3">Pick &amp; pack (FEFO)</SectionTitle>
        {warehouse && (
          <form action={waveAction}>
            <input type="hidden" name="warehouseId" value={warehouse.id} />
            <Button type="submit" size="sm">
              Generate wave &amp; pick{" "}
              {paidOrders > 0 ? `(${paidOrders} orders)` : ""}
            </Button>
          </form>
        )}
      </section>

      <section className="mb-8">
        <SectionTitle className="mb-3">Dispatch</SectionTitle>
        {packedOrders.length === 0 && <EmptyState>Nothing packed.</EmptyState>}
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
            <Button type="submit" variant="success" size="sm">
              Ship
            </Button>
          </form>
        ))}
      </section>

      <section>
        <SectionTitle className="mb-3">In transit</SectionTitle>
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
            <Button type="submit" variant="secondary" size="sm">
              Mark delivered
            </Button>
          </form>
        ))}
      </section>
    </PageMain>
  );
}
