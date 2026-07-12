import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { currentAccount } from "@/lib/auth";
import { groupCloseAction, groupJoinAction } from "@/lib/actions";
import { PLANS } from "@/lib/pricing";
import { groupDiscountPct } from "@/server/services/group";
import {
  Button,
  Card,
  cardClasses,
  PageMain,
  PageTitle,
  Select,
} from "@/components/ui";

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
    <PageMain width="xl">
      <PageTitle className="mb-2">
        Group order <span className="text-oja-orange">{code}</span>
      </PageTitle>
      <p className="mb-6 text-oja-green-deep/70">
        Delivery to {group.addressLine1}, {group.city}, {group.state}. Status:{" "}
        <b>{group.status}</b>
      </p>

      <Card className="mb-8">
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
      </Card>

      {group.status === "OPEN" && account && !isMember && (
        <form
          action={groupJoinAction}
          className={cardClasses("md", "mb-6 flex flex-col gap-3")}
        >
          <input type="hidden" name="code" value={code} />
          <label className="font-bold text-oja-green-deep">
            Join with your plan
          </label>
          <Select name="plan" aria-label="Plan">
            <option value="STARTER">Starter — 3–5 lb</option>
            <option value="FAMILY">Family — 10–15 lb</option>
            <option value="STOCK_UP">Stock-Up — 20–25 lb</option>
          </Select>
          <Select name="variety" aria-label="Variety">
            <option value="WHITE_IJEBU">White Garri (Ijebu)</option>
            <option value="YELLOW">Yellow Garri</option>
          </Select>
          <Button type="submit">Join group order</Button>
        </form>
      )}
      {!account && (
        <p className="mb-6 text-sm">Sign in to join this group order.</p>
      )}

      {group.status === "OPEN" && isCreator && group.members.length > 0 && (
        <form action={groupCloseAction}>
          <input type="hidden" name="code" value={code} />
          <Button type="submit" variant="secondary">
            Close group & place the order
          </Button>
        </form>
      )}
    </PageMain>
  );
}
