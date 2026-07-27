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