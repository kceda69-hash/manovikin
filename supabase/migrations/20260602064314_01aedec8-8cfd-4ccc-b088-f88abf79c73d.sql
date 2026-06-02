
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
