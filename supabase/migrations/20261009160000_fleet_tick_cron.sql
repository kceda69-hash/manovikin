-- Agent Fleet tick scheduler (2026-10-09).
--
-- The fleet migration (20261006160000_agent_fleet.sql) assumes "the hourly
-- agent-fleet-tick hook runs whatever is due", but no scheduler was ever
-- created, so hired agents would wait forever for a tick that never fires.
-- This migration wires the hourly pg_cron job that POSTs to the fleet tick
-- hook. Deploy order: the dual-auth route patch (get_fleet_tick_token) must
-- be live BEFORE this migration runs.
--
-- Auth: the hook accepts MANOVIK_HOOK_SECRET (Bearer <hook-secret>) or the vault-backed
-- per-database token below — the same dual-auth shape as run-schedules.
-- Only pg_cron (same database) and service_role (via get_fleet_tick_token())
-- can read the token.
--
-- Apply in the Supabase SQL editor of the production project, then verify:
--   SELECT jobname, schedule, active FROM cron.job
--   WHERE jobname = 'manovik-fleet-tick';

-- Extensions (no-op if already present on Supabase).
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Vault-backed per-database token for the fleet tick cron hook (idempotent).
SELECT vault.create_secret(encode(gen_random_bytes(32), 'hex'), 'fleet_tick_token', 'Token for the agent fleet tick cron hook')
WHERE NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'fleet_tick_token');

-- Explicit grants (required after Supabase's Oct-30 auto-grant removal):
-- readable only via SECURITY DEFINER + service_role.
CREATE OR REPLACE FUNCTION public.get_fleet_tick_token()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public', 'vault'
AS $$
  SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'fleet_tick_token' LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.get_fleet_tick_token() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_fleet_tick_token() TO service_role;

-- (Re)create the hourly job: every hour at minute 0. Idempotent on re-run.
SELECT cron.unschedule('manovik-fleet-tick')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'manovik-fleet-tick');

SELECT cron.schedule(
  'manovik-fleet-tick',
  '0 * * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://manovik.in/api/public/hooks/agent-fleet-tick',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || public.get_fleet_tick_token()
    ),
    body := '{}'::jsonb
  );
  $cron$
);
