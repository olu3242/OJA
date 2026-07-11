-- ============================================================================
-- Migration 0006 — convergence rollout feature flags
-- Runtime toggles for staged live dual-write (phase 3/4) and read cutover
-- (phase 5). Both start OFF; an env override `FLAG_<KEY>` can force either
-- state (kill-switch / test determinism).
-- ============================================================================

insert into public.feature_flags (key, description, enabled) values
  ('canonical_dual_write', 'Mirror legacy commerce writes into the canonical schema', false),
  ('canonical_read',       'Serve commerce reads from the canonical schema',          false)
on conflict (key) do nothing;
