-- Fix critical finding: AGI mission/lesson/doctrine tables had no row-level security.
--
-- manovik_agi_runs, manovik_agi_steps, manovik_agi_lessons and manovik_agi_doctrine
-- are queried by user-scoped server functions (see src/lib/mano/agi.functions.ts and
-- src/lib/mano/training.server.ts) but, unlike every other user table in the app, no
-- migration ever enabled RLS on them. This migration:
--   1. Creates the tables IF NOT EXISTS (they were originally created via the
--      dashboard, so this is a no-op in production but makes fresh self-hosted
--      databases work), and
--   2. Enables RLS and adds owner-only policies matching the convention used by
--      the other user tables (e.g. audit_logs): a user can only touch rows whose
--      user_id equals auth.uid().
--
-- Safe to apply on production: server functions query with the service-role key
-- (which bypasses RLS) and always scope by user_id; the policies only restrict
-- direct anon/authenticated-key access to a user's own rows.

-- ---------------------------------------------------------------------------
-- Tables (created only if missing)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.manovik_agi_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  goal text NOT NULL,
  status text NOT NULL DEFAULT 'running',
  answer text,
  steps_used integer NOT NULL DEFAULT 0,
  score double precision,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.manovik_agi_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.manovik_agi_runs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  idx integer NOT NULL,
  thought text,
  tool text,
  tool_input text,
  observation text,
  ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.manovik_agi_lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  topic text NOT NULL,
  lesson text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.manovik_agi_doctrine (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  doctrine text NOT NULL,
  active boolean NOT NULL DEFAULT false,
  runs_used integer NOT NULL DEFAULT 0,
  lessons_used integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agi_runs_user_created
  ON public.manovik_agi_runs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agi_steps_run
  ON public.manovik_agi_steps(run_id, idx);
CREATE INDEX IF NOT EXISTS idx_agi_lessons_user_created
  ON public.manovik_agi_lessons(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agi_doctrine_user_active
  ON public.manovik_agi_doctrine(user_id, active, created_at DESC);

-- ---------------------------------------------------------------------------
-- Row-level security: owner-only access, same convention as other user tables
-- ---------------------------------------------------------------------------

ALTER TABLE public.manovik_agi_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manovik_agi_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manovik_agi_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manovik_agi_doctrine ENABLE ROW LEVEL SECURITY;

-- manovik_agi_runs
DROP POLICY IF EXISTS "own agi_runs select" ON public.manovik_agi_runs;
CREATE POLICY "own agi_runs select" ON public.manovik_agi_runs
  FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "own agi_runs insert" ON public.manovik_agi_runs;
CREATE POLICY "own agi_runs insert" ON public.manovik_agi_runs
  FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "own agi_runs update" ON public.manovik_agi_runs;
CREATE POLICY "own agi_runs update" ON public.manovik_agi_runs
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "own agi_runs delete" ON public.manovik_agi_runs;
CREATE POLICY "own agi_runs delete" ON public.manovik_agi_runs
  FOR DELETE USING (auth.uid() = user_id);

-- manovik_agi_steps
DROP POLICY IF EXISTS "own agi_steps select" ON public.manovik_agi_steps;
CREATE POLICY "own agi_steps select" ON public.manovik_agi_steps
  FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "own agi_steps insert" ON public.manovik_agi_steps;
CREATE POLICY "own agi_steps insert" ON public.manovik_agi_steps
  FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "own agi_steps update" ON public.manovik_agi_steps;
CREATE POLICY "own agi_steps update" ON public.manovik_agi_steps
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "own agi_steps delete" ON public.manovik_agi_steps;
CREATE POLICY "own agi_steps delete" ON public.manovik_agi_steps
  FOR DELETE USING (auth.uid() = user_id);

-- manovik_agi_lessons
DROP POLICY IF EXISTS "own agi_lessons select" ON public.manovik_agi_lessons;
CREATE POLICY "own agi_lessons select" ON public.manovik_agi_lessons
  FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "own agi_lessons insert" ON public.manovik_agi_lessons;
CREATE POLICY "own agi_lessons insert" ON public.manovik_agi_lessons
  FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "own agi_lessons update" ON public.manovik_agi_lessons;
CREATE POLICY "own agi_lessons update" ON public.manovik_agi_lessons
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "own agi_lessons delete" ON public.manovik_agi_lessons;
CREATE POLICY "own agi_lessons delete" ON public.manovik_agi_lessons
  FOR DELETE USING (auth.uid() = user_id);

-- manovik_agi_doctrine
DROP POLICY IF EXISTS "own agi_doctrine select" ON public.manovik_agi_doctrine;
CREATE POLICY "own agi_doctrine select" ON public.manovik_agi_doctrine
  FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "own agi_doctrine insert" ON public.manovik_agi_doctrine;
CREATE POLICY "own agi_doctrine insert" ON public.manovik_agi_doctrine
  FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "own agi_doctrine update" ON public.manovik_agi_doctrine;
CREATE POLICY "own agi_doctrine update" ON public.manovik_agi_doctrine
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "own agi_doctrine delete" ON public.manovik_agi_doctrine;
CREATE POLICY "own agi_doctrine delete" ON public.manovik_agi_doctrine
  FOR DELETE USING (auth.uid() = user_id);
