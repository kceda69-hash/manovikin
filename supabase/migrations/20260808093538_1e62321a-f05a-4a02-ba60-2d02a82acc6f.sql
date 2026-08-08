SELECT vault.create_secret(encode(gen_random_bytes(32), 'hex'), 'schedules_run_token', 'Token for the scheduled agents cron hook')
WHERE NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'schedules_run_token');

CREATE OR REPLACE FUNCTION public.get_schedules_run_token()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public', 'vault'
AS $$
  SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'schedules_run_token' LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.get_schedules_run_token() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_schedules_run_token() TO service_role;