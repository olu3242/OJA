-- ============================================================================
-- Migration 0002 — RLS helpers, policies, audit trigger, views
-- Model: deny-by-default. RLS is enabled on every table (0001 §Z); a table
-- with no policy is invisible to `authenticated`. `service_role` bypasses RLS
-- (backend/service traffic); platform admins get read escalation via RBAC.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Helper functions (SECURITY DEFINER prevents policy recursion)
-- ---------------------------------------------------------------------------
create or replace function public.is_org_member(org uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.organization_members m
    where m.organization_id = org
      and m.user_id = auth.uid()
      and m.deleted_at is null
  );
$$;

create or replace function public.is_org_admin(org uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.organization_members m
    where m.organization_id = org
      and m.user_id = auth.uid()
      and m.member_role in ('owner','admin')
      and m.deleted_at is null
  );
$$;

create or replace function public.is_platform_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = auth.uid()
      and r.key = 'platform_admin'
      and ur.deleted_at is null
  );
$$;

revoke all on function public.is_org_member(uuid), public.is_org_admin(uuid),
  public.is_platform_admin() from public;
grant execute on function public.is_org_member(uuid), public.is_org_admin(uuid),
  public.is_platform_admin() to authenticated, anon, service_role;

-- ---------------------------------------------------------------------------
-- Row-change audit trigger → audit_logs (append-only)
-- ---------------------------------------------------------------------------
create or replace function public.write_audit_log() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_action text;
begin
  if tg_op = 'INSERT' then v_action := 'insert';
  elsif tg_op = 'UPDATE' then
    v_action := case
      when new.deleted_at is not null and old.deleted_at is null then 'soft_delete'
      else 'update' end;
  else v_action := 'delete';
  end if;
  insert into public.audit_logs
    (table_name, row_id, action, actor_user_id, before, after, organization_id)
  values (
    tg_table_name,
    coalesce(new.id, old.id),
    v_action,
    auth.uid(),
    case when tg_op = 'INSERT' then null else to_jsonb(old) end,
    case when tg_op = 'DELETE' then null else to_jsonb(new) end,
    coalesce(new.organization_id, old.organization_id)
  );
  return coalesce(new, old);
end $$;

-- Attach the audit trigger to high-sensitivity tables
do $$
declare t text;
begin
  foreach t in array array[
    'organizations','organization_members','user_roles','oauth_accounts',
    'subscriptions','orders','payments','refunds','wallets','credits',
    'purchase_orders','standing_orders','api_keys','feature_flags',
    'system_settings','forecast_overrides','admin_actions'
  ] loop
    execute format('drop trigger if exists audit_row on public.%I', t);
    execute format('create trigger audit_row
        after insert or update or delete on public.%I
        for each row execute function public.write_audit_log()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Baseline tenant-isolation policies for every table
--   select/insert/update require org membership; hard DELETE is never granted
--   (soft delete = update of deleted_at, covered by the update policy).
-- ---------------------------------------------------------------------------
do $$
declare t record;
begin
  for t in
    select c.relname as tbl
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
  loop
    execute format('drop policy if exists tenant_select on public.%I', t.tbl);
    execute format($p$create policy tenant_select on public.%I for select to authenticated
      using (deleted_at is null and (public.is_platform_admin()
             or (organization_id is not null and public.is_org_member(organization_id))))$p$, t.tbl);

    execute format('drop policy if exists tenant_insert on public.%I', t.tbl);
    execute format($p$create policy tenant_insert on public.%I for insert to authenticated
      with check (organization_id is not null and public.is_org_member(organization_id))$p$, t.tbl);

    execute format('drop policy if exists tenant_update on public.%I', t.tbl);
    execute format($p$create policy tenant_update on public.%I for update to authenticated
      using (deleted_at is null and (public.is_platform_admin()
             or (organization_id is not null and public.is_org_admin(organization_id))))
      with check (public.is_platform_admin()
             or (organization_id is not null and public.is_org_member(organization_id)))$p$, t.tbl);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Targeted overrides (replace baseline where semantics differ)
-- ---------------------------------------------------------------------------

-- profiles: strictly self-service (service_role provisions)
drop policy if exists tenant_select on public.profiles;
drop policy if exists tenant_insert on public.profiles;
drop policy if exists tenant_update on public.profiles;
create policy profiles_self_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_platform_admin());
create policy profiles_self_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- organizations: members read; owners/admins update; any authed user may create
drop policy if exists tenant_select on public.organizations;
drop policy if exists tenant_insert on public.organizations;
drop policy if exists tenant_update on public.organizations;
create policy orgs_member_select on public.organizations for select to authenticated
  using (deleted_at is null and (public.is_org_member(id) or public.is_platform_admin()));
create policy orgs_create on public.organizations for insert to authenticated
  with check (true);
create policy orgs_admin_update on public.organizations for update to authenticated
  using (public.is_org_admin(id) or public.is_platform_admin())
  with check (public.is_org_admin(id) or public.is_platform_admin());

-- organization_members: see co-members; org admins manage; self-insert as owner
-- is allowed only when creating one's own membership (bootstrap handled by
-- service_role during provisioning; this covers invitation acceptance).
drop policy if exists tenant_select on public.organization_members;
drop policy if exists tenant_insert on public.organization_members;
drop policy if exists tenant_update on public.organization_members;
create policy members_select on public.organization_members for select to authenticated
  using (deleted_at is null and (user_id = auth.uid()
         or public.is_org_member(organization_id) or public.is_platform_admin()));
create policy members_admin_insert on public.organization_members for insert to authenticated
  with check (public.is_org_admin(organization_id) or user_id = auth.uid());
create policy members_admin_update on public.organization_members for update to authenticated
  using (public.is_org_admin(organization_id) or public.is_platform_admin());

-- RBAC reference tables: readable by any authenticated user; writes = platform admin
do $$
declare t text;
begin
  foreach t in array array['roles','permissions','role_permissions'] loop
    execute format('drop policy if exists tenant_select on public.%I', t);
    execute format('drop policy if exists tenant_insert on public.%I', t);
    execute format('drop policy if exists tenant_update on public.%I', t);
    execute format($p$create policy rbac_read on public.%I for select to authenticated
      using (deleted_at is null)$p$, t);
    execute format($p$create policy rbac_admin_write on public.%I for insert to authenticated
      with check (public.is_platform_admin())$p$, t);
    execute format($p$create policy rbac_admin_update on public.%I for update to authenticated
      using (public.is_platform_admin())$p$, t);
  end loop;
end $$;

-- user_roles: self-visible; only platform admins assign (privilege escalation guard)
drop policy if exists tenant_select on public.user_roles;
drop policy if exists tenant_insert on public.user_roles;
drop policy if exists tenant_update on public.user_roles;
create policy user_roles_select on public.user_roles for select to authenticated
  using (deleted_at is null and (user_id = auth.uid() or public.is_platform_admin()));
create policy user_roles_admin_write on public.user_roles for insert to authenticated
  with check (public.is_platform_admin());
create policy user_roles_admin_update on public.user_roles for update to authenticated
  using (public.is_platform_admin());

-- Self-scoped identity tables
do $$
declare t text;
begin
  foreach t in array array[
    'oauth_accounts','sessions','devices','login_history','notifications',
    'notification_preferences','avatars'
  ] loop
    execute format('drop policy if exists tenant_select on public.%I', t);
    execute format('drop policy if exists tenant_insert on public.%I', t);
    execute format('drop policy if exists tenant_update on public.%I', t);
    execute format($p$create policy self_select on public.%I for select to authenticated
      using (deleted_at is null and (user_id = auth.uid() or public.is_platform_admin()))$p$, t);
    execute format($p$create policy self_write on public.%I for insert to authenticated
      with check (user_id = auth.uid())$p$, t);
    execute format($p$create policy self_update on public.%I for update to authenticated
      using (user_id = auth.uid()) with check (user_id = auth.uid())$p$, t);
  end loop;
end $$;

-- Public catalog/reference data: world-readable where active
do $$
declare t text;
begin
  foreach t in array array[
    'product_categories','products','product_variants','currencies',
    'tax_rates','country_pricing'
  ] loop
    execute format('drop policy if exists tenant_select on public.%I', t);
    execute format($p$create policy reference_read on public.%I for select to anon, authenticated
      using (deleted_at is null)$p$, t);
  end loop;
end $$;

-- landing pages: published pages are public
drop policy if exists tenant_select on public.landing_pages;
create policy landing_public_read on public.landing_pages for select to anon, authenticated
  using (deleted_at is null and published_at is not null);

-- waitlists: anyone may join; reads are admin-only (baseline select dropped)
drop policy if exists tenant_insert on public.waitlists;
drop policy if exists tenant_select on public.waitlists;
create policy waitlist_join on public.waitlists for insert to anon, authenticated
  with check (true);
create policy waitlist_admin_read on public.waitlists for select to authenticated
  using (public.is_platform_admin());

-- Forensic stores: append via service_role only; platform-admin read.
do $$
declare t text;
begin
  foreach t in array array[
    'audit_logs','security_events','admin_actions','events','event_failures',
    'event_replays','dead_letter_queue','api_keys','service_accounts'
  ] loop
    execute format('drop policy if exists tenant_select on public.%I', t);
    execute format('drop policy if exists tenant_insert on public.%I', t);
    execute format('drop policy if exists tenant_update on public.%I', t);
    execute format($p$create policy admin_read on public.%I for select to authenticated
      using (public.is_platform_admin())$p$, t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Views
-- ---------------------------------------------------------------------------
create or replace view public.v_my_organizations
with (security_invoker = true) as
select o.*, m.member_role
from public.organizations o
join public.organization_members m on m.organization_id = o.id
where m.user_id = auth.uid() and m.deleted_at is null and o.deleted_at is null;

create or replace view public.v_active_subscriptions
with (security_invoker = true) as
select s.*, c.display_name, c.email as customer_email
from public.subscriptions s
join public.customers c on c.id = s.customer_id
where s.status = 'active' and s.deleted_at is null and c.deleted_at is null;

create or replace view public.v_open_group_orders
with (security_invoker = true) as
select g.*, d.name as drop_name, d.city as drop_city,
       (select count(*) from public.group_order_members m
         where m.group_order_id = g.id and m.deleted_at is null) as member_count
from public.group_orders g
join public.drop_locations d on d.id = g.drop_location_id
where g.status = 'open' and g.deleted_at is null;

-- Materialized daily KPI rollup (refresh via scheduled task / background job)
drop materialized view if exists public.mv_daily_org_kpis;
create materialized view public.mv_daily_org_kpis as
select
  o.organization_id,
  date_trunc('day', o.created_at)::date as day,
  count(*)                                        as orders,
  sum(o.total_cents)                              as revenue_cents,
  count(*) filter (where o.status = 'refunded')   as refunds,
  count(*) filter (where o.status = 'delivered')  as delivered
from public.orders o
where o.deleted_at is null
group by 1, 2;

create unique index if not exists mv_daily_org_kpis_pk
  on public.mv_daily_org_kpis (organization_id, day);

create or replace function public.refresh_daily_kpis() returns void
language sql security definer set search_path = public as $$
  refresh materialized view concurrently public.mv_daily_org_kpis;
$$;

grant select on public.v_my_organizations, public.v_active_subscriptions,
  public.v_open_group_orders to authenticated;
grant select on public.mv_daily_org_kpis to authenticated, service_role;
