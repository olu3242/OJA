import { wholesaleAction } from "@/lib/actions";

export const metadata = { title: "Wholesale waitlist" };

export default async function WholesalePage({
  searchParams,
}: {
  searchParams: Promise<{ joined?: string }>;
}) {
  const { joined } = await searchParams;
  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-6 py-12">
      <h1 className="mb-2 text-3xl font-extrabold text-oja-green-deep">
        Wholesale waitlist
      </h1>
      <p className="mb-8 text-oja-green-deep/70">
        The MVP is a household subscription only. Wholesale supply for stores
        and restaurants opens in a later phase — join the waitlist and
        we&apos;ll contact you first.
      </p>
      {joined ? (
        <p className="rounded-xl border border-oja-green/30 bg-white p-6 font-bold text-oja-green">
          You&apos;re on the list — we&apos;ll be in touch when wholesale opens.
          ✓
        </p>
      ) : (
        <form action={wholesaleAction} className="flex flex-col gap-3">
          <input
            name="businessName"
            required
            placeholder="Business name"
            aria-label="Business name"
            className="rounded-lg border border-oja-green/30 bg-white px-4 py-3"
          />
          <input
            name="email"
            type="email"
            required
            placeholder="Business email"
            aria-label="Business email"
            className="rounded-lg border border-oja-green/30 bg-white px-4 py-3"
          />
          <select
            name="businessType"
            aria-label="Business type"
            className="rounded-lg border border-oja-green/30 bg-white px-4 py-3"
          >
            <option value="store">Grocery store</option>
            <option value="restaurant">Restaurant</option>
            <option value="caterer">Caterer</option>
            <option value="other">Other</option>
          </select>
          <textarea
            name="message"
            aria-label="Message"
            placeholder="Anything we should know? (optional)"
            className="rounded-lg border border-oja-green/30 bg-white px-4 py-3"
            rows={3}
          />
          <button
            type="submit"
            className="rounded-full bg-oja-orange px-6 py-3 font-bold text-white"
          >
            Join the wholesale waitlist
          </button>
        </form>
      )}
    </main>
  );
}
