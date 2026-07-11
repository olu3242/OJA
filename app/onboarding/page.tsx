import { redirect } from "next/navigation";
import { supabaseUser } from "@/lib/supabase/server";
import { getProfile } from "@/server/repositories/identity";
import {
  profileSetupAction,
  organizationSetupAction,
} from "@/lib/auth-actions";
import { db } from "@/lib/db";

export const metadata = { title: "Set up your account" };
export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const user = await supabaseUser();
  if (!user) redirect("/login");
  const profile = await getProfile(user.id);
  if (!profile) redirect("/login?error=provisioning_failed");
  if (profile.onboarding_state === "complete") redirect("/account");

  const legacy = profile.legacy_account_id
    ? await db.account
        .findUnique({ where: { id: profile.legacy_account_id } })
        .catch(() => null)
    : null;

  const step: "profile" | "organization" = profile.onboarded_at
    ? "organization"
    : "profile";

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-6 py-16">
      <h1 className="text-2xl font-extrabold text-oja-green-deep">
        {step === "profile"
          ? "Set up your profile"
          : "Set up your pantry organization"}
      </h1>

      {legacy && (
        <p className="rounded-lg border border-oja-green/30 bg-oja-orange-soft/40 px-4 py-3 text-sm text-oja-green-deep">
          ✓ We found your existing GAARII account (<b>{legacy.email}</b>) and
          linked it — your subscriptions and order history carry over.
        </p>
      )}

      {step === "profile" ? (
        <form action={profileSetupAction} className="flex flex-col gap-3">
          <input
            name="fullName"
            required
            defaultValue={profile.full_name ?? ""}
            placeholder="Full name"
            aria-label="Full name"
            className="rounded-lg border border-oja-green/30 bg-white px-4 py-3"
          />
          <select
            name="country"
            defaultValue={profile.country}
            aria-label="Country"
            className="rounded-lg border border-oja-green/30 bg-white px-4 py-3"
          >
            <option value="US">United States</option>
            <option value="CA">Canada</option>
          </select>
          <input
            name="phone"
            placeholder="Phone (optional, for delivery updates)"
            aria-label="Phone"
            className="rounded-lg border border-oja-green/30 bg-white px-4 py-3"
          />
          <button
            type="submit"
            className="rounded-full bg-oja-orange px-6 py-3 font-bold text-white"
          >
            Continue
          </button>
        </form>
      ) : (
        <form action={organizationSetupAction} className="flex flex-col gap-3">
          <input
            type="hidden"
            name="organizationId"
            value={profile.default_organization_id ?? ""}
          />
          <input
            name="name"
            required
            defaultValue={`${profile.full_name ?? "My"} pantry`}
            placeholder="Organization name"
            aria-label="Organization name"
            className="rounded-lg border border-oja-green/30 bg-white px-4 py-3"
          />
          <select
            name="kind"
            defaultValue="household"
            aria-label="Organization type"
            className="rounded-lg border border-oja-green/30 bg-white px-4 py-3"
          >
            <option value="household">Household</option>
            <option value="group">Community / group organizer</option>
            <option value="business">Store (wholesale)</option>
            <option value="restaurant">Restaurant</option>
            <option value="supplier">Supplier</option>
          </select>
          <select
            name="country"
            defaultValue={profile.country}
            aria-label="Country"
            className="rounded-lg border border-oja-green/30 bg-white px-4 py-3"
          >
            <option value="US">United States</option>
            <option value="CA">Canada</option>
          </select>
          <button
            type="submit"
            className="rounded-full bg-oja-orange px-6 py-3 font-bold text-white"
          >
            Finish setup
          </button>
        </form>
      )}
    </main>
  );
}
