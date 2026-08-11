import Link from "next/link";
import { redirect } from "next/navigation";
import { currentAccount } from "@/lib/auth";
import { electFastPayAction } from "@/lib/actions";
import { createCaller } from "@/server/router";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  PageMain,
  PageTitle,
  SectionTitle,
} from "@/components/ui";

export const metadata = { title: "Supplier portal" };
export const dynamic = "force-dynamic";

/**
 * Supplier self-serve portal (Execution 7) — the SUPPLIER-role counterpart to
 * the admin `/admin/suppliers` view. A logged-in supplier sees ONLY their own
 * forward demand (4-week effective forecast for SKUs they supply), their open
 * POs, and can elect fast-pay (net-7 @ 1.5% vs net-30). Reads the existing
 * `supplier.portal` tRPC, which enforces that a supplier can only see their own
 * record; this page just guards the role and passes the account's supplierId.
 */
export default async function SupplierPortalPage() {
  const account = await currentAccount();
  if (!account || account.role !== "SUPPLIER") redirect("/login");
  if (!account.supplierId) {
    return (
      <PageMain width="2xl">
        <PageTitle className="mb-4">Supplier portal</PageTitle>
        <EmptyState>
          Your account isn’t linked to a supplier record yet. Contact GAARII
          operations to complete onboarding.
        </EmptyState>
      </PageMain>
    );
  }

  const caller = createCaller({ account });
  const p = await caller.supplier.portal({ supplierId: account.supplierId });

  return (
    <PageMain width="4xl">
      <div className="mb-6 flex items-center justify-between">
        <PageTitle>{p.supplier.name}</PageTitle>
        <Badge variant={p.fastPay ? "success" : "neutral"}>
          {p.fastPay ? "FAST-PAY (net-7)" : "NET-30"}
        </Badge>
      </div>

      <Card className="mb-6">
        <SectionTitle className="mb-3">Payment terms</SectionTitle>
        <p className="mb-4 text-sm text-oja-green-deep/70">
          {p.fastPay
            ? "You’re on fast-pay: invoices settle net-7 with a 1.5% early-payment discount."
            : "You’re on standard net-30 terms. Switch to fast-pay to get paid in 7 days for a 1.5% discount."}
        </p>
        <form action={electFastPayAction}>
          <input type="hidden" name="supplierId" value={p.supplier.id} />
          <input
            type="hidden"
            name="fastPay"
            value={p.fastPay ? "false" : "true"}
          />
          <Button type="submit" variant={p.fastPay ? "secondary" : "primary"}>
            {p.fastPay ? "Switch back to net-30" : "Elect fast-pay (net-7)"}
          </Button>
        </form>
      </Card>

      <Card className="mb-6">
        <SectionTitle className="mb-3">
          4-week forecast demand (lb)
        </SectionTitle>
        <p className="mb-3 text-sm text-oja-green-deep/60">
          Forward visibility into what GAARII expects to order from you — plan
          production against these numbers.
        </p>
        {p.forecastShare.length === 0 ? (
          <EmptyState>No forecasted demand for your SKUs yet.</EmptyState>
        ) : (
          <ul className="text-sm">
            {p.forecastShare.map((f) => (
              <li key={f.skuCode} className="mb-1">
                <b>{f.skuCode}</b>: {f.weeks.join(" · ")}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <SectionTitle className="mb-3">Open purchase orders</SectionTitle>
        {p.openPos.length === 0 ? (
          <EmptyState>No open purchase orders.</EmptyState>
        ) : (
          <ul className="text-sm">
            {p.openPos.map((po) => (
              <li key={po.id} className="mb-1">
                PO {po.id.slice(-6)} · {po.status} ·{" "}
                {po.lines
                  .map((l) => `${l.qtyUnits} lb ${l.sku.code}`)
                  .join(", ")}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="mt-6">
        <Link href="/account" className="text-sm text-oja-orange underline">
          ← back to account
        </Link>
      </div>
    </PageMain>
  );
}
