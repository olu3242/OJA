import type { PoolClient } from "pg";
import { canonicalPool } from "@/lib/canonical-db";

/**
 * Identity repository — provisioning and account linking on the canonical
 * schema. Every entry point is idempotent and runs in one transaction:
 * a Google sign-in can be retried/replayed without ever creating duplicate
 * users, tenants, memberships, or role grants (uniqueness is enforced by
 * constraints, not by application luck).
 */
export type ProvisionInput = {
  userId: string; // auth.users.id (Supabase)
  email: string;
  fullName?: string | null;
  avatarUrl?: string | null;
  provider: "google" | "email";
  providerSubject: string; // Google `sub`
  ip?: string | null;
  userAgent?: string | null;
  legacyAccountId?: string | null; // pre-Supabase account (existing-account linking)
};

export type ProvisionResult = {
  profileId: string;
  organizationId: string;
  created: boolean; // first-ever sign-in (signup) vs. returning (signin)
  linkedLegacy: boolean;
};

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "member";

async function tx<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const client = await canonicalPool.connect();
  try {
    await client.query("begin");
    const out = await fn(client);
    await client.query("commit");
    return out;
  } catch (e) {
    await client.query("rollback");
    throw e;
  } finally {
    client.release();
  }
}

export async function provisionUser(
  input: ProvisionInput,
): Promise<ProvisionResult> {
  return tx(async (c) => {
    // Local/plain-Postgres runs need the auth.users row the FK points at;
    // on Supabase the row already exists (GoTrue created it) → no-op.
    await c.query(
      `insert into auth.users (id, email) values ($1, $2)
       on conflict (id) do nothing`,
      [input.userId, input.email],
    );

    // 1. Profile: keyed by auth user id — the single identity row.
    const existing = await c.query(
      `select id from public.profiles where id = $1`,
      [input.userId],
    );
    const created = existing.rowCount === 0;
    await c.query(
      `insert into public.profiles (id, email, full_name, avatar_url, created_by, updated_by)
       values ($1, lower($2), $3, $4, $1, $1)
       on conflict (id) do update
         set full_name = coalesce(excluded.full_name, public.profiles.full_name),
             avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url),
             updated_by = excluded.updated_by`,
      [
        input.userId,
        input.email,
        input.fullName ?? null,
        input.avatarUrl ?? null,
      ],
    );

    // 2. OAuth identity: (provider, subject) is globally unique. If the same
    //    Google identity is already attached to another profile, refuse —
    //    that would be a duplicate user.
    const oauth = await c.query(
      `insert into public.oauth_accounts
         (user_id, provider, provider_subject, provider_email, created_by, updated_by)
       values ($1, $2, $3, lower($4), $1, $1)
       on conflict (provider, provider_subject) do update set updated_by = excluded.updated_by
       returning user_id`,
      [input.userId, input.provider, input.providerSubject, input.email],
    );
    if (oauth.rows[0].user_id !== input.userId) {
      throw new Error(
        "This Google account is already linked to a different profile",
      );
    }

    // 3. Tenant: every user gets a personal organization on first sign-in.
    let orgId: string;
    const membership = await c.query(
      `select m.organization_id
         from public.organization_members m
         join public.organizations o on o.id = m.organization_id
        where m.user_id = $1 and m.deleted_at is null and o.kind = 'personal'
        limit 1`,
      [input.userId],
    );
    if (membership.rowCount) {
      orgId = membership.rows[0].organization_id;
    } else {
      const base = slugify(input.fullName ?? input.email.split("@")[0]);
      const org = await c.query(
        `insert into public.organizations (name, slug, kind, created_by, updated_by)
         values ($1, $2 || '-' || substr(md5(random()::text), 1, 6), 'personal', $3, $3)
         returning id`,
        [input.fullName ?? input.email, base, input.userId],
      );
      orgId = org.rows[0].id;
      await c.query(
        `insert into public.organization_members
           (organization_id, user_id, member_role, created_by, updated_by)
         values ($1, $2, 'owner', $2, $2)
         on conflict (organization_id, user_id) do nothing`,
        [orgId, input.userId],
      );
      await c.query(
        `update public.profiles set default_organization_id = $1, updated_by = $2
          where id = $2 and default_organization_id is null`,
        [orgId, input.userId],
      );
      // Onboarding starts automatically for brand-new tenants.
      await c.query(
        `update public.organizations set onboarding_state = 'profile', updated_by = $2
          where id = $1`,
        [orgId, input.userId],
      );
    }

    // 4. Default role assignment (household customer) — idempotent.
    await c.query(
      `insert into public.user_roles (user_id, role_id, organization_id, created_by, updated_by)
       select $1, r.id, $2, $1, $1 from public.roles r where r.key = 'household_customer'
       on conflict (user_id, role_id, organization_id) do nothing`,
      [input.userId, orgId],
    );

    // 5. Existing-account linking (pre-Supabase account with the same email).
    let linkedLegacy = false;
    if (input.legacyAccountId) {
      const res = await c.query(
        `update public.profiles set legacy_account_id = $2, updated_by = $1
          where id = $1 and (legacy_account_id is null or legacy_account_id = $2)`,
        [input.userId, input.legacyAccountId],
      );
      linkedLegacy = (res.rowCount ?? 0) > 0;
      if (linkedLegacy) {
        await c.query(
          `insert into public.login_history (user_id, event, provider, detail, created_by)
           values ($1, 'link', $2, jsonb_build_object('legacyAccountId', $3::text), $1)`,
          [input.userId, input.provider, input.legacyAccountId],
        );
      }
    }

    // 6. Login history (signup vs. signin) — audit-grade record of the flow.
    await c.query(
      `insert into public.login_history (user_id, event, provider, ip, user_agent, created_by)
       values ($1, $2, $3, $4, $5, $1)`,
      [
        input.userId,
        created ? "signup" : "signin",
        input.provider,
        input.ip ?? null,
        input.userAgent ?? null,
      ],
    );

    return {
      profileId: input.userId,
      organizationId: orgId,
      created,
      linkedLegacy,
    };
  });
}

export async function recordLogout(userId: string) {
  await canonicalPool.query(
    `insert into public.login_history (user_id, event, created_by) values ($1, 'logout', $1)`,
    [userId],
  );
}

export async function getProfile(userId: string) {
  const res = await canonicalPool.query(
    `select p.*, o.onboarding_state
       from public.profiles p
       left join public.organizations o on o.id = p.default_organization_id
      where p.id = $1 and p.deleted_at is null`,
    [userId],
  );
  return res.rows[0] ?? null;
}

/** Onboarding step 1: profile details. */
export async function completeProfileSetup(
  userId: string,
  data: { fullName: string; country: string; phone?: string | null },
) {
  await canonicalPool.query(
    `update public.profiles
        set full_name = $2, country = $3, phone = $4, onboarded_at = coalesce(onboarded_at, now()),
            updated_by = $1
      where id = $1`,
    [userId, data.fullName, data.country.toUpperCase(), data.phone ?? null],
  );
}

/** Onboarding step 2: organization details → onboarding complete. */
export async function completeOrganizationSetup(
  userId: string,
  data: { organizationId: string; name: string; kind: string; country: string },
) {
  await tx(async (c) => {
    const member = await c.query(
      `select 1 from public.organization_members
        where organization_id = $1 and user_id = $2
          and member_role in ('owner','admin') and deleted_at is null`,
      [data.organizationId, userId],
    );
    if (!member.rowCount) throw new Error("Not an admin of this organization");
    await c.query(
      `update public.organizations
          set name = $2, kind = $3, country = $4, onboarding_state = 'complete', updated_by = $5
        where id = $1`,
      [
        data.organizationId,
        data.name,
        data.kind,
        data.country.toUpperCase(),
        userId,
      ],
    );
  });
}
