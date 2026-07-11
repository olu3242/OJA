import { beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { migrate } from "../../scripts/canonical";
import { adminClient } from "./helpers";
import {
  completeOrganizationSetup,
  completeProfileSetup,
  getProfile,
  provisionUser,
} from "@/server/repositories/identity";

/** Authentication provisioning tests — signup, signin, replay, linking. */
describe("identity provisioning (Google OAuth callback path)", () => {
  beforeAll(async () => {
    await migrate();
  });

  function googleUser(email: string) {
    return {
      userId: randomUUID(),
      email,
      fullName: "Amara Obi",
      avatarUrl: "https://lh3.googleusercontent.com/a/photo",
      provider: "google" as const,
      providerSubject: `google-sub-${randomUUID()}`,
      ip: "203.0.113.7",
      userAgent: "vitest",
    };
  }

  it("provisions profile + tenant + role + onboarding on first sign-in (signup)", async () => {
    const input = googleUser(`amara${Date.now()}@prov.gaarii`);
    const r = await provisionUser(input);
    expect(r.created).toBe(true);

    const c = await adminClient();
    const profile = await c.query(`select * from public.profiles where id=$1`, [
      input.userId,
    ]);
    expect(profile.rowCount).toBe(1);
    const member = await c.query(
      `select member_role from public.organization_members where user_id=$1`,
      [input.userId],
    );
    expect(member.rows[0].member_role).toBe("owner");
    const role = await c.query(
      `select r.key from public.user_roles ur join public.roles r on r.id=ur.role_id
        where ur.user_id=$1`,
      [input.userId],
    );
    expect(role.rows.map((x) => x.key)).toContain("household_customer");
    const org = await c.query(
      `select onboarding_state from public.organizations where id=$1`,
      [r.organizationId],
    );
    expect(org.rows[0].onboarding_state).toBe("profile"); // onboarding auto-started
    const history = await c.query(
      `select event from public.login_history where user_id=$1 order by created_at`,
      [input.userId],
    );
    expect(history.rows[0].event).toBe("signup");
    await c.end();
  });

  it("never duplicates users, tenants, memberships, or roles on replay (signin)", async () => {
    const input = googleUser(`replay${Date.now()}@prov.gaarii`);
    const first = await provisionUser(input);
    const second = await provisionUser(input); // OAuth callback replay / re-login
    const third = await provisionUser(input);
    expect(second.created).toBe(false);
    expect(third.organizationId).toBe(first.organizationId);

    const c = await adminClient();
    for (const [table, col] of [
      ["profiles", "id"],
      ["organization_members", "user_id"],
      ["oauth_accounts", "user_id"],
    ] as const) {
      const n = await c.query(
        `select count(*)::int as n from public.${table} where ${col}=$1`,
        [input.userId],
      );
      expect(n.rows[0].n, table).toBe(1);
    }
    const orgs = await c.query(
      `select count(*)::int as n from public.organizations o
        join public.organization_members m on m.organization_id=o.id
       where m.user_id=$1 and o.kind='personal'`,
      [input.userId],
    );
    expect(orgs.rows[0].n).toBe(1);
    await c.end();
  });

  it("refuses to attach one Google identity to two different profiles", async () => {
    const a = googleUser(`ident-a${Date.now()}@prov.gaarii`);
    await provisionUser(a);
    const impostor = {
      ...googleUser(`ident-b${Date.now()}@prov.gaarii`),
      providerSubject: a.providerSubject, // same Google sub, different auth user
    };
    await expect(provisionUser(impostor)).rejects.toThrow(/already linked/);
  });

  it("links an existing legacy account by email (existing-account linking)", async () => {
    // Unique per run: profiles.legacy_account_id is UNIQUE — one legacy
    // account can only ever attach to one profile (re-run safe).
    const legacyId = `cuid_legacy_${Date.now()}`;
    const input = {
      ...googleUser(`legacy${Date.now()}@prov.gaarii`),
      legacyAccountId: legacyId,
    };
    const r = await provisionUser(input);
    expect(r.linkedLegacy).toBe(true);
    const profile = await getProfile(input.userId);
    expect(profile.legacy_account_id).toBe(legacyId);
    const again = await provisionUser(input); // replay keeps the same link
    expect(again.linkedLegacy).toBe(true);
  });

  it("walks onboarding to completion: profile setup → organization setup", async () => {
    const input = googleUser(`onboard${Date.now()}@prov.gaarii`);
    const r = await provisionUser(input);
    await completeProfileSetup(input.userId, {
      fullName: "Amara O.",
      country: "ca",
    });
    const midway = await getProfile(input.userId);
    expect(midway.onboarded_at).not.toBeNull();
    expect(midway.country).toBe("CA");

    await completeOrganizationSetup(input.userId, {
      organizationId: r.organizationId,
      name: "Obi Family Pantry",
      kind: "household",
      country: "CA",
    });
    const done = await getProfile(input.userId);
    expect(done.onboarding_state).toBe("complete");

    // Non-admins of the org cannot complete someone else's setup
    const stranger = googleUser(`stranger${Date.now()}@prov.gaarii`);
    await provisionUser(stranger);
    await expect(
      completeOrganizationSetup(stranger.userId, {
        organizationId: r.organizationId,
        name: "Hijack",
        kind: "household",
        country: "US",
      }),
    ).rejects.toThrow(/Not an admin/);
  });
});
