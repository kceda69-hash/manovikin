DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'manovik-security-self-scan') THEN
    PERFORM cron.unschedule('manovik-security-self-scan');
  END IF;
END $$;

SELECT cron.schedule(
  'manovik-security-self-scan',
  '*/15 * * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://project--9e140ba8-6acc-42f5-8e24-1a6609f849b5.lovable.app/api/public/hooks/security-scan',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || public.get_security_scan_token()
    ),
    body := '{}'::jsonb
  );
  $cron$
);

CREATE OR REPLACE FUNCTION public.security_scan_new_findings(_run_id uuid)
RETURNS TABLE (check_name text, status text, details jsonb)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH prev AS (
    SELECT run_id
    FROM public.security_self_checks
    WHERE run_id <> _run_id
      AND ran_at <= (
        SELECT max(ran_at) FROM public.security_self_checks WHERE run_id = _run_id
      )
    ORDER BY ran_at DESC
    LIMIT 1
  ),
  prev_fails AS (
    SELECT s.check_name
    FROM public.security_self_checks s
    JOIN prev p ON p.run_id = s.run_id
    WHERE s.status IN ('fail','warn')
  ),
  curr_fails AS (
    SELECT check_name, status, details
    FROM public.security_self_checks
    WHERE run_id = _run_id
      AND status IN ('fail','warn')
  )
  SELECT c.check_name, c.status, c.details
  FROM curr_fails c
  WHERE NOT EXISTS (SELECT 1 FROM prev_fails p WHERE p.check_name = c.check_name);
$$;

REVOKE ALL ON FUNCTION public.security_scan_new_findings(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.security_scan_new_findings(uuid) TO service_role;