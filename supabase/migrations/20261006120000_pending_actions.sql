-- Server-enforced confirmation queue for high-stakes agent actions
-- (gmail.send, guest-visible calendar.create, calendar.cancel).
--
-- The tool layer stages the exact payload here and returns a short-lived
-- confirmation token to the agent. Execution happens only when the tool is
-- called again with a valid, unexpired, unconsumed token — the staged payload
-- is frozen server-side and cannot be altered between stage and confirm.
--
-- Access is service_role only: all reads/writes go through supabaseAdmin in
-- server tool code (same pattern as manovik_user_integrations). No
-- authenticated-role grants: PostgREST never serves this table directly.

CREATE TABLE public.manovik_pending_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('gmail.send', 'calendar.create', 'calendar.cancel')),
  payload jsonb NOT NULL,
  token text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'consumed')),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.manovik_pending_actions ENABLE ROW LEVEL SECURITY;

-- Explicit grants (Supabase removed auto-grants for new tables after 2026-10-30).
GRANT ALL ON public.manovik_pending_actions TO service_role;

CREATE INDEX idx_pending_actions_token ON public.manovik_pending_actions(token);
CREATE INDEX idx_pending_actions_user_status ON public.manovik_pending_actions(user_id, status);
