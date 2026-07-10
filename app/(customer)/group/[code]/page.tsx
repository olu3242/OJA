import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { currentAccount } from "@/lib/auth";
import { groupCloseAction, groupJoinAction } from "@/lib/actions";
import { PLANS } from "@/lib/pricing";
import { groupDiscountPct } from "@/server/services/group";

export const metadata = { title: "Group order" };
export const dynamic = "force-dynamic";

export default async function GroupPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const group = await db.groupOrder.findUnique({
    where: { code },
    include: { members: true },
  });
  if (!group) notFound();
  const account = await currentAccount();
  const gross = group.members.reduce((s, m) => s + m.priceCents, 0);
  const discount = groupDiscountPct(gross);
  const isMember =
    account && group.members.some((m) => m.accountId === account.id);
  const isCreator = account?.id === group.creatorId;

  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-6 py-12">
      <h1 className="mb-2 text-3xl font-extrabold text-oja-green-deep">
        Group order <span className="text-oja-orange">{code}</span>
      </h1>
      <p className="mb-6 text-oja-green-deep/70">
        Delivery to {group.addressLine1}, {group.city}, {group.state}. Status:{" "}
        <b>{group.status}</b>
      </p>

      <section className="mb-8 rounded-xl border border-oja-green/20 bg-white p-5">
        <p className="font-bold text-oja-green-deep">
          {group.members.length} member(s) · ${(gross / 100).toFixed(2)} gross ·
          current discount {(discount * 100).toFixed(0)}%
        </p>
        <ul className="mt-2 text-sm text-oja-green-deep/70">
          {group.members.map((m) => (
            <li key={m.id}>
              {PLANS[m.plan].label} ·{" "}
              {m.variety === "WHITE_IJEBU" ? "White (Ijebu)" : "Yellow"} ·{" "}
              {m.qtyLbs} lb
            </li>
          ))}
        </ul>
      </section>

      {group.status === "OPEN" && account && !isMember && (
        <form
          action={groupJoinAction}
          className="mb-6 flex flex-col gap-3 rounded-xl border border-oja-green/20 bg-white p-5"
        >
          <input type="hidden" name="code" value={code} />
          <label className="font-bold text-oja-green-deep">
            Join with your plan
          </label>
          <select
            name="plan"
            aria-label="Plan"
            className="rounded-lg border border-oja-green/30 bg-white px-4 py-3"
          >
            <option value="STARTER">Starter — 3–5 lb</option>
            <option value="FAMILY">Family — 10–15 lb</option>
            <option value="STOCK_UP">Stock-Up — 20–25 lb</option>
          </select>
          <select
            name="variety"
            aria-label="Variety"
            className="rounded-lg border border-oja-green/30 bg-white px-4 py-3"
          >
            <option value="WHITE_IJEBU">White Garri (Ijebu)</option>
            <option value="YELLOW">Yellow Garri</option>
          </select>
          <button
            type="submit"
            className="rounded-full bg-oja-orange px-6 py-3 font-bold text-white"
          >
            Join group order
          </button>
        </form>
      )}
      {!account && (
        <p className="mb-6 text-sm">Sign in to join this group order.</p>
      )}

      {group.status === "OPEN" && isCreator && group.members.length > 0 && (
        <form action={groupCloseAction}>
          <input type="hidden" name="code" value={code} />
          <button
            type="submit"
            className="rounded-full border-2 border-oja-green px-6 py-3 font-bold text-oja-green"
          >
            Close group & place the order
          </button>
        </form>
      )}
    </main>
  );
}
