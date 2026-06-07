
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
