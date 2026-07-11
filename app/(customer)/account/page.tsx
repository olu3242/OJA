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

export const metadata = { title: "My pantry" };
export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const account = await currentAccount();
  if (!account) redirect("/login");
  const caller = createCaller({ account });
  const [subs, ordersRead] = await Promise.all([
    caller.subscription.mine(),
    caller.order.mineSource(),
  ]);
  const orders = ordersRead.orders;

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
      <h1 className="mb-8 text-3xl font-extrabold text-oja-green-deep">
        My pantry
      </h1>

      {subs.length === 0 && (
        <p className="rounded-xl border border-oja-green/20 bg-white p-6">
          No subscription yet —{" "}
          <a href="/subscribe" className="font-bold text-oja-orange underline">
            choose your Garri plan
          </a>
          .
        </p>
      )}

      {subs.map((sub) => (
        <section
          key={sub.id}
          className="mb-8 rounded-xl border border-oja-green/20 bg-white p-6"
        >
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xl font-bold text-oja-green-deep">
              {PLANS[sub.plan].label} ·{" "}
              {sub.variety === "WHITE_IJEBU" ? "White (Ijebu)" : "Yellow"} ·{" "}
              {sub.grind.toLowerCase()}
            </h2>
            <span
              className={`rounded-full px-3 py-1 text-xs font-bold ${
                sub.status === "ACTIVE"
                  ? "bg-oja-green text-white"
                  : sub.status === "PAUSED"
                    ? "bg-oja-orange-soft text-oja-green-deep"
                    : "bg-gray-200 text-gray-600"
              }`}
            >
              {sub.status}
            </span>
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
                      <button
                        className="rounded-full bg-oja-orange px-5 py-2 font-bold text-white"
                        type="submit"
                      >
                        Confirm delivery
                      </button>
                    </form>
                  )}
                  <form action={skipCycleAction}>
                    <input type="hidden" name="cycleId" value={cycle.id} />
                    <button
                      className="rounded-full border-2 border-oja-green px-5 py-2 font-bold text-oja-green"
                      type="submit"
                    >
                      Skip this one
                    </button>
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

      <h2 className="mb-4 text-xl font-bold text-oja-green-deep">Deliveries</h2>
      {orders.length === 0 && (
        <p className="text-oja-green-deep/60">No deliveries yet.</p>
      )}
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
    </main>
  );
}
