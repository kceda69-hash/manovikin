-- Per-user third-party integration credentials (e.g. Tuya / Smart Life smart home).
--
-- Unlike manovik_api_keys (which stores only one-way hashes), these credentials
-- must be readable back by the server to call third-party APIs, so this table is
-- locked down hard:
--   1. RLS is enabled with NO permissive policies for anon or authenticated.
--   2. Explicit REVOKE for anon/authenticated below.
--   3. All access goes through server-side functions using the service-role key,
--      always scoped by user_id (see src/lib/smarthome/tuya.server.ts).
--
-- Credential VALUES are never logged, never returned to the client, and never
-- echoed back by any API — only masked identifiers (e.g. "…abcd") leave the server.

CREATE TABLE IF NOT EXISTS public.manovik_user_integrations (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL,
  credentials jsonb NOT NULL DEFAULT '{}'::jsonb,
  linked_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, provider)
);

ALTER TABLE public.manovik_user_integrations ENABLE ROW LEVEL SECURITY;

-- service_role bypasses RLS and is the only role that may touch this table.
GRANT ALL ON public.manovik_user_integrations TO service_role;
REVOKE ALL ON public.manovik_user_integrations FROM anon, authenticated;

COMMENT ON TABLE public.manovik_user_integrations IS
  'Recoverable per-user third-party credentials (Tuya, ...). Service-role only; values never leave the server unmasked.';
COMMENT ON COLUMN public.manovik_user_integrations.credentials IS
  'Encrypted-at-rest note: stored as jsonb; treat as secret — never log, never return to clients.';
