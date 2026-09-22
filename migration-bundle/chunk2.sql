-- Migration: 20260602064314_01aedec8-8cfd-4ccc-b088-f88abf79c73d.sql

CREATE TABLE public.security_self_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ran_at timestamptz NOT NULL DEFAULT now(),
  run_id uuid NOT NULL,
  check_name text NOT NULL,
  status text NOT NULL CHECK (status IN ('pass','warn','fail','fixed')),
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  auto_fix_applied boolean NOT NULL DEFAULT false
);

CREATE INDEX security_self_checks_ran_at_idx ON public.security_self_checks (ran_at DESC);
CREATE INDEX security_self_checks_run_id_idx ON public.security_self_checks (run_id);

GRANT SELECT ON public.security_self_checks TO authenticated;
GRANT ALL ON public.security_self_checks TO service_role;

ALTER TABLE public.security_self_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read security scan results"
ON public.security_self_checks FOR SELECT
TO authenticated
USING (true);

-- Migration: 20260602064527_5ac746c9-dd04-4ce7-894f-b1cb986bba24.sql

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

-- Migration: 20260604054622_e97bd848-6a9b-4271-92d7-40ce3e586f01.sql
DROP POLICY IF EXISTS "Authenticated users can read security scan results" ON public.security_self_checks;
CREATE POLICY "Service role can read security scan results"
  ON public.security_self_checks FOR SELECT
  USING (auth.role() = 'service_role');
-- Migration: 20260607075116_a94206fd-fe74-48b5-83ae-cce3796e0bb2.sql

CREATE TABLE public.language_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  language_code text NOT NULL,
  terminology jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, language_code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.language_memory TO authenticated;
GRANT ALL ON public.language_memory TO service_role;
ALTER TABLE public.language_memory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own language_memory all" ON public.language_memory
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.manovik_brain_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version text NOT NULL,
  notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.manovik_brain_updates TO authenticated, anon;
GRANT ALL ON public.manovik_brain_updates TO service_role;
ALTER TABLE public.manovik_brain_updates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read brain updates" ON public.manovik_brain_updates
  FOR SELECT USING (true);

-- Migration: 20260607075755_f7a6a71f-1173-440a-8deb-423fecebfcf1.sql

CREATE TABLE public.ai_balance (
  user_id uuid PRIMARY KEY,
  credits integer NOT NULL DEFAULT 100,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ai_balance TO authenticated;
GRANT ALL ON public.ai_balance TO service_role;
ALTER TABLE public.ai_balance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own balance read" ON public.ai_balance
  FOR SELECT USING (auth.uid() = user_id);

CREATE TABLE public.ai_balance_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  delta integer NOT NULL,
  reason text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ai_balance_ledger_user_idx ON public.ai_balance_ledger(user_id, created_at DESC);
GRANT SELECT ON public.ai_balance_ledger TO authenticated;
GRANT ALL ON public.ai_balance_ledger TO service_role;
ALTER TABLE public.ai_balance_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own ledger read" ON public.ai_balance_ledger
  FOR SELECT USING (auth.uid() = user_id);

-- Atomic spend: deducts credits and writes ledger row in one shot.
CREATE OR REPLACE FUNCTION public.manovik_spend_credit(_user_id uuid, _amount integer, _reason text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE remaining integer;
BEGIN
  INSERT INTO public.ai_balance(user_id) VALUES (_user_id)
    ON CONFLICT (user_id) DO NOTHING;

  UPDATE public.ai_balance
    SET credits = credits - _amount, updated_at = now()
    WHERE user_id = _user_id AND credits >= _amount
    RETURNING credits INTO remaining;

  IF remaining IS NULL THEN
    RETURN -1;
  END IF;

  INSERT INTO public.ai_balance_ledger(user_id, delta, reason)
    VALUES (_user_id, -_amount, _reason);
  RETURN remaining;
END;
$$;

CREATE OR REPLACE FUNCTION public.manovik_topup_credit(_user_id uuid, _amount integer, _reason text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE remaining integer;
BEGIN
  INSERT INTO public.ai_balance(user_id, credits) VALUES (_user_id, _amount)
    ON CONFLICT (user_id) DO UPDATE
      SET credits = ai_balance.credits + EXCLUDED.credits, updated_at = now()
    RETURNING credits INTO remaining;
  INSERT INTO public.ai_balance_ledger(user_id, delta, reason)
    VALUES (_user_id, _amount, _reason);
  RETURN remaining;
END;
$$;

-- Migration: 20260607075821_df9b3210-49be-4d82-9d2d-a136957fdf94.sql

REVOKE EXECUTE ON FUNCTION public.manovik_spend_credit(uuid, integer, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.manovik_topup_credit(uuid, integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.manovik_spend_credit(uuid, integer, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.manovik_topup_credit(uuid, integer, text) TO service_role;

-- Migration: 20260701065103_5e39b99b-77cf-4dea-a816-c1b154594eaa.sql
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
-- Migration: 20260707111534_cebe2db3-9a2a-4efa-9aee-63781a07d7d7.sql

CREATE TABLE public.magic_link_requests (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL,
  ip TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX magic_link_requests_email_created_idx
  ON public.magic_link_requests (lower(email), created_at DESC);
CREATE INDEX magic_link_requests_ip_created_idx
  ON public.magic_link_requests (ip, created_at DESC);

-- No grants to anon/authenticated: only service_role (used from server functions)
-- and the SECURITY DEFINER function below may touch this table.
GRANT ALL ON public.magic_link_requests TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.magic_link_requests_id_seq TO service_role;
ALTER TABLE public.magic_link_requests ENABLE ROW LEVEL SECURITY;
-- No policies -> locked to everyone except service_role/definers.

CREATE OR REPLACE FUNCTION public.magic_link_check_and_record(_email TEXT, _ip TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  email_count INT;
  ip_count INT;
  oldest_email TIMESTAMPTZ;
  oldest_ip TIMESTAMPTZ;
  retry_after INT;
BEGIN
  IF _email IS NULL OR length(trim(_email)) = 0 THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'invalid_email', 'retry_after_sec', 0);
  END IF;

  SELECT count(*), min(created_at) INTO email_count, oldest_email
    FROM public.magic_link_requests
    WHERE lower(email) = lower(_email)
      AND created_at > now() - interval '15 minutes';

  IF email_count >= 3 THEN
    retry_after := GREATEST(1, EXTRACT(EPOCH FROM (oldest_email + interval '15 minutes' - now()))::INT);
    RETURN jsonb_build_object('allowed', false, 'reason', 'email_rate_limited', 'retry_after_sec', retry_after);
  END IF;

  SELECT count(*), min(created_at) INTO ip_count, oldest_ip
    FROM public.magic_link_requests
    WHERE ip = _ip
      AND created_at > now() - interval '1 hour';

  IF ip_count >= 20 THEN
    retry_after := GREATEST(1, EXTRACT(EPOCH FROM (oldest_ip + interval '1 hour' - now()))::INT);
    RETURN jsonb_build_object('allowed', false, 'reason', 'ip_rate_limited', 'retry_after_sec', retry_after);
  END IF;

  INSERT INTO public.magic_link_requests (email, ip) VALUES (_email, _ip);

  -- Opportunistic cleanup: purge rows older than 24h (small table, fast).
  DELETE FROM public.magic_link_requests WHERE created_at < now() - interval '24 hours';

  RETURN jsonb_build_object('allowed', true, 'retry_after_sec', 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.magic_link_check_and_record(TEXT, TEXT) TO service_role;

-- Migration: 20260707111601_ba6cb294-564e-42c1-b6a8-e230e53f55dd.sql

REVOKE EXECUTE ON FUNCTION public.magic_link_check_and_record(TEXT, TEXT) FROM PUBLIC, anon, authenticated;

CREATE POLICY "magic_link_requests deny all"
  ON public.magic_link_requests
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

-- Migration: 20260709051144_da063409-410d-4205-8947-c7b7f90fb004.sql

-- 1. Role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

-- 2. user_roles table
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Users can read their own roles only
CREATE POLICY "Users read own roles"
  ON public.user_roles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- No client-side inserts/updates/deletes. Only service_role (server functions) may write.

-- 3. has_role security definer function
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

-- 4. Seed initial admin (kchaudharyofficial26@gmail.com)
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role
FROM auth.users
WHERE lower(email) = lower('kchaudharyofficial26@gmail.com')
ON CONFLICT (user_id, role) DO NOTHING;
