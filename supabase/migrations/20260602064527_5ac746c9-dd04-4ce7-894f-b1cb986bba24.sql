
CREATE OR REPLACE FUNCTION public.get_security_scan_token()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, vault
AS $$
  SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'security_scan_token' LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.get_security_scan_token() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_security_scan_token() TO service_role;
