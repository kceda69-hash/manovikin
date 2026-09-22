-- Migration: 20260709051222_83ee524d-25bd-4290-8ce9-2f08ecdf43b4.sql

CREATE OR REPLACE FUNCTION public.grant_owner_admin_on_verify()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email_confirmed_at IS NOT NULL
     AND lower(NEW.email) = lower('kchaudharyofficial26@gmail.com') THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_grant_owner_admin ON auth.users;
CREATE TRIGGER on_auth_user_created_grant_owner_admin
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.grant_owner_admin_on_verify();

DROP TRIGGER IF EXISTS on_auth_user_confirmed_grant_owner_admin ON auth.users;
CREATE TRIGGER on_auth_user_confirmed_grant_owner_admin
  AFTER UPDATE OF email_confirmed_at ON auth.users
  FOR EACH ROW
  WHEN (OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL)
  EXECUTE FUNCTION public.grant_owner_admin_on_verify();

-- Migration: 20260709051248_6d8e3658-e63d-48fd-a183-f554c8177b61.sql

REVOKE EXECUTE ON FUNCTION public.grant_owner_admin_on_verify() FROM PUBLIC, anon, authenticated;

-- Migration: 20260710053920_79a7e97b-d6da-4194-99bc-59ace60b7239.sql

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

-- Migration: 20260710070420_806dda8f-a8cd-4b0b-929e-c96e1bf7b5ea.sql
-- Switch public.has_role to SECURITY INVOKER so it is no longer a
-- SECURITY DEFINER function executable by signed-in users. authenticated
-- already has SELECT on public.user_roles, so RLS policies calling
-- has_role() continue to work under the caller's role.
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$function$;
-- Migration: 20260711035849_647ff3e3-c456-4e8c-af25-eb75bce0287f.sql
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
-- Migration: 20260716042521_7647274f-3f57-40e4-806a-5e8caca7bf08.sql
GRANT INSERT ON public.manovik_brain_updates TO authenticated;
CREATE POLICY "admins insert brain updates" ON public.manovik_brain_updates
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
-- Migration: 20260717120219_6f04468e-1613-4013-b1ec-953f2f47c871.sql
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO service_role;

INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role
FROM auth.users
WHERE lower(email) = lower('kchaudharyofficial26@gmail.com')
ON CONFLICT (user_id, role) DO NOTHING;
-- Migration: 20260717120249_fb3d34e2-9d9e-4519-82a2-44445d2c3a42.sql
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO service_role;
-- Migration: 20260720160849_3ca61185-8b67-4139-99ca-c05da07c4da0.sql
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ui_prefs jsonb NOT NULL DEFAULT '{}'::jsonb;
-- Migration: 20260727072124_1540b431-1a13-4f90-8df9-9dedac9adaae.sql
CREATE TABLE IF NOT EXISTS public.manovik_devices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'unknown',
  pair_code TEXT UNIQUE,
  pair_code_expires_at TIMESTAMPTZ,
  token_hash TEXT,
  paired_at TIMESTAMPTZ,
  last_seen_at TIMESTAMPTZ,
  capabilities JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.manovik_devices TO authenticated;
GRANT ALL ON public.manovik_devices TO service_role;
ALTER TABLE public.manovik_devices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own devices" ON public.manovik_devices FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.manovik_device_commands (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  device_id UUID NOT NULL REFERENCES public.manovik_devices(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'shell',
  command TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  result TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.manovik_device_commands TO authenticated;
GRANT ALL ON public.manovik_device_commands TO service_role;
ALTER TABLE public.manovik_device_commands ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own device commands" ON public.manovik_device_commands FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS manovik_device_commands_device_idx ON public.manovik_device_commands(device_id, status, created_at);