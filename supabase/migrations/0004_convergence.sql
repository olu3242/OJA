-- ============================================================================
-- Migration 0004 — legacy convergence bridge
-- Maps every migrated legacy (Prisma/cuid) row to its canonical UUID row so
-- the backfill is idempotent and auditable. Follows all 0001 §Z conventions
-- explicitly (the mechanical pass ran in 0001 and does not re-run here).
-- ============================================================================

create table public.legacy_map (
  id uuid primary key default gen_random_uuid(),
  legacy_table text not null,           -- accounts | subscriptions | cycles | orders | order_lines
  legacy_id text not null,              -- Prisma cuid
  canonical_table text not null,
  canonical_id uuid not null,
  -- standard convention columns
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  organization_id uuid references public.organizations(id),
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  unique (legacy_table, legacy_id)
);

create index if not exists idx_legacy_map_organization_id on public.legacy_map (organization_id);
create index if not exists idx_legacy_map_created_by on public.legacy_map (created_by);
create index if not exists idx_legacy_map_updated_by on public.legacy_map (updated_by);
create index if not exists idx_legacy_map_canonical on public.legacy_map (canonical_table, canonical_id);

drop trigger if exists set_updated_at on public.legacy_map;
create trigger set_updated_at before update on public.legacy_map
  for each row execute function public.set_updated_at();

alter table public.legacy_map enable row level security;
-- Forensic/ops table: platform-admin read; writes via service_role only.
create policy admin_read on public.legacy_map for select to authenticated
  using (public.is_platform_admin());

grant all on public.legacy_map to authenticated, service_role;
grant select on public.legacy_map to anon;
