/**
 * Agent Fleet persistence: CRUD + validation + ownership enforcement.
 *
 * Takes an injected `FleetDb` (Supabase-like) so unit tests can use fakes;
 * server callers pass supabaseAdmin. Every function enforces user_id
 * ownership. All functions fail closed with FleetNotSetupError when the
 * manovik_agents table doesn't exist yet (migration applied separately).
 */
import { z } from "zod";
import { parseSchedule, computeNextRunAt, type ParsedSchedule } from "./schedule";
import { getTemplate } from "./executive-templates";
import { getEmployeeTemplate } from "./employee-templates";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface FleetDb {
  from(table: string): FleetQuery;
}

/** Supabase result shape for the fleet queries. */
export interface DbResult<T = unknown> {
  data: T | null;
  error: { message: string } | null;
  /** Present when the query asked for an exact count. */
  count?: number | null;
}

/**
 * Minimal structural stand-in for the Supabase chained query builder,
 * following the AgiQuery pattern in agi.functions.ts. Extends Promise so
 * terminal awaits and .catch both typecheck.
 */
export interface FleetQuery extends Promise<DbResult> {
  select: (...args: unknown[]) => FleetQuery;
  insert: (row: Record<string, unknown>) => FleetQuery;
  update: (values: Record<string, unknown>) => FleetQuery;
  delete: () => FleetQuery;
  eq: (column: string, value: unknown) => FleetQuery;
  neq: (column: string, value: unknown) => FleetQuery;
  ilike: (column: string, value: unknown) => FleetQuery;
  like: (column: string, value: unknown) => FleetQuery;
  lte: (column: string, value: unknown) => FleetQuery;
  gte: (column: string, value: unknown) => FleetQuery;
  order: (...args: unknown[]) => FleetQuery;
  limit: (n: number) => FleetQuery;
  single: () => FleetQuery;
}

export interface AgentRow {
  id: string;
  user_id: string;
  name: string;
  role: string;
  job: string;
  system_prompt: string;
  tools_allowlist: string[] | null;
  schedule: string;
  status: "active" | "paused";
  last_run_at: string | null;
  next_run_at: string | null;
  last_outcome: string | null;
  run_count: number;
  created_at: string;
  /** Phase 2 lifecycle track: applicant → student → worker → mentor → retired. */
  lifecycle_stage: "applicant" | "student" | "worker" | "mentor" | "retired";
  /** Id of the agent that proposed this one (set when a proposal is approved). */
  proposed_by: string | null;
  /** Learned capabilities. Phase 2 (school) appends here. */
  skills: string[];
  /** Assigned teacher agent id. Phase 2 (school) manages this. */
  mentor_id: string | null;
}

/** Tool names the AGI mission loop understands (src/lib/mano/agi.server.ts). */
export const FLEET_TOOL_NAMES = [
  "memory_search",
  "reason",
  "note",
  "finish",
  "fetch_url",
  "device",
  "remember",
  // Agent-usable hiring proposal tool. Agents can dream up children, but the
  // row it writes needs approval — nothing is born without it. Never confuse
  // with "agent.create" (chat/user-only), which is rejected below.
  "agent.propose",
] as const;

/**
 * Fleet caps (the safety core alongside the approval gate).
 * - MAX_AGENTS_PER_USER: a runaway fleet can't grow without bound.
 * - MAX_PROPOSALS_PER_AGENT_PER_DAY: a chatty agent can't spam the queue.
 */
export const MAX_AGENTS_PER_USER = 50;
export const MAX_PROPOSALS_PER_AGENT_PER_DAY = 5;

export class FleetNotSetupError extends Error {
  constructor() {
    super(
      "Agent fleet is not set up yet — apply supabase/migrations/20261006160000_agent_fleet.sql, then retry.",
    );
    this.name = "FleetNotSetupError";
  }
}

function isMissingTable(err: unknown): boolean {
  const msg =
    err instanceof Error
      ? err.message
      : typeof err === "object" && err !== null && "message" in err
        ? String((err as { message: unknown }).message ?? "")
        : String(err ?? "");
  return msg.includes("42P01") || /relation .* does not exist/i.test(msg);
}

/**
 * Fail-closed DB error handling: a missing manovik_agents /
 * manovik_agent_proposals table (migration not applied yet) always becomes
 * FleetNotSetupError, never a cryptic Postgres message.
 */
function rethrowDbError(error: { message: string } | null | undefined): void {
  if (!error) return;
  if (isMissingTable(error)) throw new FleetNotSetupError();
  throw new Error(error.message);
}

function wrapTableError<T>(fn: () => Promise<T>): Promise<T> {
  return fn().catch((err) => {
    if (isMissingTable(err)) throw new FleetNotSetupError();
    throw err;
  });
}

const allowlistSchema = z
  .array(z.string().trim().min(1).max(40))
  .max(12)
  .refine((tools) => !tools.map((t) => t.toLowerCase()).includes("agent.create"), {
    message: '"agent.create" is never allowed inside a tools_allowlist (v1 rule: agents cannot create other agents).',
  })
  .refine((tools) => tools.every((t) => (FLEET_TOOL_NAMES as readonly string[]).includes(t)), {
    message: `Unknown tool name. Allowed: ${FLEET_TOOL_NAMES.join(", ")}.`,
  })
  .optional()
  .nullable();

export const createAgentSchema = z.object({
  // name/job may be empty when `template` is given — the template fills them.
  name: z.string().trim().max(60).default(""),
  role: z.string().trim().max(40).default("custom"),
  job: z.string().trim().max(4000).default(""),
  system_prompt: z.string().trim().max(4000).default(""),
  schedule: z.string().trim().min(1).max(60).default("daily"),
  tools_allowlist: allowlistSchema,
  /** Template key (executive or employee) — fills defaults; explicit fields win. */
  template: z.string().trim().max(40).optional(),
  /** Phase 2 lifecycle track. v1: everything is hired as 'worker'. */
  lifecycle_stage: z.enum(["applicant", "student", "worker", "mentor", "retired"]).default("worker"),
  /** Agent id that proposed this hire (set when an approved proposal materializes). */
  proposed_by: z.string().uuid().nullable().optional(),
  /** Learned capabilities (phase 2 school appends here). */
  skills: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
  /** Assigned teacher agent id (phase 2 school manages this). */
  mentor_id: z.string().uuid().nullable().optional(),
});

export type CreateAgentInput = z.infer<typeof createAgentSchema>;

function applyTemplate(input: CreateAgentInput) {
  const tpl = input.template
    ? (getTemplate(input.template) ?? getEmployeeTemplate(input.template))
    : undefined;
  if (input.template && !tpl) throw new Error(`Unknown agent template "${input.template}".`);
  const name = input.name || tpl?.name || "";
  if (!name) throw new Error('Agent name is required (or hire from a template).');
  const job = input.job || tpl?.job || "";
  if (job.trim().length < 4) throw new Error('Agent job needs at least 4 characters (or hire from a template).');
  return {
    name,
    role: input.role && input.role !== "custom" ? input.role : (tpl?.role ?? "custom"),
    job,
    system_prompt: input.system_prompt || "",
    schedule:
      input.schedule && input.schedule !== "daily" ? input.schedule : (tpl?.schedule ?? "daily"),
    tools_allowlist: input.tools_allowlist ?? (tpl ? [...tpl.tools_allowlist] : null),
    lifecycle_stage: input.lifecycle_stage,
    proposed_by: input.proposed_by ?? null,
    skills: input.skills,
    mentor_id: input.mentor_id ?? null,
  };
}

/** Verify a referenced agent id belongs to the user (for proposed_by / mentor_id). */
async function assertOwnAgent(db: FleetDb, userId: string, id: string, field: string): Promise<void> {
  const { data, error } = await wrapTableError(() =>
    db.from("manovik_agents").select("id").eq("id", id).eq("user_id", userId).single(),
  );
  rethrowDbError(error);
  if (!data) throw new Error(`"${field}" references an agent you don't own.`);
}

/** Create an agent for a user. Returns the inserted row. */
export async function createAgent(db: FleetDb, userId: string, raw: unknown): Promise<AgentRow> {
  const parsed = createAgentSchema.parse(raw);
  const input = applyTemplate(parsed);
  // Phase 2 wiring: proposed_by / mentor_id must reference the user's own agents.
  if (input.proposed_by) await assertOwnAgent(db, userId, input.proposed_by, "proposed_by");
  if (input.mentor_id) await assertOwnAgent(db, userId, input.mentor_id, "mentor_id");
  // Fleet cap: fail closed before writing.
  const { count, error: countError } = await wrapTableError(() =>
    db.from("manovik_agents").select("id", { count: "exact" }).eq("user_id", userId),
  );
  rethrowDbError(countError);
  if (typeof count === "number" && count >= MAX_AGENTS_PER_USER) {
    throw new Error(`Fleet is full (${MAX_AGENTS_PER_USER} agents max). Remove one first.`);
  }
  let schedule: ParsedSchedule;
  try {
    schedule = parseSchedule(input.schedule);
  } catch (e) {
    throw new Error(e instanceof Error ? e.message : "Invalid schedule.");
  }
  const { data, error } = await wrapTableError(() =>
    db
      .from("manovik_agents")
      .insert({
        user_id: userId,
        name: input.name,
        role: input.role,
        job: input.job,
        system_prompt: input.system_prompt,
        tools_allowlist: input.tools_allowlist ?? null,
        schedule: schedule.normalized,
        status: "active",
        next_run_at: computeNextRunAt(schedule),
        lifecycle_stage: input.lifecycle_stage,
        proposed_by: input.proposed_by,
        skills: input.skills,
        mentor_id: input.mentor_id,
      })
      .select("*")
      .single(),
  );
  rethrowDbError(error);
  return data as AgentRow;
}

/** All agents owned by a user, newest first. */
export async function listAgents(db: FleetDb, userId: string): Promise<AgentRow[]> {
  const { data, error } = await wrapTableError(() =>
    db.from("manovik_agents").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
  );
  rethrowDbError(error);
  return (data ?? []) as AgentRow[];
}

/** One agent, or throws when missing / not owned. */
export async function getAgent(db: FleetDb, userId: string, id: string): Promise<AgentRow> {
  const { data, error } = await wrapTableError(() =>
    db.from("manovik_agents").select("*").eq("id", id).eq("user_id", userId).single(),
  );
  if (error || !data) throw new Error("Agent not found.");
  return data as AgentRow;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Resolve an agent by id or (case-insensitive) name. Throws when missing/ambiguous. */
export async function resolveAgent(db: FleetDb, userId: string, idOrName: string): Promise<AgentRow> {
  const clean = idOrName.trim();
  if (UUID_RE.test(clean)) return getAgent(db, userId, clean);
  const { data, error } = await wrapTableError(() =>
    db.from("manovik_agents").select("*").eq("user_id", userId).ilike("name", clean),
  );
  rethrowDbError(error);
  const rows = (data ?? []) as AgentRow[];
  if (rows.length === 0) throw new Error(`No agent named "${clean}".`);
  if (rows.length > 1) throw new Error(`Multiple agents named "${clean}" — use the id.`);
  return rows[0]!;
}

/** Pause or resume an agent. Resuming recomputes next_run_at when it's in the past. */
export async function setAgentStatus(
  db: FleetDb,
  userId: string,
  id: string,
  status: "active" | "paused",
): Promise<AgentRow> {
  const agent = await getAgent(db, userId, id);
  const patch: Record<string, unknown> = { status };
  if (status === "active") {
    const next = agent.next_run_at ? new Date(agent.next_run_at).getTime() : NaN;
    if (!agent.next_run_at || Number.isNaN(next) || next <= Date.now()) {
      try {
        patch.next_run_at = computeNextRunAt(parseSchedule(agent.schedule));
      } catch {
        patch.next_run_at = new Date(Date.now() + 86_400_000).toISOString();
      }
    }
  }
  const { data, error } = await wrapTableError(() =>
    db.from("manovik_agents").update(patch).eq("id", id).eq("user_id", userId).select("*").single(),
  );
  rethrowDbError(error);
  return data as AgentRow;
}

/** Delete an agent (run history in manovik_agi_runs is kept for the audit trail). */
export async function removeAgent(db: FleetDb, userId: string, id: string): Promise<void> {
  await getAgent(db, userId, id); // ownership check first
  const { error } = await wrapTableError(() =>
    db.from("manovik_agents").delete().eq("id", id).eq("user_id", userId),
  );
  rethrowDbError(error);
}

/**
 * Record a completed run: last_run_at, last_outcome, run_count+1, and the
 * next_run_at computed from the agent's schedule.
 */
export async function recordAgentOutcome(
  db: FleetDb,
  agentId: string,
  outcome: { status: "succeeded" | "failed"; summary: string },
): Promise<void> {
  const { data: agent, error: readError } = await wrapTableError(() =>
    db.from("manovik_agents").select("schedule").eq("id", agentId).single(),
  );
  if (readError || !agent) throw new Error("Agent not found.");
  let nextRun: string;
  try {
    nextRun = computeNextRunAt(parseSchedule((agent as { schedule: string }).schedule));
  } catch {
    nextRun = new Date(Date.now() + 86_400_000).toISOString();
  }
  const { error } = await wrapTableError(() =>
    db
      .from("manovik_agents")
      // run_count increment expressed as a raw column ref would need rpc;
      // read-modify-write is fine here (single tick runner, low contention).
      .update({
        last_run_at: new Date().toISOString(),
        last_outcome: `${outcome.status}: ${outcome.summary}`.slice(0, 2000),
        next_run_at: nextRun,
      })
      .eq("id", agentId),
  );
  rethrowDbError(error);
  // Increment run_count in a second statement (kept separate for clarity).
  const { data: current } = await wrapTableError(() =>
    db.from("manovik_agents").select("run_count").eq("id", agentId).single(),
  );
  const count = Number((current as { run_count?: number } | null)?.run_count ?? 0);
  await wrapTableError(() =>
    db.from("manovik_agents").update({ run_count: count + 1 }).eq("id", agentId),
  );
}

/** Recent AGI run rows belonging to a fleet agent (matched by goal marker). */
export function fleetRunMarker(agentId: string): string {
  return `[fleet-agent:${agentId}]`;
}

export async function agentRunHistory(
  db: FleetDb,
  userId: string,
  agentId: string,
  limit = 10,
): Promise<Array<{ id: string; status: string; answer: string | null; created_at: string }>> {
  await getAgent(db, userId, agentId); // ownership check first
  const { data, error } = await wrapTableError(() =>
    db
      .from("manovik_agi_runs")
      .select("id,status,answer,created_at")
      .eq("user_id", userId)
      .like("goal", `${fleetRunMarker(agentId)}%`)
      .order("created_at", { ascending: false })
      .limit(Math.min(Math.max(limit, 1), 25)),
  );
  rethrowDbError(error);
  return (data ?? []) as Array<{ id: string; status: string; answer: string | null; created_at: string }>;
}

export interface ProposalRow {
  id: string;
  user_id: string;
  proposed_by_agent: string;
  name: string;
  role: string;
  job: string;
  rationale: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  decided_at: string | null;
}

const proposalInputSchema = z.object({
  name: z.string().trim().min(1).max(60),
  role: z.string().trim().min(1).max(40).default("custom"),
  job: z.string().trim().min(4).max(4000),
  rationale: z.string().trim().min(4).max(2000),
});

function tryParseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error('agent.propose input must be JSON: {"name","role","job","rationale"}.');
  }
}

/**
 * File a hiring proposal from a fleet agent (the `agent.propose` AGI tool).
 *
 * THE SAFETY CORE of the fleet: this NEVER creates an agent. It only writes
 * a `pending` row to manovik_agent_proposals for later human approval
 * (phase 2 approvals UI). Caps enforced, fail-closed:
 * - MAX_AGENTS_PER_USER across the whole fleet
 * - MAX_PROPOSALS_PER_AGENT_PER_DAY per proposing agent (UTC day boundary)
 *
 * Throws on invalid input, missing agent context, or any cap breach — the
 * AGI loop surfaces the message as a "Tool failed" observation.
 */
export async function fileAgentProposal(
  db: FleetDb,
  ctx: { userId: string; agentId?: string },
  rawInput: unknown,
): Promise<ProposalRow> {
  const input = typeof rawInput === "string" ? tryParseJson(rawInput) : rawInput;
  const parsed = proposalInputSchema.parse(input);
  if (!ctx.agentId) {
    throw new Error("agent.propose is only available inside a fleet agent run.");
  }
  // The proposing agent must belong to this user.
  await assertOwnAgent(db, ctx.userId, ctx.agentId, "proposing agent");

  // Cap 1: fleet size.
  const { data: agentRows, error: agentError } = await wrapTableError(() =>
    db.from("manovik_agents").select("id").eq("user_id", ctx.userId),
  );
  rethrowDbError(agentError);
  if (((agentRows ?? []) as unknown[]).length >= MAX_AGENTS_PER_USER) {
    throw new Error(`Fleet is full (${MAX_AGENTS_PER_USER} agents max) — proposal refused.`);
  }

  // Cap 2: proposals per agent per day (UTC day boundary, documented).
  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);
  const { data: propRows, error: propError } = await wrapTableError(() =>
    db
      .from("manovik_agent_proposals")
      .select("id")
      .eq("proposed_by_agent", ctx.agentId)
      .gte("created_at", dayStart.toISOString()),
  );
  rethrowDbError(propError);
  if (((propRows ?? []) as unknown[]).length >= MAX_PROPOSALS_PER_AGENT_PER_DAY) {
    throw new Error(
      `Proposal quota reached (${MAX_PROPOSALS_PER_AGENT_PER_DAY}/day) — try again tomorrow.`,
    );
  }

  const { data, error } = await wrapTableError(() =>
    db
      .from("manovik_agent_proposals")
      .insert({
        user_id: ctx.userId,
        proposed_by_agent: ctx.agentId,
        name: parsed.name,
        role: parsed.role,
        job: parsed.job,
        rationale: parsed.rationale,
        status: "pending",
      })
      .select("*")
      .single(),
  );
  rethrowDbError(error);
  return data as ProposalRow;
}
