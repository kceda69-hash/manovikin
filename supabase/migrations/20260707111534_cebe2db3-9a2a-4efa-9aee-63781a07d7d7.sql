
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
