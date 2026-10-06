-- ---------------------------------------------------------------------------
-- Agent Fleet: MANOVIK's own AI staff.
-- manovik_agents holds standing agents — each with a role, a job (standing
-- instructions), an optional tool allowlist, and a schedule. The hourly
-- agent-fleet-tick hook runs whatever is due via the existing AGI mission
-- loop (no second LLM loop).
--
-- v1 safety rule: agents cannot create other agents on their own. Creation
-- goes through the chat tools (agent.create) or the /agents page only, and
-- "agent.create" is rejected inside any tools_allowlist.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.manovik_agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  role text NOT NULL DEFAULT 'custom',
  job text NOT NULL,
  system_prompt text NOT NULL DEFAULT '',
  tools_allowlist text[] NULL,
  schedule text NOT NULL DEFAULT 'daily',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused')),
  last_run_at timestamptz,
  next_run_at timestamptz,
  last_outcome text,
  run_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agents_user_status_next
  ON public.manovik_agents(user_id, status, next_run_at);

-- ---------------------------------------------------------------------------
-- Row-level security: owner-only access, same convention as the AGI tables.
-- ---------------------------------------------------------------------------

ALTER TABLE public.manovik_agents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own agents select" ON public.manovik_agents;
CREATE POLICY "own agents select" ON public.manovik_agents
  FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "own agents insert" ON public.manovik_agents;
CREATE POLICY "own agents insert" ON public.manovik_agents
  FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "own agents update" ON public.manovik_agents;
CREATE POLICY "own agents update" ON public.manovik_agents
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "own agents delete" ON public.manovik_agents;
CREATE POLICY "own agents delete" ON public.manovik_agents
  FOR DELETE USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Explicit grants (Supabase 2026-10-30 breaking change: new tables get NO
-- automatic Data API access; service_role bypasses RLS but not missing
-- grants). Safe to re-run.
-- ---------------------------------------------------------------------------
GRANT ALL ON public.manovik_agents TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.manovik_agents TO authenticated;

-- ---------------------------------------------------------------------------
-- Phase 2 tracks: agent lifecycle (school → work → teach) + hiring proposals.
-- Phase 2 will build the school and approvals UI on top; this just lays the
-- schema. Nothing here changes v1 behavior: lifecycle_stage defaults to
-- 'worker' and the tick keeps selecting on status.
-- ---------------------------------------------------------------------------

ALTER TABLE public.manovik_agents
  ADD COLUMN IF NOT EXISTS lifecycle_stage text NOT NULL DEFAULT 'worker'
    CHECK (lifecycle_stage IN ('applicant', 'student', 'worker', 'mentor', 'retired')),
  ADD COLUMN IF NOT EXISTS proposed_by uuid NULL,
  ADD COLUMN IF NOT EXISTS skills text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS mentor_id uuid NULL;

-- NOTE: proposed_by / mentor_id intentionally have no FK — phase 2 manages
-- lifecycle transitions, and proposals are kept for audit even if the
-- proposing agent is later removed.

CREATE TABLE IF NOT EXISTS public.manovik_agent_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  proposed_by_agent uuid NOT NULL,
  name text NOT NULL,
  role text NOT NULL,
  job text NOT NULL,
  rationale text NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_agent_proposals_user_status
  ON public.manovik_agent_proposals(user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_proposals_by_agent
  ON public.manovik_agent_proposals(proposed_by_agent, created_at DESC);

ALTER TABLE public.manovik_agent_proposals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own agent_proposals select" ON public.manovik_agent_proposals;
CREATE POLICY "own agent_proposals select" ON public.manovik_agent_proposals
  FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "own agent_proposals insert" ON public.manovik_agent_proposals;
CREATE POLICY "own agent_proposals insert" ON public.manovik_agent_proposals
  FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "own agent_proposals update" ON public.manovik_agent_proposals;
CREATE POLICY "own agent_proposals update" ON public.manovik_agent_proposals
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "own agent_proposals delete" ON public.manovik_agent_proposals;
CREATE POLICY "own agent_proposals delete" ON public.manovik_agent_proposals
  FOR DELETE USING (auth.uid() = user_id);

GRANT ALL ON public.manovik_agent_proposals TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.manovik_agent_proposals TO authenticated;
