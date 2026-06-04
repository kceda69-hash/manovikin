DROP POLICY IF EXISTS "Authenticated users can read security scan results" ON public.security_self_checks;
CREATE POLICY "Service role can read security scan results"
  ON public.security_self_checks FOR SELECT
  USING (auth.role() = 'service_role');