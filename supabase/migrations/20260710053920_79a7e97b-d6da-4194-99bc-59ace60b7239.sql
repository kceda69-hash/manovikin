
-- Revoke EXECUTE from PUBLIC/anon/authenticated on SECURITY DEFINER functions
-- that should never be invoked directly via the Data API. service_role and the
-- functions' own owner still retain access (revokes below do not affect owner).

DO $$
DECLARE
  fn text;
  fns text[] := ARRAY[
    'public.handle_new_user()',
    'public.move_to_dlq(text, text, bigint, jsonb)',
    'public.get_security_scan_token()',
    'public.manovik_spend_credit(uuid, integer, text)',
    'public.delete_email(text, bigint)',
    'public.manovik_topup_credit(uuid, integer, text)',
    'public.email_queue_wake()',
    'public.enqueue_email(text, jsonb)',
    'public.read_email_batch(text, integer, integer)',
    'public.email_queue_dispatch()',
    'public.grant_owner_admin_on_verify()',
    'public.magic_link_check_and_record(text, text)'
  ];
BEGIN
  FOREACH fn IN ARRAY fns LOOP
    -- Skip functions that were never created (e.g. provisioned out-of-band on
    -- older projects). REVOKE on a missing function raises 42883 and aborts.
    IF to_regprocedure(fn) IS NULL THEN
      RAISE NOTICE 'Skipping missing function %', fn;
      CONTINUE;
    END IF;
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', fn);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', fn);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM authenticated', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn);
  END LOOP;
END $$;

-- has_role is called inside RLS policies evaluated as the requesting user, so
-- authenticated users must retain EXECUTE. Remove PUBLIC/anon exposure.
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO service_role;

-- touch_updated_at is SECURITY INVOKER (trigger); still tighten exposure.
REVOKE ALL ON FUNCTION public.touch_updated_at() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.touch_updated_at() FROM anon;
REVOKE ALL ON FUNCTION public.touch_updated_at() FROM authenticated;
