CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  thread_id uuid REFERENCES public.threads(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  summary text,
  ip text,
  user_agent text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own audit select" ON public.audit_logs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "own audit insert" ON public.audit_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_audit_logs_user_created ON public.audit_logs(user_id, created_at DESC);