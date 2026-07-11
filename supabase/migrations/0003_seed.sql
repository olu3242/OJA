-- ============================================================================
-- Migration 0003 — canonical seed (idempotent; safe to re-run)
-- RBAC matrix, currencies, tax, country pricing, garri catalog, warehouse,
-- notification templates, feature flags, scheduled tasks, forecast models.
-- ============================================================================

-- Roles ----------------------------------------------------------------------
insert into public.roles (key, name, is_system, description) values
  ('platform_admin',     'Platform Admin',       true,  'Internal GAARII operators'),
  ('warehouse_ops',      'Warehouse Operator',   true,  '3PL / fulfillment staff'),
  ('household_customer', 'Household Customer',   false, 'Direct subscriber'),
  ('group_organizer',    'Group Organizer',      false, 'Runs community group orders'),
  ('group_member',       'Group Member',         false, 'Participates in group orders'),
  ('wholesale_store',    'Wholesale Store',      false, 'Verified B2B store buyer'),
  ('restaurant',         'Restaurant',           false, 'Verified B2B restaurant buyer'),
  ('supplier',           'Supplier',             false, 'Processor/exporter portal user')
on conflict (key) do nothing;

-- Permissions ------------------------------------------------------------------
insert into public.permissions (key, description) values
  ('subscriptions.manage',   'Create/pause/cancel own subscriptions'),
  ('group_orders.create',    'Create group orders'),
  ('group_orders.join',      'Join group orders'),
  ('wholesale.standing_orders', 'Manage standing orders'),
  ('supplier.portal',        'View shared forecasts & POs'),
  ('catalog.read',           'Browse the catalog'),
  ('orders.read.own',        'Read own orders'),
  ('warehouse.receive',      'Receive inventory against POs'),
  ('warehouse.fulfill',      'Pick/pack/ship orders'),
  ('admin.forecast.override','Override forecasts'),
  ('admin.refunds',          'Issue refunds'),
  ('admin.rbac',             'Manage roles and permissions'),
  ('admin.leads.approve',    'Graduate wholesale leads'),
  ('admin.flags',            'Manage feature flags')
on conflict (key) do nothing;

-- Role → permission matrix -----------------------------------------------------
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.key = any (case r.key
  when 'platform_admin' then array[
    'subscriptions.manage','group_orders.create','group_orders.join',
    'wholesale.standing_orders','supplier.portal','catalog.read','orders.read.own',
    'warehouse.receive','warehouse.fulfill','admin.forecast.override','admin.refunds',
    'admin.rbac','admin.leads.approve','admin.flags']
  when 'warehouse_ops'      then array['catalog.read','warehouse.receive','warehouse.fulfill']
  when 'household_customer' then array['subscriptions.manage','group_orders.join','catalog.read','orders.read.own']
  when 'group_organizer'    then array['subscriptions.manage','group_orders.create','group_orders.join','catalog.read','orders.read.own']
  when 'group_member'       then array['group_orders.join','catalog.read','orders.read.own']
  when 'wholesale_store'    then array['wholesale.standing_orders','catalog.read','orders.read.own']
  when 'restaurant'         then array['wholesale.standing_orders','catalog.read','orders.read.own']
  when 'supplier'           then array['supplier.portal']
  else array[]::text[] end)
on conflict (role_id, permission_id) do nothing;

-- Money -------------------------------------------------------------------------
insert into public.currencies (code, name, minor_units) values
  ('USD', 'US Dollar', 2), ('CAD', 'Canadian Dollar', 2), ('NGN', 'Nigerian Naira', 2)
on conflict (code) do nothing;

insert into public.country_pricing (country, currency, fx_buffer, region_surcharges) values
  ('US', 'USD', 1.0,  '{"AK":1500,"HI":1500,"PR":1500}'),
  ('CA', 'CAD', 1.45, '{"YT":2000,"NT":2000,"NU":2000}')
on conflict (country) do nothing;

insert into public.tax_rates (country, region, name, rate) values
  ('US', 'TX', 'TX grocery exemption', 0),
  ('CA', 'ON', 'HST (zero-rated basic groceries)', 0)
on conflict do nothing;

-- Catalog: one product, two variants (single-product MVP invariant) --------------
insert into public.product_categories (key, name)
values ('grains_flours', 'Grains & Flours')
on conflict (key) do nothing;

insert into public.products (category_id, code, name, local_names, origin_country,
                             perishability, halal, shelf_life_days, cfia_labeling)
select c.id, 'GARRI', 'Premium Nigerian Garri',
       array['Garri','Gari','Cassava Grits'], 'NG', 'shelf_stable', true, 365,
       'Product of Nigeria / Produit du Nigéria'
from public.product_categories c where c.key = 'grains_flours'
on conflict (code) do nothing;

insert into public.product_variants (product_id, sku, variant, grind, unit, unit_weight_grams)
select p.id, v.sku, v.variant, v.grind, 'lb', 454
from public.products p
cross join (values
  ('GAR-WHT-IJEBU', 'WHITE_IJEBU', 'coarse'),
  ('GAR-YEL',       'YELLOW',      'coarse')
) as v(sku, variant, grind)
where p.code = 'GARRI'
on conflict (sku) do nothing;

-- Price books ---------------------------------------------------------------------
insert into public.price_books (tier, name, currency) values
  ('retail',    'US retail',    'USD'),
  ('member',    'US member',    'USD'),
  ('wholesale', 'US wholesale', 'USD')
on conflict do nothing;

insert into public.pricing_rules (price_book_id, product_variant_id, unit_price_cents, min_qty)
select b.id, v.id,
       case b.tier when 'retail' then 259 when 'member' then 242 else 183 end,
       case b.tier when 'wholesale' then 50 else 1 end
from public.price_books b cross join public.product_variants v
on conflict (price_book_id, product_variant_id, min_qty) do nothing;

-- Warehouse -------------------------------------------------------------------------
insert into public.warehouses (code, name, region, country)
values ('HOU-1', 'Houston 3PL', 'US-CENTRAL', 'US')
on conflict (code) do nothing;

-- Notification templates ---------------------------------------------------------------
insert into public.notification_templates (key, channel, subject, body) values
  ('subscription_confirmed', 'email', 'Your GAARII plan is live',
   'Welcome — your {{plan}} plan is active. First delivery ships soon.'),
  ('cycle_confirm_nudge', 'email', 'Confirm your next Garri delivery',
   'Your next delivery is scheduled for {{date}}. Confirm, edit, or skip in one tap.'),
  ('out_for_delivery', 'sms', null, 'GAARII: your garri is out for delivery. Tracking: {{tracking}}'),
  ('delivered', 'email', 'Delivered — enjoy!', 'Your GAARII delivery {{order}} has arrived.'),
  ('refund_processed', 'email', 'Your refund is on its way',
   'We processed your refund for order {{order}}. No return needed.')
on conflict (key) do nothing;

-- Feature flags & settings ----------------------------------------------------------
insert into public.feature_flags (key, description, enabled) values
  ('google_auth',        'Supabase Google OAuth sign-in', true),
  ('group_orders',       'Community group ordering',      true),
  ('wholesale_channel',  'B2B standing orders',           false),
  ('supplier_portal',    'Supplier forecast sharing',     false),
  ('canada_checkout',    'CAD checkout',                  false)
on conflict (key) do nothing;

insert into public.system_settings (key, value, description) values
  ('margin_floor',        '0.30',  'Minimum gross margin after shipping'),
  ('first_delivery_discount', '0.10', 'One-time acquisition discount'),
  ('group_discount_tiers', '{"30000":0.05,"75000":0.10,"150000":0.15}', 'Cents → pct')
on conflict (key) do nothing;

-- Scheduled tasks ----------------------------------------------------------------------
insert into public.scheduled_tasks (key, cron) values
  ('nightly_forecast',   '0 3 * * *'),
  ('cycle_generation',   '0 6 * * *'),
  ('refresh_daily_kpis', '30 3 * * *')
on conflict (key) do nothing;

-- Forecast models -----------------------------------------------------------------------
insert into public.forecast_models (key, name, status) values
  ('v0_committed_blend',  'V0 committed-demand blend', 'active'),
  ('v1_events_calendar',  'V1 events calendar',        'shadow')
on conflict (key) do nothing;
