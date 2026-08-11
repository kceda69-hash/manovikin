CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE public.manovik_force_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  objective text NOT NULL,
  mode text NOT NULL DEFAULT 'build',
  status text NOT NULL DEFAULT 'running',
  answer text,
  score numeric,
  proof jsonb NOT NULL DEFAULT '{}'::jsonb,
  actions jsonb NOT NULL DEFAULT '[]'::jsonb,
  error text,
  parent_run_id uuid REFERENCES public.manovik_force_runs(id) ON DELETE SET NULL,
  fork_from_step integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.manovik_force_runs TO authenticated;
GRANT ALL ON public.manovik_force_runs TO service_role;
ALTER TABLE public.manovik_force_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own force runs"
  ON public.manovik_force_runs FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.manovik_force_agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.manovik_force_runs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL,
  model text NOT NULL,
  output text NOT NULL DEFAULT '',
  critique text,
  score numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.manovik_force_agents TO authenticated;
GRANT ALL ON public.manovik_force_agents TO service_role;
ALTER TABLE public.manovik_force_agents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own force agents"
  ON public.manovik_force_agents FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.manovik_force_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.manovik_force_runs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  idx integer NOT NULL,
  phase text NOT NULL,
  label text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.manovik_force_steps TO authenticated;
GRANT ALL ON public.manovik_force_steps TO service_role;
ALTER TABLE public.manovik_force_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own force steps"
  ON public.manovik_force_steps FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_force_runs_user_created ON public.manovik_force_runs (user_id, created_at DESC);
CREATE INDEX idx_force_agents_run ON public.manovik_force_agents (run_id);
CREATE INDEX idx_force_steps_run_idx ON public.manovik_force_steps (run_id, idx);

CREATE TRIGGER update_manovik_force_runs_updated_at
  BEFORE UPDATE ON public.manovik_force_runs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();