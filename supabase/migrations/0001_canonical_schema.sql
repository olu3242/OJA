-- ============================================================================
-- GAARII / Oja canonical schema — migration 0001
-- Single canonical data model converging identity, commerce, supply chain,
-- forecasting, eventing, auditing, and admin domains.
--
-- Conventions (enforced mechanically in section Z):
--   * UUID primary keys (gen_random_uuid())
--   * created_at / updated_at / deleted_at (soft delete) on every table
--   * organization_id + created_by / updated_by on every table
--   * updated_at trigger on every table; every FK indexed; RLS enabled
-- Runs on Supabase (auth schema present) AND plain Postgres 16 (local shim).
-- ============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- 0. Local-dev shims (no-ops on Supabase, guarded)
-- ---------------------------------------------------------------------------
do $$ begin
  if not exists (select 1 from pg_namespace where nspname = 'auth') then
    create schema auth;
  end if;
end $$;

-- auth.users shim for plain Postgres (Supabase already has it)
do $$ begin
  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'auth' and table_name = 'users'
  ) then
    create table auth.users (
      id uuid primary key default gen_random_uuid(),
      email text unique,
      raw_user_meta_data jsonb default '{}'::jsonb,
      created_at timestamptz not null default now()
    );
  end if;
end $$;

-- auth.uid() shim (Supabase defines this natively)
do $$ begin
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'auth' and p.proname = 'uid'
  ) then
    create function auth.uid() returns uuid
      language sql stable as
      $f$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $f$;
  end if;
end $$;

-- Supabase roles shim for plain Postgres
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 1. Shared trigger + helper functions
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create or replace function public.bump_version() returns trigger
language plpgsql as $$
begin
  if new.version is not distinct from old.version then
    new.version := old.version + 1;   -- optimistic locking
  end if;
  return new;
end $$;

-- ===========================================================================
-- PART 2 — IDENTITY LAYER
-- ===========================================================================

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  kind text not null check (kind in
    ('personal','household','group','business','restaurant','supplier','platform','enterprise')),
  country char(2) not null default 'US',
  onboarding_state text not null default 'pending'
    check (onboarding_state in ('pending','profile','complete')),
  settings jsonb not null default '{}'::jsonb
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade, -- 1:1 with auth user; NO duplicate users
  email text not null unique,
  full_name text,
  avatar_url text,
  phone text,
  country char(2) not null default 'US',
  locale text not null default 'en-US',
  legacy_account_id text unique,          -- link to pre-Supabase app account (cuid)
  default_organization_id uuid references public.organizations(id),
  onboarded_at timestamptz
);

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,               -- household_customer, group_organizer, ...
  name text not null,
  description text,
  is_system boolean not null default false
);

create table public.permissions (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,               -- subscriptions.manage, po.approve, ...
  description text
);

create table public.role_permissions (
  id uuid primary key default gen_random_uuid(),
  role_id uuid not null references public.roles(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  unique (role_id, permission_id)
);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete cascade,
  unique (user_id, role_id, organization_id)               -- org-scoped RBAC (org col added in Z)
);

create table public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  member_role text not null default 'member'
    check (member_role in ('owner','admin','member','viewer')),
  joined_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create table public.organization_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  email text not null,
  member_role text not null default 'member',
  token uuid not null unique default gen_random_uuid(),
  expires_at timestamptz not null default now() + interval '14 days',
  accepted_at timestamptz,
  unique (organization_id, email)
);

create table public.sessions (          -- app-level session registry (Supabase owns tokens)
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  supabase_session_id text,
  ip inet,
  user_agent text,
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz
);

create table public.devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  fingerprint text not null,
  label text,
  platform text,
  trusted boolean not null default false,
  last_seen_at timestamptz not null default now(),
  unique (user_id, fingerprint)
);

create table public.oauth_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null check (provider in ('google','apple','email')),
  provider_subject text not null,        -- Google `sub`
  provider_email text,
  linked_at timestamptz not null default now(),
  unique (provider, provider_subject)    -- an identity can only attach once → no duplicate users
);

create table public.login_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  event text not null check (event in ('signup','signin','link','refresh','logout','failed')),
  provider text,
  ip inet,
  user_agent text,
  detail jsonb not null default '{}'::jsonb
);

create table public.api_keys (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  hashed_key text not null unique,       -- store only the hash
  scopes text[] not null default '{}',
  last_used_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz
);

create table public.service_accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid,
  name text not null,
  description text,
  scopes text[] not null default '{}',
  unique (organization_id, name)
);

-- ===========================================================================
-- PART 3 — CUSTOMER MODEL
-- ===========================================================================

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  user_id uuid references public.profiles(id),
  kind text not null default 'household' check (kind in ('household','group_member','business')),
  display_name text not null,
  email text not null,
  phone text,
  country char(2) not null default 'US',
  unique (organization_id, email)
);

create table public.customer_addresses (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  label text not null default 'home',
  line1 text not null,
  line2 text,
  city text not null,
  region text not null,                  -- state/province
  postal_code text not null,
  country char(2) not null default 'US',
  is_default boolean not null default false
);

create table public.households (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  size int not null default 1 check (size > 0),
  consumption_lbs_per_month numeric(8,2)
);

create table public.family_members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  relation text,
  eats_garri boolean not null default true
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id),
  plan text not null check (plan in ('STARTER','FAMILY','STOCK_UP','WHOLESALE_STANDING')),
  status text not null default 'active'
    check (status in ('active','paused','cancelled','past_due')),
  cadence_days int not null default 30 check (cadence_days between 7 and 90),
  currency char(3) not null default 'USD',
  price_cents int not null check (price_cents >= 0),
  next_delivery_on date,
  paused_at timestamptz,
  cancelled_at timestamptz,
  version int not null default 1         -- optimistic locking
);

create table public.subscription_items (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.subscriptions(id) on delete cascade,
  product_variant_id uuid not null,      -- FK added after product_variants exists
  qty numeric(8,2) not null check (qty > 0),
  unit text not null default 'lb'
);

create table public.subscription_deliveries (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.subscriptions(id) on delete cascade,
  order_id uuid,                          -- FK added after orders exists
  scheduled_for date not null,
  status text not null default 'upcoming'
    check (status in ('upcoming','confirmed','skipped','ordered','fulfilled')),
  confirmed_at timestamptz
);

create table public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  provider text not null default 'stripe',
  provider_ref text not null,             -- pm_xxx token; never raw PANs
  brand text,
  last4 char(4),
  exp_month int,
  exp_year int,
  is_default boolean not null default false,
  unique (provider, provider_ref)
);

create table public.payment_attempts (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id),
  payment_method_id uuid references public.payment_methods(id),
  amount_cents int not null,
  currency char(3) not null default 'USD',
  status text not null check (status in ('pending','succeeded','failed')),
  failure_reason text,
  provider_ref text
);

create table public.wallets (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  currency char(3) not null default 'USD',
  balance_cents int not null default 0 check (balance_cents >= 0),
  version int not null default 1,
  unique (customer_id, currency)
);

create table public.credits (
  id uuid primary key default gen_random_uuid(),
  wallet_id uuid not null references public.wallets(id) on delete cascade,
  amount_cents int not null,              -- signed ledger entry
  reason text not null,                   -- referral, sla_credit, refund, promo
  reference_id uuid,
  expires_at timestamptz
);

create table public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_customer_id uuid not null references public.customers(id),
  code text not null unique,
  referred_customer_id uuid references public.customers(id),
  status text not null default 'pending' check (status in ('pending','qualified','rewarded','void')),
  qualified_at timestamptz
);

create table public.referral_rewards (
  id uuid primary key default gen_random_uuid(),
  referral_id uuid not null references public.referrals(id) on delete cascade,
  credit_id uuid references public.credits(id),
  amount_cents int not null check (amount_cents > 0),
  capped boolean not null default false
);

-- ===========================================================================
-- PART 7 — PRODUCT CATALOG (before order/group parts that reference it)
-- ===========================================================================

create table public.product_categories (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  parent_id uuid references public.product_categories(id)
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.product_categories(id),
  code text not null unique,
  name text not null,
  local_names text[] not null default '{}',
  origin_country char(2) not null default 'NG',
  perishability text not null default 'shelf_stable'
    check (perishability in ('shelf_stable','refrigerated','frozen','fresh')),
  halal boolean not null default true,
  shelf_life_days int,
  fda_labeling text,
  cfia_labeling text,
  active boolean not null default true
);

create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  sku text not null unique,
  variant text not null,                  -- WHITE_IJEBU / YELLOW
  grind text check (grind in ('coarse','fine')),
  unit text not null default 'lb',
  unit_weight_grams int,
  active boolean not null default true
);

create table public.price_books (
  id uuid primary key default gen_random_uuid(),
  tier text not null check (tier in ('retail','member','wholesale')),
  name text not null,
  currency char(3) not null default 'USD',
  active boolean not null default true,
  effective_from timestamptz not null default now()
);

create table public.pricing_rules (
  id uuid primary key default gen_random_uuid(),
  price_book_id uuid not null references public.price_books(id) on delete cascade,
  product_variant_id uuid not null references public.product_variants(id),
  unit_price_cents int not null check (unit_price_cents >= 0),
  min_qty numeric(8,2) not null default 1,
  unique (price_book_id, product_variant_id, min_qty)
);

create table public.country_pricing (
  id uuid primary key default gen_random_uuid(),
  country char(2) not null,
  currency char(3) not null,
  fx_buffer numeric(6,4) not null default 1.0,
  region_surcharges jsonb not null default '{}'::jsonb,   -- {"NU": 2000, ...}
  unique (country)
);

-- ===========================================================================
-- PART 11 — SUPPLY CHAIN (warehouses before inventory/orders)
-- ===========================================================================

create table public.warehouses (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  region text not null,
  country char(2) not null default 'US',
  active boolean not null default true
);

create table public.inventory (
  id uuid primary key default gen_random_uuid(),
  warehouse_id uuid not null references public.warehouses(id),
  product_variant_id uuid not null references public.product_variants(id),
  lot_code text not null unique,
  received_at timestamptz not null default now(),
  expires_at timestamptz,
  purchase_order_item_id uuid              -- FK added after PO items exist
);

create table public.inventory_movements (   -- append-only ledger
  id uuid primary key default gen_random_uuid(),
  inventory_id uuid not null references public.inventory(id),
  movement text not null check (movement in
    ('receive','qc_fail','pick','ship','adjust','transfer_out','transfer_in','markdown')),
  qty numeric(10,2) not null,               -- signed
  order_item_id uuid,
  reason text
);

create table public.warehouse_inventory (    -- derived cache, versioned
  id uuid primary key default gen_random_uuid(),
  warehouse_id uuid not null references public.warehouses(id),
  product_variant_id uuid not null references public.product_variants(id),
  on_hand numeric(12,2) not null default 0,
  version int not null default 1,
  unique (warehouse_id, product_variant_id)
);

create table public.containers (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  capacity_lbs int not null default 24000,
  status text not null default 'planned'
    check (status in ('planned','booked','in_transit','customs','received')),
  eta date
);

create table public.container_items (
  id uuid primary key default gen_random_uuid(),
  container_id uuid not null references public.containers(id) on delete cascade,
  product_variant_id uuid not null references public.product_variants(id),
  qty_lbs numeric(12,2) not null check (qty_lbs > 0)
);

create table public.import_shipments (
  id uuid primary key default gen_random_uuid(),
  container_id uuid references public.containers(id),
  origin_port text,
  destination_port text,
  departed_at date,
  arrived_at date,
  customs_cleared_at date
);

create table public.customs_documents (
  id uuid primary key default gen_random_uuid(),
  import_shipment_id uuid not null references public.import_shipments(id) on delete cascade,
  doc_type text not null,                   -- bill_of_lading, fda_prior_notice, cfia_permit
  file_id uuid,                             -- FK added after files exist
  status text not null default 'pending' check (status in ('pending','submitted','approved','rejected'))
);

create table public.carrier_rates (
  id uuid primary key default gen_random_uuid(),
  carrier text not null,
  country char(2) not null default 'US',
  zone text not null,
  weight_lbs_min numeric(6,2) not null,
  weight_lbs_max numeric(6,2) not null,
  rate_cents int not null,
  effective_from date not null default current_date
);

create table public.delivery_routes (
  id uuid primary key default gen_random_uuid(),
  warehouse_id uuid not null references public.warehouses(id),
  name text not null,
  region text not null,
  day_of_week int check (day_of_week between 0 and 6),
  active boolean not null default true
);

-- ===========================================================================
-- PART 8 — ORDERS
-- ===========================================================================

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id),
  subscription_delivery_id uuid references public.subscription_deliveries(id),
  status text not null default 'pending' check (status in
    ('pending','paid','picking','packed','shipped','delivered','cancelled','refunded')),
  currency char(3) not null default 'USD',
  subtotal_cents int not null default 0,
  discount_cents int not null default 0,
  shipping_cents int not null default 0,
  tax_cents int not null default 0,
  total_cents int not null default 0,
  ship_line1 text not null,
  ship_city text not null,
  ship_region text not null,
  ship_postal_code text not null,
  ship_country char(2) not null default 'US',
  version int not null default 1
);

alter table public.subscription_deliveries
  add constraint subscription_deliveries_order_fk
  foreign key (order_id) references public.orders(id);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_variant_id uuid not null references public.product_variants(id),
  qty numeric(8,2) not null check (qty > 0),
  unit_price_cents int not null check (unit_price_cents >= 0)
);

alter table public.subscription_items
  add constraint subscription_items_variant_fk
  foreign key (product_variant_id) references public.product_variants(id);

alter table public.inventory_movements
  add constraint inventory_movements_order_item_fk
  foreign key (order_item_id) references public.order_items(id);

create table public.shipments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id),
  carrier text,
  tracking_code text unique,
  status text not null default 'label_created' check (status in
    ('label_created','in_transit','out_for_delivery','delivered','exception','returned')),
  shipped_at timestamptz,
  delivered_at timestamptz
);

create table public.shipment_items (
  id uuid primary key default gen_random_uuid(),
  shipment_id uuid not null references public.shipments(id) on delete cascade,
  order_item_id uuid not null references public.order_items(id),
  qty numeric(8,2) not null check (qty > 0)
);

create table public.tracking_events (
  id uuid primary key default gen_random_uuid(),
  shipment_id uuid not null references public.shipments(id) on delete cascade,
  status text not null,
  description text,
  location text,
  occurred_at timestamptz not null default now()
);

create table public.delivery_windows (
  id uuid primary key default gen_random_uuid(),
  route_id uuid references public.delivery_routes(id),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  capacity int not null default 50,
  check (ends_at > starts_at)
);

create table public.returns (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id),
  reason_code text not null,
  status text not null default 'requested' check (status in ('requested','approved','waived','closed')),
  notes text
);

create table public.refunds (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id),
  return_id uuid references public.returns(id),
  amount_cents int not null check (amount_cents > 0),
  reason_code text not null,
  provider_ref text
);

-- ===========================================================================
-- PART 4 — GROUP ORDERING
-- ===========================================================================

create table public.drop_locations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  line1 text not null,
  city text not null,
  region text not null,
  postal_code text not null,
  country char(2) not null default 'US',
  contact_phone text
);

create table public.group_orders (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  organizer_customer_id uuid not null references public.customers(id),
  drop_location_id uuid not null references public.drop_locations(id),
  status text not null default 'open' check (status in ('open','closed','fulfilled','cancelled')),
  order_id uuid references public.orders(id),
  closes_at timestamptz
);

create table public.group_order_members (
  id uuid primary key default gen_random_uuid(),
  group_order_id uuid not null references public.group_orders(id) on delete cascade,
  customer_id uuid not null references public.customers(id),
  status text not null default 'joined' check (status in ('joined','paid','withdrawn')),
  unique (group_order_id, customer_id)
);

create table public.group_order_items (
  id uuid primary key default gen_random_uuid(),
  group_order_member_id uuid not null references public.group_order_members(id) on delete cascade,
  product_variant_id uuid not null references public.product_variants(id),
  qty numeric(8,2) not null check (qty > 0),
  unit_price_cents int not null
);

create table public.group_order_events (
  id uuid primary key default gen_random_uuid(),
  group_order_id uuid not null references public.group_orders(id) on delete cascade,
  event text not null,                     -- created, member_joined, closed, discount_applied
  payload jsonb not null default '{}'::jsonb
);

create table public.delivery_clusters (
  id uuid primary key default gen_random_uuid(),
  route_id uuid references public.delivery_routes(id),
  name text not null,
  postal_prefixes text[] not null default '{}',
  target_density int not null default 25
);

-- ===========================================================================
-- PART 5 — WHOLESALE
-- ===========================================================================

create table public.business_accounts (
  id uuid primary key default gen_random_uuid(),
  legal_name text not null,
  trade_name text,
  kind text not null check (kind in ('store','restaurant','caterer','distributor')),
  tax_id text,
  verified_at timestamptz,
  net_terms text not null default 'none' check (net_terms in ('none','requested','net15','net30','suspended'))
);

create table public.business_locations (
  id uuid primary key default gen_random_uuid(),
  business_account_id uuid not null references public.business_accounts(id) on delete cascade,
  name text not null,
  line1 text not null,
  city text not null,
  region text not null,
  postal_code text not null,
  country char(2) not null default 'US'
);

create table public.wholesale_accounts (
  id uuid primary key default gen_random_uuid(),
  business_account_id uuid not null references public.business_accounts(id) on delete cascade,
  customer_id uuid not null references public.customers(id),
  price_book_id uuid references public.price_books(id),
  volume_tier int not null default 1 check (volume_tier between 1 and 3),
  unique (business_account_id)
);

create table public.standing_orders (
  id uuid primary key default gen_random_uuid(),
  wholesale_account_id uuid not null references public.wholesale_accounts(id) on delete cascade,
  business_location_id uuid references public.business_locations(id),
  cadence_days int not null default 7,
  status text not null default 'active' check (status in ('active','paused','cancelled')),
  sla_window text,
  version int not null default 1
);

create table public.standing_order_items (
  id uuid primary key default gen_random_uuid(),
  standing_order_id uuid not null references public.standing_orders(id) on delete cascade,
  product_variant_id uuid not null references public.product_variants(id),
  qty_lbs numeric(8,2) not null check (qty_lbs >= 50),
  contracted boolean not null default false   -- SLA-protected line
);

create table public.rebates (
  id uuid primary key default gen_random_uuid(),
  wholesale_account_id uuid not null references public.wholesale_accounts(id),
  quarter text not null,                       -- 2026-Q3
  spend_cents bigint not null default 0,
  rebate_cents int not null default 0,
  paid_as_credit_id uuid references public.credits(id),
  unique (wholesale_account_id, quarter)
);

create table public.sla_credits (
  id uuid primary key default gen_random_uuid(),
  wholesale_account_id uuid not null references public.wholesale_accounts(id),
  order_id uuid references public.orders(id),
  shortfall_cents int not null check (shortfall_cents > 0),
  credit_cents int not null check (credit_cents > 0),   -- 2× shortfall
  credit_id uuid references public.credits(id)
);

-- ===========================================================================
-- PART 6 — SUPPLIERS
-- ===========================================================================

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid,
  name text not null,
  country char(2) not null default 'NG',
  contact_email text,
  fast_pay boolean not null default false,
  quality_spec jsonb not null default '{}'::jsonb,
  unique (organization_id, name)
);

create table public.supplier_users (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  portal_role text not null default 'member' check (portal_role in ('owner','member')),
  unique (supplier_id, user_id)
);

create table public.supplier_products (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  product_variant_id uuid not null references public.product_variants(id),
  unit_cost_cents int not null check (unit_cost_cents > 0),
  lead_time_weeks int not null default 8,
  priority_allocation boolean not null default false,
  unique (supplier_id, product_variant_id)
);

create table public.supplier_forecasts (      -- forward visibility shared with supplier
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  product_variant_id uuid not null references public.product_variants(id),
  week_start date not null,
  qty_lbs numeric(12,2) not null,
  committed boolean not null default false,    -- forward commitment vs. share
  unique (supplier_id, product_variant_id, week_start)
);

create table public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.suppliers(id),
  warehouse_id uuid not null references public.warehouses(id),
  status text not null default 'draft' check (status in
    ('draft','placed','partially_received','received','cancelled')),
  expected_at date,
  placed_at timestamptz,
  version int not null default 1
);

create table public.purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references public.purchase_orders(id) on delete cascade,
  product_variant_id uuid not null references public.product_variants(id),
  qty_lbs numeric(12,2) not null check (qty_lbs > 0),
  unit_cost_cents int not null,
  received_lbs numeric(12,2) not null default 0
);

alter table public.inventory
  add constraint inventory_po_item_fk
  foreign key (purchase_order_item_id) references public.purchase_order_items(id);

create table public.supplier_shipments (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references public.purchase_orders(id),
  import_shipment_id uuid references public.import_shipments(id),
  shipped_at date,
  received_at date
);

create table public.supplier_invoices (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.suppliers(id),
  purchase_order_id uuid references public.purchase_orders(id),
  amount_cents bigint not null,
  currency char(3) not null default 'USD',
  terms text not null default 'net30' check (terms in ('net30','fast_pay_net7')),
  due_at date,
  paid_at date
);

-- ===========================================================================
-- PART 9 — PAYMENTS
-- ===========================================================================

create table public.currencies (
  id uuid primary key default gen_random_uuid(),
  code char(3) not null unique,
  name text not null,
  minor_units int not null default 2
);

create table public.exchange_rates (
  id uuid primary key default gen_random_uuid(),
  base char(3) not null,
  quote char(3) not null,
  rate numeric(16,8) not null check (rate > 0),
  as_of date not null,
  unique (base, quote, as_of)
);

create table public.tax_rates (
  id uuid primary key default gen_random_uuid(),
  country char(2) not null,
  region text,
  name text not null,
  rate numeric(6,4) not null check (rate >= 0),
  active boolean not null default true
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id),
  customer_id uuid not null references public.customers(id),
  payment_attempt_id uuid references public.payment_attempts(id),
  amount_cents int not null,
  currency char(3) not null default 'USD',
  status text not null check (status in ('pending','captured','refunded','failed')),
  provider text not null default 'stripe',
  provider_ref text unique
);

create table public.payment_events (        -- provider webhook mirror, append-only
  id uuid primary key default gen_random_uuid(),
  payment_id uuid references public.payments(id),
  provider text not null,
  event_type text not null,
  provider_event_id text unique,             -- webhook idempotency
  payload jsonb not null default '{}'::jsonb
);

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id),
  order_id uuid references public.orders(id),
  number text not null unique,
  currency char(3) not null default 'USD',
  subtotal_cents bigint not null default 0,
  tax_cents bigint not null default 0,
  total_cents bigint not null default 0,
  due_at date,
  paid_at date,
  version int not null default 1
);

create table public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  description text not null,
  qty numeric(10,2) not null default 1,
  unit_price_cents int not null,
  tax_rate_id uuid references public.tax_rates(id)
);

create table public.credit_notes (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id),
  amount_cents bigint not null check (amount_cents > 0),
  reason text not null
);

-- ===========================================================================
-- PART 10 — POS
-- ===========================================================================

create table public.pos_integrations (
  id uuid primary key default gen_random_uuid(),
  business_account_id uuid not null references public.business_accounts(id),
  provider text not null check (provider in ('square','clover','manual')),
  external_id text,
  webhook_secret_hash text not null,
  active boolean not null default true,
  unique (business_account_id, provider)
);

create table public.pos_events (              -- raw webhook mirror
  id uuid primary key default gen_random_uuid(),
  pos_integration_id uuid not null references public.pos_integrations(id),
  provider_event_id text not null,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  processed_at timestamptz,
  unique (pos_integration_id, provider_event_id)  -- webhook idempotency
);

create table public.sell_through_events (
  id uuid primary key default gen_random_uuid(),
  pos_event_id uuid references public.pos_events(id),
  business_account_id uuid not null references public.business_accounts(id),
  product_variant_id uuid not null references public.product_variants(id),
  units_sold numeric(10,2) not null check (units_sold >= 0),
  period_end date not null
);

create table public.forecast_inputs (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('subscription','sell_through','order_history','event_calendar','override')),
  product_variant_id uuid not null references public.product_variants(id),
  warehouse_id uuid references public.warehouses(id),
  week_start date not null,
  qty_lbs numeric(12,2) not null,
  metadata jsonb not null default '{}'::jsonb
);

-- ===========================================================================
-- PART 12 — FORECASTING
-- ===========================================================================

create table public.forecast_models (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,                  -- v0_committed_blend, v1_events_calendar
  name text not null,
  status text not null default 'shadow' check (status in ('shadow','active','retired')),
  config jsonb not null default '{}'::jsonb
);

create table public.forecast_runs (
  id uuid primary key default gen_random_uuid(),
  forecast_model_id uuid not null references public.forecast_models(id),
  version int not null,
  horizon_weeks int not null default 4,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  unique (forecast_model_id, version)
);

create table public.forecast_results (       -- versioned inserts, never updated
  id uuid primary key default gen_random_uuid(),
  forecast_run_id uuid not null references public.forecast_runs(id) on delete cascade,
  product_variant_id uuid not null references public.product_variants(id),
  warehouse_id uuid not null references public.warehouses(id),
  week_start date not null,
  qty_lbs numeric(12,2) not null
);

create table public.forecast_overrides (
  id uuid primary key default gen_random_uuid(),
  forecast_result_id uuid not null references public.forecast_results(id),
  qty_lbs numeric(12,2) not null,
  reason_code text not null
);

create table public.forecast_metrics (
  id uuid primary key default gen_random_uuid(),
  forecast_model_id uuid not null references public.forecast_models(id),
  week_start date not null,
  wape numeric(8,4),
  bias numeric(8,4),
  unique (forecast_model_id, week_start)
);

-- ===========================================================================
-- PART 13 — EVENT STORE (canonical event sourcing)
-- ===========================================================================

create table public.events (                  -- append-only source of truth
  id uuid primary key default gen_random_uuid(),
  stream text not null,                       -- e.g. subscription:uuid, order:uuid
  seq bigint generated always as identity,
  event_type text not null,                   -- subscription.confirmed, order.shipped ...
  actor_user_id uuid references public.profiles(id),
  payload jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  unique (stream, seq)
);

create table public.event_handlers (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,                   -- projector/consumer name
  event_types text[] not null default '{}',
  last_processed_seq bigint not null default 0,
  active boolean not null default true
);

create table public.event_failures (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id),
  event_handler_id uuid not null references public.event_handlers(id),
  error text not null,
  attempts int not null default 1,
  last_attempt_at timestamptz not null default now()
);

create table public.event_replays (
  id uuid primary key default gen_random_uuid(),
  event_handler_id uuid not null references public.event_handlers(id),
  from_seq bigint not null,
  to_seq bigint,
  status text not null default 'requested' check (status in ('requested','running','done','failed')),
  requested_by uuid references public.profiles(id)
);

create table public.dead_letter_queue (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.events(id),
  event_handler_id uuid references public.event_handlers(id),
  payload jsonb not null default '{}'::jsonb,
  error text not null,
  parked_at timestamptz not null default now(),
  resolved_at timestamptz
);

-- ===========================================================================
-- PART 14 — AUDITING
-- ===========================================================================

create table public.audit_logs (              -- row-change audit, append-only
  id uuid primary key default gen_random_uuid(),
  table_name text not null,
  row_id uuid,
  action text not null check (action in ('insert','update','soft_delete','delete')),
  actor_user_id uuid references public.profiles(id),
  before jsonb,
  after jsonb
);

create table public.activity_logs (           -- user-visible activity feed
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id),
  activity text not null,
  subject_type text,
  subject_id uuid,
  detail jsonb not null default '{}'::jsonb
);

create table public.security_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id),
  severity text not null default 'info' check (severity in ('info','warning','critical')),
  event text not null,                        -- login_failed_burst, role_escalation, rls_denied
  ip inet,
  detail jsonb not null default '{}'::jsonb
);

create table public.admin_actions (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references public.profiles(id),
  action text not null,                       -- refund.issue, lead.approve, forecast.override
  subject_type text,
  subject_id uuid,
  justification text,
  detail jsonb not null default '{}'::jsonb
);

-- ===========================================================================
-- PART 15 — NOTIFICATIONS
-- ===========================================================================

create table public.notification_templates (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  channel text not null check (channel in ('email','sms','push','whatsapp')),
  subject text,
  body text not null,
  locale text not null default 'en-US'
);

create table public.notification_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  channel text not null check (channel in ('email','sms','push','whatsapp')),
  category text not null,                     -- cycle_reminders, marketing, delivery
  enabled boolean not null default true,
  unique (user_id, channel, category)
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  template_id uuid references public.notification_templates(id),
  channel text not null,
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  sent_at timestamptz
);

create table public.email_queue (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid references public.notifications(id),
  to_email text not null,
  subject text not null,
  body text not null,
  status text not null default 'queued' check (status in ('queued','sending','sent','failed')),
  attempts int not null default 0,
  send_after timestamptz not null default now()
);

create table public.sms_queue (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid references public.notifications(id),
  to_phone text not null,
  body text not null,
  status text not null default 'queued' check (status in ('queued','sending','sent','failed')),
  attempts int not null default 0,
  send_after timestamptz not null default now()
);

create table public.push_queue (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid references public.notifications(id),
  device_id uuid references public.devices(id),
  title text not null,
  body text not null,
  status text not null default 'queued' check (status in ('queued','sending','sent','failed')),
  attempts int not null default 0,
  send_after timestamptz not null default now()
);

-- ===========================================================================
-- PART 16 — FILES
-- ===========================================================================

create table public.files (
  id uuid primary key default gen_random_uuid(),
  bucket text not null,
  path text not null,
  mime_type text,
  size_bytes bigint,
  checksum text,
  unique (bucket, path)
);

alter table public.customs_documents
  add constraint customs_documents_file_fk
  foreign key (file_id) references public.files(id);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  file_id uuid not null references public.files(id),
  doc_type text not null,                     -- invoice_pdf, quality_cert, business_license
  subject_type text,
  subject_id uuid
);

create table public.media_assets (
  id uuid primary key default gen_random_uuid(),
  file_id uuid not null references public.files(id),
  kind text not null check (kind in ('product_photo','banner','video','logo')),
  alt_text text,
  product_id uuid references public.products(id)
);

create table public.avatars (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  file_id uuid not null references public.files(id),
  unique (user_id)
);

-- ===========================================================================
-- PART 17 — MARKETING
-- ===========================================================================

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  channel text not null,
  starts_at timestamptz,
  ends_at timestamptz,
  budget_cents bigint,
  intent text check (intent in ('acquisition','cycle_save','spoilage_avoid','density_building'))
);

create table public.promo_codes (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references public.campaigns(id),
  code text not null unique,
  max_redemptions int,
  redemptions int not null default 0,
  first_delivery_only boolean not null default true,   -- margin rule: no permanent discounts
  expires_at timestamptz
);

create table public.discounts (
  id uuid primary key default gen_random_uuid(),
  promo_code_id uuid references public.promo_codes(id),
  order_id uuid references public.orders(id),
  amount_cents int not null check (amount_cents > 0),
  kind text not null check (kind in ('first_delivery','group_tier','markdown','referral'))
);

create table public.landing_pages (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  content jsonb not null default '{}'::jsonb,
  published_at timestamptz
);

create table public.waitlists (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('household','wholesale','supplier','country')),
  email text not null,
  name text,
  detail jsonb not null default '{}'::jsonb,
  converted_at timestamptz,
  unique (kind, email)
);

-- ===========================================================================
-- PART 18 — ANALYTICS
-- ===========================================================================

create table public.daily_metrics (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid,
  metric_date date not null,
  metric text not null,
  value numeric(18,4) not null,
  dims jsonb not null default '{}'::jsonb,
  unique (organization_id, metric_date, metric, dims)
);

create table public.weekly_metrics (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid,
  week_start date not null,
  metric text not null,
  value numeric(18,4) not null,
  dims jsonb not null default '{}'::jsonb,
  unique (organization_id, week_start, metric, dims)
);

create table public.monthly_metrics (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid,
  month_start date not null,
  metric text not null,
  value numeric(18,4) not null,
  dims jsonb not null default '{}'::jsonb,
  unique (organization_id, month_start, metric, dims)
);

create table public.kpi_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid,
  as_of date not null,
  active_subscribers int not null default 0,
  cycle_confirm_rate numeric(6,4),
  on_time_rate numeric(6,4),
  gross_margin numeric(6,4),
  wape numeric(6,4),
  refund_rate numeric(6,4),
  unique (organization_id, as_of)
);

create table public.customer_ltv (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id),
  as_of date not null,
  revenue_cents bigint not null default 0,
  margin_cents bigint not null default 0,
  predicted_ltv_cents bigint,
  unique (customer_id, as_of)
);

create table public.cohort_analysis (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid,
  cohort_month date not null,
  month_offset int not null,
  retained int not null default 0,
  churned int not null default 0,
  revenue_cents bigint not null default 0,
  unique (organization_id, cohort_month, month_offset)
);

-- ===========================================================================
-- PART 19 — ADMIN
-- ===========================================================================

create table public.feature_flags (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  description text,
  enabled boolean not null default false,
  rules jsonb not null default '{}'::jsonb
);

create table public.system_settings (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  value jsonb not null,
  description text
);

create table public.background_jobs (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'queued' check (status in ('queued','running','done','failed')),
  attempts int not null default 0,
  run_after timestamptz not null default now(),
  locked_at timestamptz,
  last_error text
);

create table public.scheduled_tasks (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,                  -- nightly_forecast, cycle_generation
  cron text not null,
  last_run_at timestamptz,
  next_run_at timestamptz,
  active boolean not null default true
);

-- ===========================================================================
-- SECTION Z — MECHANICAL STANDARDIZATION PASS
-- Adds the universal columns, triggers, indexes, and RLS to EVERY table.
-- ===========================================================================
do $$
declare
  t record;
  fk record;
  col_exists boolean;
begin
  for t in
    select c.relname as tbl
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
  loop
    -- Universal audit columns -------------------------------------------------
    execute format('alter table public.%I
        add column if not exists created_at timestamptz not null default now(),
        add column if not exists updated_at timestamptz not null default now(),
        add column if not exists deleted_at timestamptz,
        add column if not exists organization_id uuid,
        add column if not exists created_by uuid,
        add column if not exists updated_by uuid', t.tbl);

    -- FKs for audit columns. Skipped for the org itself and for forensic
    -- stores, whose rows must survive hard-deletion of their subject org.
    if t.tbl not in ('organizations','audit_logs','activity_logs',
                     'security_events','login_history','events','admin_actions') then
      execute format('alter table public.%I
          drop constraint if exists %I,
          add constraint %I foreign key (organization_id) references public.organizations(id)',
        t.tbl, t.tbl || '_org_fk', t.tbl || '_org_fk');
    end if;
    execute format('alter table public.%I
        drop constraint if exists %I,
        add constraint %I foreign key (created_by) references public.profiles(id)',
      t.tbl, t.tbl || '_created_by_fk', t.tbl || '_created_by_fk');
    execute format('alter table public.%I
        drop constraint if exists %I,
        add constraint %I foreign key (updated_by) references public.profiles(id)',
      t.tbl, t.tbl || '_updated_by_fk', t.tbl || '_updated_by_fk');

    -- updated_at trigger ------------------------------------------------------
    execute format('drop trigger if exists set_updated_at on public.%I', t.tbl);
    execute format('create trigger set_updated_at before update on public.%I
        for each row execute function public.set_updated_at()', t.tbl);

    -- Optimistic locking trigger where a version column exists ---------------
    select exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = t.tbl and column_name = 'version'
    ) into col_exists;
    if col_exists then
      execute format('drop trigger if exists bump_version on public.%I', t.tbl);
      execute format('create trigger bump_version before update on public.%I
          for each row execute function public.bump_version()', t.tbl);
    end if;

    -- Enable RLS everywhere ---------------------------------------------------
    execute format('alter table public.%I enable row level security', t.tbl);
  end loop;

  -- Index every foreign key ---------------------------------------------------
  for fk in
    select conrelid::regclass::text as tbl,
           (select attname from pg_attribute
             where attrelid = conrelid and attnum = conkey[1]) as col
    from pg_constraint
    where contype = 'f'
      and connamespace = 'public'::regnamespace
      and array_length(conkey, 1) = 1
  loop
    execute format('create index if not exists %I on %s (%I)',
      'idx_' || replace(replace(fk.tbl, 'public.', ''), '"', '') || '_' || fk.col,
      fk.tbl, fk.col);
  end loop;
end $$;

-- Soft-delete visibility indexes on the hottest tables
create index if not exists idx_subscriptions_active
  on public.subscriptions (organization_id, status) where deleted_at is null;
create index if not exists idx_orders_status
  on public.orders (organization_id, status) where deleted_at is null;
create index if not exists idx_events_stream
  on public.events (stream, seq);
create index if not exists idx_background_jobs_pick
  on public.background_jobs (status, run_after) where deleted_at is null;

-- Grants (Supabase parity: authenticated works through RLS, service_role bypasses)
grant usage on schema public to authenticated, anon, service_role;
grant all on all tables in schema public to authenticated, service_role;
-- anon: RLS default-deny means these grants expose only policy-allowed rows
-- (public catalog reference data + waitlist signup).
grant select on all tables in schema public to anon;
grant insert on public.waitlists to anon;
grant usage, select on all sequences in schema public to authenticated, anon, service_role;
