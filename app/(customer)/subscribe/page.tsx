import { redirect } from "next/navigation";
import { currentAccount } from "@/lib/auth";
import { subscribeAction } from "@/lib/actions";
import { PLANS } from "@/lib/pricing";
import { Button, Input, PageMain, PageTitle, Select } from "@/components/ui";

export const metadata = { title: "Choose your Garri plan" };

export default async function SubscribePage() {
  const account = await currentAccount();
  if (!account) redirect("/login");

  return (
    <PageMain width="2xl">
      <PageTitle className="mb-2">Choose your Garri plan</PageTitle>
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
          <Select name="variety" aria-label="Garri variety">
            <option value="WHITE_IJEBU">White Garri (Ijebu)</option>
            <option value="YELLOW">Yellow Garri</option>
          </Select>
          <Select name="grind" aria-label="Grind">
            <option value="COARSE">Coarse</option>
            <option value="FINE">Fine</option>
          </Select>
        </fieldset>

        <fieldset className="grid gap-3 sm:grid-cols-2">
          <legend className="mb-2 font-bold text-oja-green-deep">
            Delivery address
          </legend>
          <Input
            name="line1"
            required
            placeholder="Street address"
            aria-label="Street address"
            className="sm:col-span-2"
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
            <Input
              name="zip"
              required
              placeholder="ZIP"
              aria-label="ZIP code"
            />
          </div>
        </fieldset>

        <Button type="submit" size="lg">
          Start my subscription
        </Button>
        <p className="text-sm text-oja-green-deep/60">
          10% off your first delivery. Pause, skip, or cancel anytime. AK/HI/PR
          carry a delivery-zone surcharge so every shipment stays above our
          quality-sustaining margin floor.
        </p>
      </form>
    </PageMain>
  );
}
