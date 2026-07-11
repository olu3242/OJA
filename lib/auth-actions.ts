"use server";

import { redirect } from "next/navigation";
import { supabaseUser } from "@/lib/supabase/server";
import {
  completeOrganizationSetup,
  completeProfileSetup,
} from "@/server/repositories/identity";

export async function profileSetupAction(formData: FormData) {
  const user = await supabaseUser();
  if (!user) redirect("/login");
  await completeProfileSetup(user.id, {
    fullName: String(formData.get("fullName")),
    country: String(formData.get("country") ?? "US"),
    phone: String(formData.get("phone") ?? "") || null,
  });
  redirect("/onboarding");
}

export async function organizationSetupAction(formData: FormData) {
  const user = await supabaseUser();
  if (!user) redirect("/login");
  await completeOrganizationSetup(user.id, {
    organizationId: String(formData.get("organizationId")),
    name: String(formData.get("name")),
    kind: String(formData.get("kind") ?? "household"),
    country: String(formData.get("country") ?? "US"),
  });
  redirect("/account");
}
