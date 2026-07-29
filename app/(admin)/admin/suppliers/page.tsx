import Link from "next/link";
import { redirect } from "next/navigation";
import { currentAccount } from "@/lib/auth";
import { createCaller } from "@/server/router";
import {
  Badge,
  Card,
  EmptyState,
  PageMain,
  PageTitle,
  SectionTitle,
} from "@/components/ui";

export const metadata = { title: "Suppliers" };
export const dynamic = "force-dynamic";

/**
 * Supplier dashboard (Execution 7) — per-supplier forecast-demand share (the
 * signal a supplier plans production against) + open purchase orders + fast-pay
 * status. Composes the existing `supplier.portal` view; admin-visible.
 */
export default async function SuppliersPage() {
  const account = await currentAccount();
  if (!account || account.role !== "ADMIN") redirect("/login");
  const caller = createCaller({ account });

  const suppliers = await caller.admin.suppliers();
  const portals = await Promise.all(
    suppliers.map((s) => caller.supplier.portal({ supplierId: s.id })),
  );

  return (
    <PageMain width="4xl">
      <div className="mb-6 flex items-center justify-between">
        <PageTitle>Suppliers</PageTitle>
        <Link href="/admin" className="text-sm text-oja-orange underline">
          ← north star
        </Link>
      </div>

      {suppliers.length === 0 && <EmptyState>No suppliers yet.</EmptyState>}

      {portals.map((p) => (
        <Card key={p.supplier.id} className="mb-6">
          <div className="mb-3 flex items-center justify-between">
            <SectionTitle>{p.supplier.name}</SectionTitle>
            <Badge variant={p.fastPay ? "success" : "neutral"}>
              {p.fastPay ? "FAST-PAY (net-7)" : "NET-30"}
            </Badge>
          </div>

          <p className="mb-2 text-sm font-bold text-oja-green-deep/60">
            4-week forecast demand (lb)
          </p>
          {p.forecastShare.length === 0 ? (
            <EmptyState>No forecasted demand.</EmptyState>
          ) : (
            <ul className="mb-4 text-sm">
              {p.forecastShare.map((f) => (
                <li key={f.skuCode}>
                  <b>{f.skuCode}</b>: {f.weeks.join(" · ")}
                </li>
              ))}
            </ul>
          )}

          <p className="mb-2 text-sm font-bold text-oja-green-deep/60">
            Open purchase orders
          </p>
          {p.openPos.length === 0 ? (
            <EmptyState>None open.</EmptyState>
          ) : (
            <ul className="text-sm">
              {p.openPos.map((po) => (
                <li key={po.id}>
                  PO {po.id.slice(-6)} · {po.status} ·{" "}
                  {po.lines
                    .map((l) => `${l.qtyUnits} lb ${l.sku.code}`)
                    .join(", ")}
                </li>
              ))}
            </ul>
          )}
        </Card>
      ))}
    </PageMain>
  );
}
