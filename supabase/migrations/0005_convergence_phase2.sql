-- ============================================================================
-- Migration 0005 — convergence phase 2 (canonical read path)
-- Registers the recurring legacy→canonical sync task and a reporting view
-- used by the dual-read dashboard.
-- ============================================================================

insert into public.scheduled_tasks (key, cron)
values ('legacy_convergence', '0 * * * *')   -- hourly incremental converge
on conflict (key) do nothing;

create or replace view public.v_commerce_kpis
with (security_invoker = true) as
select
  (select count(*) from public.customers      where deleted_at is null)                       as customers,
  (select count(*) from public.subscriptions  where deleted_at is null and status = 'active') as active_subscriptions,
  (select count(*) from public.orders         where deleted_at is null)                       as orders,
  (select coalesce(sum(total_cents), 0) from public.orders where deleted_at is null)          as revenue_cents,
  (select count(*) from public.orders where deleted_at is null and status = 'refunded')       as refunded_orders,
  (select count(*) from public.subscription_deliveries
     where deleted_at is null and status = 'skipped')                                         as skipped_deliveries;

grant select on public.v_commerce_kpis to authenticated, service_role;
