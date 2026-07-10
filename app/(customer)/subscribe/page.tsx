import { redirect } from "next/navigation";
import { currentAccount } from "@/lib/auth";
import { subscribeAction } from "@/lib/actions";
import { PLANS } from "@/lib/pricing";

export const metadata = { title: "Choose your Garri plan" };

export default async function SubscribePage() {
  const account = await currentAccount();
  if (!account) redirect("/login");

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
      <h1 className="mb-2 text-3xl font-extrabold text-oja-green-deep">
        Choose your Garri plan
      </h1>
      <p className="mb-8 text-oja-green-deep/70">
        One product: Premium Nigerian Garri. The only difference between plans
        is quantity — shipping is included in every price.
      </p>
      <form action={subscribeAction} className="flex flex-col gap-8">
        <fieldset className="grid gap-3 sm:grid-cols-3">
          <legend className="mb-2 font-bold text-oja-green-deep">Plan</legend>
          {Object.entries(PLANS).map(([key, plan]) => (
            <label
              key={key}
              className="flex cursor-pointer flex-col gap-1 rounded-xl border border-oja-green/20 bg-white p-4 has-checked:border-oja-orange has-checked:ring-2 has-checked:ring-oja-orange/40"
            >
              <input
                type="radio"
                name="plan"
                value={key}
                defaultChecked={plan.hero}
                className="sr-only"
              />
              <span className="font-bold text-oja-green-deep">
                {plan.label}
              </span>
              <span className="text-sm text-oja-green-deep/70">
                {plan.blurb}
              </span>
              <span className="mt-1 font-extrabold text-oja-orange">
                ${(plan.priceMinCents / 100).toFixed(0)}–$
                {(plan.priceMaxCents / 100).toFixed(0)}/mo
              </span>
            </label>
          ))}
        </fieldset>

        <fieldset className="grid gap-3 sm:grid-cols-2">
          <legend className="mb-2 font-bold text-oja-green-deep">
            Variety & grind
          </legend>
          <select
            name="variety"
            className="rounded-lg border border-oja-green/30 bg-white px-4 py-3"
          >
            <option value="WHITE_IJEBU">White Garri (Ijebu)</option>
            <option value="YELLOW">Yellow Garri</option>
          </select>
          <select
            name="grind"
            className="rounded-lg border border-oja-green/30 bg-white px-4 py-3"
          >
            <option value="COARSE">Coarse</option>
            <option value="FINE">Fine</option>
          </select>
        </fieldset>

        <fieldset className="grid gap-3 sm:grid-cols-2">
          <legend className="mb-2 font-bold text-oja-green-deep">
            Delivery address
          </legend>
          <input
            name="line1"
            required
            placeholder="Street address"
            className="rounded-lg border border-oja-green/30 bg-white px-4 py-3 sm:col-span-2"
          />
          <input
            name="city"
            required
            placeholder="City"
            className="rounded-lg border border-oja-green/30 bg-white px-4 py-3"
          />
          <div className="grid grid-cols-2 gap-3">
            <input
              name="state"
              required
              maxLength={2}
              placeholder="State (TX)"
              className="rounded-lg border border-oja-green/30 bg-white px-4 py-3"
            />
            <input
              name="zip"
              required
              placeholder="ZIP"
              className="rounded-lg border border-oja-green/30 bg-white px-4 py-3"
            />
          </div>
        </fieldset>

        <button
          type="submit"
          className="rounded-full bg-oja-orange px-8 py-4 text-lg font-bold text-white"
        >
          Start my subscription
        </button>
        <p className="text-sm text-oja-green-deep/60">
          10% off your first delivery. Pause, skip, or cancel anytime. AK/HI/PR
          carry a delivery-zone surcharge so every shipment stays above our
          quality-sustaining margin floor.
        </p>
      </form>
    </main>
  );
}
