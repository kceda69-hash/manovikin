-- Phase 2 (living world): store the human-readable reason when a hiring
-- proposal is rejected, so the god-console history shows why.
ALTER TABLE public.manovik_agent_proposals
  ADD COLUMN IF NOT EXISTS decision_note text;
