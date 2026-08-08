CREATE EXTENSION IF NOT EXISTS vector;

-- ============ KNOWLEDGE MEMORY ============
CREATE TABLE public.manovik_memory_docs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id uuid REFERENCES public.manovik_workspaces(id) ON DELETE SET NULL,
  title text NOT NULL,
  source text NOT NULL DEFAULT 'paste',
  status text NOT NULL DEFAULT 'ready',
  chars integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.manovik_memory_docs TO authenticated;
GRANT ALL ON public.manovik_memory_docs TO service_role;
ALTER TABLE public.manovik_memory_docs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "memory docs owner all" ON public.manovik_memory_docs
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_manovik_memory_docs_updated BEFORE UPDATE ON public.manovik_memory_docs
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX idx_memory_docs_user ON public.manovik_memory_docs(user_id, created_at DESC);

CREATE TABLE public.manovik_memory_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_id uuid NOT NULL REFERENCES public.manovik_memory_docs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chunk_index integer NOT NULL,
  content text NOT NULL,
  embedding vector(1536),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.manovik_memory_chunks TO authenticated;
GRANT ALL ON public.manovik_memory_chunks TO service_role;
ALTER TABLE public.manovik_memory_chunks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "memory chunks owner all" ON public.manovik_memory_chunks
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_memory_chunks_doc ON public.manovik_memory_chunks(doc_id, chunk_index);
CREATE INDEX idx_memory_chunks_embedding ON public.manovik_memory_chunks
  USING hnsw (embedding vector_cosine_ops);

CREATE OR REPLACE FUNCTION public.manovik_match_memory(
  _user_id uuid,
  query_embedding vector(1536),
  match_count integer DEFAULT 6
)
RETURNS TABLE (id uuid, doc_id uuid, title text, content text, similarity double precision)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT c.id, c.doc_id, d.title, c.content,
         1 - (c.embedding <=> query_embedding) AS similarity
  FROM public.manovik_memory_chunks c
  JOIN public.manovik_memory_docs d ON d.id = c.doc_id
  WHERE c.user_id = _user_id AND c.embedding IS NOT NULL
  ORDER BY c.embedding <=> query_embedding
  LIMIT LEAST(GREATEST(match_count, 1), 24)
$$;
REVOKE ALL ON FUNCTION public.manovik_match_memory(uuid, vector, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.manovik_match_memory(uuid, vector, integer) TO service_role;

-- ============ SCHEDULED AGENTS ============
CREATE TABLE public.manovik_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  objective text NOT NULL,
  mode text NOT NULL DEFAULT 'research',
  cadence text NOT NULL DEFAULT 'daily',
  enabled boolean NOT NULL DEFAULT true,
  next_run_at timestamptz NOT NULL DEFAULT now(),
  last_run_at timestamptz,
  run_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.manovik_schedules TO authenticated;
GRANT ALL ON public.manovik_schedules TO service_role;
ALTER TABLE public.manovik_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "schedules owner all" ON public.manovik_schedules
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_manovik_schedules_updated BEFORE UPDATE ON public.manovik_schedules
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX idx_schedules_due ON public.manovik_schedules(enabled, next_run_at);

CREATE TABLE public.manovik_schedule_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id uuid NOT NULL REFERENCES public.manovik_schedules(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'running',
  result text,
  error text,
  duration_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.manovik_schedule_runs TO authenticated;
GRANT ALL ON public.manovik_schedule_runs TO service_role;
ALTER TABLE public.manovik_schedule_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "schedule runs owner read" ON public.manovik_schedule_runs
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE INDEX idx_schedule_runs_sched ON public.manovik_schedule_runs(schedule_id, created_at DESC);

-- ============ API KEYS ============
CREATE TABLE public.manovik_api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label text NOT NULL,
  key_prefix text NOT NULL,
  key_hash text NOT NULL UNIQUE,
  scopes text[] NOT NULL DEFAULT ARRAY['ask']::text[],
  revoked_at timestamptz,
  expires_at timestamptz,
  last_used_at timestamptz,
  use_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.manovik_api_keys TO authenticated;
GRANT ALL ON public.manovik_api_keys TO service_role;
ALTER TABLE public.manovik_api_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "api keys owner all" ON public.manovik_api_keys
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_api_keys_user ON public.manovik_api_keys(user_id, created_at DESC);