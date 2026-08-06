CREATE OR REPLACE FUNCTION public.get_seo_monitor_token()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public', 'vault'
AS $$
  SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'seo_monitor_token' LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.get_seo_monitor_token() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_seo_monitor_token() TO service_role;