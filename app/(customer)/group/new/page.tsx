import { redirect } from "next/navigation";
import { currentAccount } from "@/lib/auth";
import { groupCreateAction } from "@/lib/actions";
import { Button, Input, PageMain, PageTitle } from "@/components/ui";

export const metadata = { title: "Start a group order" };

export default async function NewGroupPage() {
  const account = await currentAccount();
  if (!account) redirect("/login");
  return (
    <PageMain width="xl">
      <PageTitle className="mb-2">Start a group order</PageTitle>
      <p className="mb-8 text-oja-green-deep/70">
        One delivery point for your church, association, or buying club.
        Everyone picks their own Garri plan; the bigger the group total, the
        bigger the discount (5% at $300, 10% at $750, 15% at $1,500).
      </p>
      <form action={groupCreateAction} className="flex flex-col gap-3">
        <Input
          name="line1"
          required
          placeholder="Drop-point street address"
          aria-label="Drop-point street address"
        />
        <Input name="city" required placeholder="City" aria-label="City" />
        <div className="grid grid-cols-2 gap-3">
          <Input
            name="state"
            required
            maxLength={2}
            placeholder="State (TX)"
            aria-label="State"
          />
          <Input name="zip" required placeholder="ZIP" aria-label="ZIP code" />
        </div>
        <Button type="submit">Create shareable link</Button>
      </form>
    </PageMain>
  );
}
