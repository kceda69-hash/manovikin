-- AI health probe scheduler (2026-10-14).
--
-- Nick asked "why not solving the problem permanently" after the 2026-10-13
-- outage where the AI backend silently stopped responding. The permanent fix
-- is end-to-end monitoring of the real user path: this migration wires a
-- pg_cron job that POSTs to the ai-health hook every 15 minutes. The hook
-- sends a trivial prompt through the production model chain and alerts Nick
-- on failure, so breakage is caught before it reaches him.
--
-- Auth: the hook accepts MANOVIK_HOOK_SECRET (Bearer <hook-secret>) or the
-- vault-backed per-database token below — the same dual-auth shape as
-- agent-fleet-tick and run-schedules. Only pg_cron (same database) and
-- service_role (via get_ai_health_token()) can read the token.
--
-- Deploy order: the ai-health route (with get_ai_health_token auth) must be
-- live BEFORE this migration runs.
--
-- Apply in the Supabase SQL editor of the production project, then verify:
--   SELECT jobname, schedule, active FROM cron.job
--   WHERE jobname = 'manovik-ai-health';

-- Extensions (no-op if already present on Supabase).
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Health check history (idempotent).
CREATE TABLE IF NOT EXISTS public.ai_health_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  ok boolean NOT NULL,
  model text,
  latency_ms integer,
  error text
);
CREATE INDEX IF NOT EXISTS ai_health_checks_created_idx
  ON public.ai_health_checks (created_at DESC);
GRANT SELECT ON public.ai_health_checks TO authenticated;
GRANT ALL ON public.ai_health_checks TO service_role;
ALTER TABLE public.ai_health_checks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can view ai health checks" ON public.ai_health_checks;
CREATE POLICY "Admins can view ai health checks"
  ON public.ai_health_checks FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Health alerts with de-dupe (idempotent).
CREATE TABLE IF NOT EXISTS public.ai_health_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  severity text NOT NULL DEFAULT 'critical',
  message text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  acknowledged_at timestamptz,
  acknowledged_by uuid,
  resolved_at timestamptz
);
CREATE INDEX IF NOT EXISTS ai_health_alerts_open_idx
  ON public.ai_health_alerts (created_at DESC)
  WHERE acknowledged_at IS NULL AND resolved_at IS NULL;
GRANT SELECT, UPDATE ON public.ai_health_alerts TO authenticated;
GRANT ALL ON public.ai_health_alerts TO service_role;
ALTER TABLE public.ai_health_alerts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can view ai health alerts" ON public.ai_health_alerts;
CREATE POLICY "Admins can view ai health alerts"
  ON public.ai_health_alerts FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "Admins can acknowledge ai health alerts" ON public.ai_health_alerts;
CREATE POLICY "Admins can acknowledge ai health alerts"
  ON public.ai_health_alerts FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Vault-backed per-database token for the ai-health cron hook (idempotent).
SELECT vault.create_secret(encode(gen_random_bytes(32), 'hex'), 'ai_health_token', 'Token for the AI health probe cron hook')
WHERE NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'ai_health_token');

-- Explicit grants (required after Supabase's Oct-30 auto-grant removal):
-- readable only via SECURITY DEFINER + service_role.
CREATE OR REPLACE FUNCTION public.get_ai_health_token()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public', 'vault'
AS $$
  SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'ai_health_token' LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.get_ai_health_token() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_ai_health_token() TO service_role;

-- (Re)create the 15-minute job. Idempotent on re-run.
SELECT cron.unschedule('manovik-ai-health')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'manovik-ai-health');

SELECT cron.schedule(
  'manovik-ai-health',
  '*/15 * * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://manovik.in/api/public/hooks/ai-health',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || public.get_ai_health_token()
    ),
    body := '{}'::jsonb
  );
  $cron$
);
