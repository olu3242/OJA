import { redirect } from "next/navigation";
import { currentAccount } from "@/lib/auth";
import { createCaller } from "@/server/router";
import { PLANS } from "@/lib/pricing";
import {
  cancelAction,
  confirmCycleAction,
  pauseAction,
  resumeAction,
  skipCycleAction,
  swapAction,
} from "@/lib/actions";
import {
  Badge,
  Button,
  Card,
  cardClasses,
  EmptyState,
  PageMain,
  PageTitle,
  SectionTitle,
} from "@/components/ui";
import type { BadgeVariant } from "@/components/ui";

const STATUS_BADGE: Record<string, BadgeVariant> = {
  ACTIVE: "success",
  PAUSED: "warning",
  CANCELLED: "neutral",
};

export const metadata = { title: "My pantry" };
export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const account = await currentAccount();
  if (!account) redirect("/login");
  const caller = createCaller({ account });
  const [subs, ordersRead, invoices] = await Promise.all([
    caller.subscription.mine(),
    caller.order.mineSource(),
    caller.invoice.mine().catch(() => []),
  ]);
  const orders = ordersRead.orders;

  return (
    <PageMain width="3xl">
      <PageTitle className="mb-8">My pantry</PageTitle>

      {subs.length === 0 && (
        <Card>
          No subscription yet —{" "}
          <a href="/subscribe" className="font-bold text-oja-orange underline">
            choose your Garri plan
          </a>
          .
        </Card>
      )}

      {subs.map((sub) => (
        <section key={sub.id} className={cardClasses("lg", "mb-8")}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <SectionTitle>
              {PLANS[sub.plan].label} ·{" "}
              {sub.variety === "WHITE_IJEBU" ? "White (Ijebu)" : "Yellow"} ·{" "}
              {sub.grind.toLowerCase()}
            </SectionTitle>
            <Badge variant={STATUS_BADGE[sub.status] ?? "neutral"}>
              {sub.status}
            </Badge>
          </div>
          <p className="mb-4 text-sm text-oja-green-deep/70">
            {sub.qtyLbs} lb of Premium Garri every {sub.cadenceDays} days · $
            {(sub.priceCents / 100).toFixed(2)}/delivery, shipping included
          </p>

          {sub.cycles
            .filter((c) => c.status === "UPCOMING")
            .map((cycle) => (
              <div key={cycle.id} className="mb-4 rounded-lg bg-oja-cream p-4">
                <p className="mb-3 font-semibold text-oja-green-deep">
                  Next delivery scheduled{" "}
                  {new Date(cycle.scheduledFor).toLocaleDateString()} — confirm
                  or skip:
                </p>
                <div className="flex gap-3">
                  {sub.status === "ACTIVE" && (
                    <form action={confirmCycleAction}>
                      <input type="hidden" name="cycleId" value={cycle.id} />
                      <Button type="submit" size="sm">
                        Confirm delivery
                      </Button>
                    </form>
                  )}
                  <form action={skipCycleAction}>
                    <input type="hidden" name="cycleId" value={cycle.id} />
                    <Button type="submit" variant="secondary" size="sm">
                      Skip this one
                    </Button>
                  </form>
                </div>
              </div>
            ))}

          <div className="flex flex-wrap gap-3 text-sm">
            {sub.status === "ACTIVE" && (
              <form action={pauseAction}>
                <input type="hidden" name="id" value={sub.id} />
                <button className="underline" type="submit">
                  Pause
                </button>
              </form>
            )}
            {sub.status === "PAUSED" && (
              <form action={resumeAction}>
                <input type="hidden" name="id" value={sub.id} />
                <button className="underline" type="submit">
                  Resume
                </button>
              </form>
            )}
            {sub.status !== "CANCELLED" && (
              <>
                <form action={swapAction}>
                  <input type="hidden" name="id" value={sub.id} />
                  <input
                    type="hidden"
                    name="variety"
                    value={
                      sub.variety === "WHITE_IJEBU" ? "YELLOW" : "WHITE_IJEBU"
                    }
                  />
                  <button className="underline" type="submit">
                    Swap to{" "}
                    {sub.variety === "WHITE_IJEBU" ? "Yellow" : "White (Ijebu)"}
                  </button>
                </form>
                <form action={cancelAction}>
                  <input type="hidden" name="id" value={sub.id} />
                  <button className="text-red-700 underline" type="submit">
                    Cancel
                  </button>
                </form>
              </>
            )}
          </div>
        </section>
      ))}

      <SectionTitle className="mb-4">Deliveries</SectionTitle>
      {orders.length === 0 && <EmptyState>No deliveries yet.</EmptyState>}
      <ul className="flex flex-col gap-2">
        {orders.map((o, i) => (
          <li
            key={i}
            className="rounded-lg border border-oja-green/15 bg-white px-4 py-3 text-sm"
          >
            <span className="font-semibold">
              {o.lines
                .map(
                  (l) =>
                    `${l.qtyLbs} lb ${
                      l.variety === "WHITE_IJEBU" ? "White (Ijebu)" : "Yellow"
                    } Garri`,
                )
                .join(", ")}
            </span>{" "}
            — ${(o.totalCents / 100).toFixed(2)} —{" "}
            <span className="font-bold text-oja-green">{o.status}</span>
            {o.trackingCode && (
              <span className="text-oja-green-deep/60">
                {" "}
                · {o.carrier} {o.trackingCode}
              </span>
            )}
            {o.refundedCents > 0 && (
              <span className="font-semibold text-red-700">
                {" "}
                · refunded ${(o.refundedCents / 100).toFixed(2)}
              </span>
            )}
          </li>
        ))}
      </ul>

      {invoices.length > 0 && (
        <>
          <SectionTitle className="mt-8 mb-4">Invoices</SectionTitle>
          <ul className="flex flex-col gap-2">
            {invoices.map((inv) => (
              <li
                key={inv.id}
                className="rounded-lg border border-oja-green/15 bg-white px-4 py-3 text-sm"
              >
                <span className="font-semibold">{inv.number}</span> — $
                {(inv.totalCents / 100).toFixed(2)}{" "}
                <span
                  className={`font-bold ${
                    inv.paidAt ? "text-oja-green" : "text-oja-orange"
                  }`}
                >
                  {inv.paidAt ? "PAID" : "DUE"}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </PageMain>
  );
}
