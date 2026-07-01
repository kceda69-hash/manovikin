-- Revoke public EXECUTE on SECURITY DEFINER functions; keep service_role only.
-- All callers use server-side admin client or triggers/cron.
DO $$
DECLARE
  fn text;
  sig text;
BEGIN
  FOR fn, sig IN
    SELECT n.nspname || '.' || p.proname,
           pg_catalog.pg_get_function_identity_arguments(p.oid)
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
      AND p.proname IN (
        'handle_new_user','read_email_batch','enqueue_email','move_to_dlq',
        'get_security_scan_token','manovik_spend_credit','delete_email',
        'manovik_topup_credit','email_queue_dispatch','email_queue_wake'
      )
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s(%s) FROM PUBLIC, anon, authenticated', fn, sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s(%s) TO service_role', fn, sig);
  END LOOP;
END $$;