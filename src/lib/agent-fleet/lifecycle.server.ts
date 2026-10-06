/**
 * Lifecycle transitions for the living world: worker → mentor → retired.
 *
 * State machine:
 *
 *   applicant → student → worker → mentor
 *                              ↘ retired   (worker or mentor may retire)
 *
 * - promoteToMentor: a proven worker (≥10 successful runs, ≥5 skills)
 *   becomes a teacher; pickMentor() in school.server.ts will then assign
 *   students to it.
 * - retireAgent: worker/mentor → retired with a reason. Retired agents never
 *   tick but stay visible in history.
 *
 * Pure eligibility helpers are exported for unit tests.
 */
import { getAgent, type AgentRow, type FleetDb } from "./fleet.server";

export const MENTOR_MIN_RUNS = 10;
export const MENTOR_MIN_SKILLS = 5;

export interface Eligibility {
  ok: boolean;
  reasons: string[];
}

/** Pure: can this agent be promoted to mentor? */
export function canPromoteToMentor(agent: Pick<AgentRow, "lifecycle_stage" | "run_count" | "skills">): Eligibility {
  const reasons: string[] = [];
  if (agent.lifecycle_stage !== "worker") {
    reasons.push(`must be a worker (currently ${agent.lifecycle_stage})`);
  }
  if (agent.run_count < MENTOR_MIN_RUNS) {
    reasons.push(`needs ≥${MENTOR_MIN_RUNS} runs (has ${agent.run_count})`);
  }
  if (agent.skills.length < MENTOR_MIN_SKILLS) {
    reasons.push(`needs ≥${MENTOR_MIN_SKILLS} skills (has ${agent.skills.length})`);
  }
  return { ok: reasons.length === 0, reasons };
}

/** Pure: which lifecycle stages may run on the fleet tick. */
export function isTickableStage(stage: AgentRow["lifecycle_stage"]): boolean {
  return stage === "worker" || stage === "mentor";
}

/** Promote a proven worker to mentor (teacher). */
export async function promoteToMentor(
  db: FleetDb,
  userId: string,
  agentId: string,
): Promise<AgentRow> {
  const agent = await getAgent(db, userId, agentId);
  const eligibility = canPromoteToMentor(agent);
  if (!eligibility.ok) {
    throw new Error(`"${agent.name}" is not ready to mentor: ${eligibility.reasons.join("; ")}.`);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (db as any)
    .from("manovik_agents")
    .update({ lifecycle_stage: "mentor" })
    .eq("id", agentId)
    .eq("user_id", userId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  const { logAgentAction } = await import("@/lib/agent-audit.server");
  await logAgentAction({
    userId,
    action: "fleet.promote_mentor",
    summary: `Agent "${agent.name}" promoted to mentor (${agent.run_count} runs, ${agent.skills.length} skills)`,
    metadata: { agentId },
  });
  return data as AgentRow;
}

/** Retire a worker or mentor with a reason. Retired agents never tick. */
export async function retireAgent(
  db: FleetDb,
  userId: string,
  agentId: string,
  reason: string,
): Promise<AgentRow> {
  const clean = reason.trim();
  if (clean.length < 1 || clean.length > 500) {
    throw new Error("A retirement reason (1–500 characters) is required.");
  }
  const agent = await getAgent(db, userId, agentId);
  if (agent.lifecycle_stage !== "worker" && agent.lifecycle_stage !== "mentor") {
    throw new Error(`Only workers or mentors can retire (this agent is ${agent.lifecycle_stage}).`);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (db as any)
    .from("manovik_agents")
    .update({ lifecycle_stage: "retired", status: "paused" })
    .eq("id", agentId)
    .eq("user_id", userId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  const { logAgentAction } = await import("@/lib/agent-audit.server");
  await logAgentAction({
    userId,
    action: "fleet.retire",
    summary: `Agent "${agent.name}" retired: ${clean.slice(0, 120)}`,
    metadata: { agentId, reason: clean },
  });
  return data as AgentRow;
}
