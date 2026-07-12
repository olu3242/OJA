import { redirect } from "next/navigation";
import { supabaseUser } from "@/lib/supabase/server";
import { getProfile } from "@/server/repositories/identity";
import {
  profileSetupAction,
  organizationSetupAction,
} from "@/lib/auth-actions";
import { db } from "@/lib/db";
import { Button, Input, PageMain, PageTitle, Select } from "@/components/ui";

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
    <PageMain width="md" centered>
      <PageTitle size="sm">
        {step === "profile"
          ? "Set up your profile"
          : "Set up your pantry organization"}
      </PageTitle>

      {legacy && (
        <p className="rounded-lg border border-oja-green/30 bg-oja-orange-soft/40 px-4 py-3 text-sm text-oja-green-deep">
          ✓ We found your existing GAARII account (<b>{legacy.email}</b>) and
          linked it — your subscriptions and order history carry over.
        </p>
      )}

      {step === "profile" ? (
        <form action={profileSetupAction} className="flex flex-col gap-3">
          <Input
            name="fullName"
            required
            defaultValue={profile.full_name ?? ""}
            placeholder="Full name"
            aria-label="Full name"
          />
          <Select
            name="country"
            defaultValue={profile.country}
            aria-label="Country"
          >
            <option value="US">United States</option>
            <option value="CA">Canada</option>
          </Select>
          <Input
            name="phone"
            placeholder="Phone (optional, for delivery updates)"
            aria-label="Phone"
          />
          <Button type="submit">Continue</Button>
        </form>
      ) : (
        <form action={organizationSetupAction} className="flex flex-col gap-3">
          <input
            type="hidden"
            name="organizationId"
            value={profile.default_organization_id ?? ""}
          />
          <Input
            name="name"
            required
            defaultValue={`${profile.full_name ?? "My"} pantry`}
            placeholder="Organization name"
            aria-label="Organization name"
          />
          <Select
            name="kind"
            defaultValue="household"
            aria-label="Organization type"
          >
            <option value="household">Household</option>
            <option value="group">Community / group organizer</option>
            <option value="business">Store (wholesale)</option>
            <option value="restaurant">Restaurant</option>
            <option value="supplier">Supplier</option>
          </Select>
          <Select
            name="country"
            defaultValue={profile.country}
            aria-label="Country"
          >
            <option value="US">United States</option>
            <option value="CA">Canada</option>
          </Select>
          <Button type="submit">Finish setup</Button>
        </form>
      )}
    </PageMain>
  );
}
