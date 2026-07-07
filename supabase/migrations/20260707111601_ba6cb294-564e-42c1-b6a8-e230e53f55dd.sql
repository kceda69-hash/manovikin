
REVOKE EXECUTE ON FUNCTION public.magic_link_check_and_record(TEXT, TEXT) FROM PUBLIC, anon, authenticated;

CREATE POLICY "magic_link_requests deny all"
  ON public.magic_link_requests
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);
