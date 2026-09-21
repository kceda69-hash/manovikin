// Client-safe shared types and metadata for MANOVIK FORCE.
// No secrets, no IO — imported by both the browser UI and the server engine.

export type ForceMode = "build" | "research" | "operate" | "clone";

export type Recon = {
  restated: string;
  assumptions: string[];
  constraints: string[];
  subtasks: string[];
  risks: string[];
};

export type AgentResult = {
  role: string;
  model: string;
  output: string;
  critique: string;
  score: number;
};

export type ProofItem = {
  check: string;
  how: string;
  status: "verified" | "unverified" | "failed";
};

export type ProposedAction = {
  label: string;
  kind: "shell" | "open" | "notify" | "say" | "script";
  command: string;
  risk: "low" | "medium" | "high";
  why: string;
};

export type ForceStep = {
  idx: number;
  phase: string;
  label: string;
  created_at: string;
};

export type ForceRun = {
  id: string;
  objective: string;
  mode: ForceMode;
  status: "running" | "done" | "failed";
  answer: string | null;
  score: number | null;
  proof: ProofItem[];
  actions: ProposedAction[];
  error: string | null;
  parent_run_id: string | null;
  fork_from_step: number | null;
  created_at: string;
  completed_at: string | null;
};

export const FORCE_MODES: Array<{ id: ForceMode; label: string; blurb: string }> = [
  { id: "build", label: "Build", blurb: "Architect + implement + test + harden, in one pass." },
  {
    id: "research",
    label: "Research",
    blurb: "Analyst, contrarian, quant and synthesiser argue it out.",
  },
  {
    id: "operate",
    label: "Operate",
    blurb: "Turn daily work into an approved, automatable runbook.",
  },
  { id: "clone", label: "Clone", blurb: "Clean-room reimplementation with a fidelity audit." },
];

export const RISK_TONE: Record<ProposedAction["risk"], string> = {
  low: "border-emerald-500/40 text-emerald-600 dark:text-emerald-400",
  medium: "border-amber-500/40 text-amber-600 dark:text-amber-400",
  high: "border-destructive/50 text-destructive",
};
