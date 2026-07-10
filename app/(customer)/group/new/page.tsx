import { redirect } from "next/navigation";
import { currentAccount } from "@/lib/auth";
import { groupCreateAction } from "@/lib/actions";

export const metadata = { title: "Start a group order" };

export default async function NewGroupPage() {
  const account = await currentAccount();
  if (!account) redirect("/login");
  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-6 py-12">
      <h1 className="mb-2 text-3xl font-extrabold text-oja-green-deep">
        Start a group order
      </h1>
      <p className="mb-8 text-oja-green-deep/70">
        One delivery point for your church, association, or buying club.
        Everyone picks their own Garri plan; the bigger the group total, the
        bigger the discount (5% at $300, 10% at $750, 15% at $1,500).
      </p>
      <form action={groupCreateAction} className="flex flex-col gap-3">
        <input
          name="line1"
          required
          placeholder="Drop-point street address"
          aria-label="Drop-point street address"
          className="rounded-lg border border-oja-green/30 bg-white px-4 py-3"
        />
        <input
          name="city"
          required
          placeholder="City"
          aria-label="City"
          className="rounded-lg border border-oja-green/30 bg-white px-4 py-3"
        />
        <div className="grid grid-cols-2 gap-3">
          <input
            name="state"
            required
            maxLength={2}
            placeholder="State (TX)"
            aria-label="State"
            className="rounded-lg border border-oja-green/30 bg-white px-4 py-3"
          />
          <input
            name="zip"
            required
            placeholder="ZIP"
            aria-label="ZIP code"
            className="rounded-lg border border-oja-green/30 bg-white px-4 py-3"
          />
        </div>
        <button
          type="submit"
          className="rounded-full bg-oja-orange px-6 py-3 font-bold text-white"
        >
          Create shareable link
        </button>
      </form>
    </main>
  );
}
