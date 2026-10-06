/**
 * The School: where new agents learn before they work.
 *
 * Lifecycle: applicant → student → worker → mentor → retired.
 *
 * - enrollStudent: applicant becomes a student, gets a mentor_id.
 * - compileStudyPack: the curriculum — shared AGI doctrine + recent
 *   tech-radar brain updates + the mentor's own job description.
 * - teachStudent: runs ONE guided learning mission through the existing
 *   runner (runAgentJob in study mode); the student summarizes what it
 *   learned and genuinely new items are appended to its skills[].
 * - graduateStudent: student → worker once it has ≥3 skills and a
 *   completed study session; its schedule arms so the tick picks it up.
 *
 * Students never run on the normal tick (tick.server.ts gates on
 * lifecycle_stage). Every mutation is ownership-enforced and audit-logged.
 */
import { z } from "zod";
import {
  createAgent,
  getAgent,
  type AgentRow,
  type FleetDb,
  type ProposalRow,
} from "./fleet.server";
import { parseSchedule, computeNextRunAt } from "./schedule";

/** Goal marker for study sessions, so graduation can verify one completed. */
export function studyRunMarker(agentId: string): string {
  return `[fleet-study:${agentId}]`;
}

/** Tool allowlist for study sessions: learning tools only, no proposing. */
export const STUDY_TOOL_NAMES = [
  "memory_search",
  "reason",
  "note",
  "finish",
  "fetch_url",
  "remember",
] as const;

/** A completed study run row (from manovik_agi_runs). */
interface StudyRunRow {
  id: string;
  status: string;
  created_at: string;
}

/**
 * Compile the curriculum for a student.
 *
 * Three sources, all best-effort (a thin pack still teaches):
 * 1. Shared AGI doctrine + recent lessons (training.server, same as missions).
 * 2. Recent tech-radar brain updates (manovik_brain_updates notes).
 * 3. The mentor's own job description — learn the craft from the master.
 */
export async function compileStudyPack(
  db: FleetDb,
  userId: string,
  agent: AgentRow,
): Promise<string> {
  const sections: string[] = [];

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { loadDoctrine } = await import("@/lib/mano/training.server");
    const doctrine = await loadDoctrine(db as never, userId);
    if (doctrine && doctrine.trim()) {
      sections.push(`HOUSE DOCTRINE (how this staff works):\n${doctrine.slice(0, 2000)}`);
    }
  } catch {
    /* doctrine is best-effort */
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (db as any)
      .from("manovik_brain_updates")
      .select("version,notes,created_at")
      .order("created_at", { ascending: false })
      .limit(5);
    const rows = (data ?? []) as Array<{ version: string; notes: string | null; created_at: string }>;
    const notes = rows
      .map((r) => r.notes)
      .filter((n): n is string => !!n && n.trim().length > 0)
      .slice(0, 5);
    if (notes.length > 0) {
      sections.push(
        `FRESH WORLD KNOWLEDGE (recent tech-radar updates):\n${notes.map((n) => `- ${n.slice(0, 400)}`).join("\n")}`,
      );
    }
  } catch {
    /* brain updates are best-effort */
  }

  if (agent.mentor_id) {
    try {
      const mentor = await getAgent(db, userId, agent.mentor_id);
      sections.push(
        `YOUR MENTOR is ${mentor.name} (${mentor.role}). Their craft:\n${mentor.job.slice(0, 1200)}`,
      );
    } catch {
      /* mentor lookup is best-effort */
    }
  }

  sections.push(
    `YOUR ASSIGNED ROLE: ${agent.role}.\nYOUR FUTURE JOB:\n${agent.job.slice(0, 1500)}`,
  );

  return sections.join("\n\n---\n\n");
}

/**
 * Pick a mentor for a student: prefer an existing mentor-stage agent
 * (CEO first), else any active worker, else null (the pack still teaches).
 */
export async function pickMentor(db: FleetDb, userId: string): Promise<AgentRow | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (db as any)
    .from("manovik_agents")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "active")
    .in("lifecycle_stage", ["mentor", "worker"])
    .order("created_at", { ascending: true })
    .limit(20);
  if (error || !data) return null;
  const rows = data as AgentRow[];
  const mentors = rows.filter((r) => r.lifecycle_stage === "mentor");
  if (mentors.length > 0) {
    return mentors.find((r) => r.role === "ceo") ?? mentors[0]!;
  }
  return rows[0] ?? null;
}

/** Enroll an applicant as a student and assign a mentor. */
export async function enrollStudent(
  db: FleetDb,
  userId: string,
  agentId: string,
): Promise<AgentRow> {
  const agent = await getAgent(db, userId, agentId);
  if (agent.lifecycle_stage !== "applicant") {
    throw new Error(`Only applicants can enroll in school (this agent is ${agent.lifecycle_stage}).`);
  }
  const mentor = await pickMentor(db, userId);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (db as any)
    .from("manovik_agents")
    .update({ lifecycle_stage: "student", mentor_id: mentor ? mentor.id : null })
    .eq("id", agentId)
    .eq("user_id", userId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  const { logAgentAction } = await import("@/lib/agent-audit.server");
  await logAgentAction({
    userId,
    action: "fleet.enroll",
    summary: `Agent "${agent.name}" enrolled in school${mentor ? ` under mentor ${mentor.name}` : " (no mentor available yet)"}`,
    metadata: { agentId, mentorId: mentor?.id ?? null },
  });
  return data as AgentRow;
}

/**
 * Extract the SKILLS list from a study report. The study goal instructs the
 * model to end with a "SKILLS: a; b; c" section; this parses it defensively.
 * Pure function — unit tested.
 */
export function extractSkillsFromReport(report: string): string[] {
  const m = report.match(/skills\s*:\s*([\s\S]+)/i);
  if (!m) return [];
  return m[1]
    .split(/[\n;•·]+/)
    .map((s) => s.replace(/^[-*\d.)\s•·]+/, "").trim())
    .map((s) => s.replace(/\s+/g, " "))
    .filter((s) => s.length >= 2 && s.length <= 60);
}

/**
 * Merge freshly learned skills into the existing set: normalized,
 * deduped (case-insensitive), capped at 20 (schema limit). Pure — tested.
 */
export function dedupeSkills(existing: string[], fresh: string[]): string[] {
  const seen = new Set(existing.map((s) => s.toLowerCase()));
  const merged = [...existing];
  for (const skill of fresh) {
    const clean = skill.trim().replace(/\s+/g, " ");
    if (clean.length < 2 || clean.length > 60) continue;
    if (seen.has(clean.toLowerCase())) continue;
    seen.add(clean.toLowerCase());
    merged.push(clean);
    if (merged.length >= 20) break;
  }
  return merged;
}

/**
 * Run ONE guided study session for a student through the existing runner
 * (runAgentJob in study mode). The session is written to run history with
 * the [fleet-study:...] marker; genuinely new skills are appended.
 */
export async function teachStudent(
  db: FleetDb,
  userId: string,
  agentId: string,
): Promise<{ agent: AgentRow; newSkills: string[]; summary: string }> {
  const agent = await getAgent(db, userId, agentId);
  if (agent.lifecycle_stage !== "student") {
    throw new Error(`Only students can be taught (this agent is ${agent.lifecycle_stage}).`);
  }
  const pack = await compileStudyPack(db, userId, agent);
  const { runAgentJob } = await import("./runner.server");
  const result = await runAgentJob(agentId, { userId, studyPack: pack, maxSteps: 5 });
  if (!result.ok) {
    throw new Error(`Study session failed: ${result.summary.slice(0, 300)}`);
  }
  const fresh = extractSkillsFromReport(result.summary);
  const merged = dedupeSkills(agent.skills, fresh);
  const newSkills = merged.filter(
    (s) => !agent.skills.some((e) => e.toLowerCase() === s.toLowerCase()),
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (db as any)
    .from("manovik_agents")
    .update({ skills: merged })
    .eq("id", agentId)
    .eq("user_id", userId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  const { logAgentAction } = await import("@/lib/agent-audit.server");
  await logAgentAction({
    userId,
    action: "fleet.study",
    summary: `Study session for "${agent.name}": learned ${newSkills.length} new skill(s)`,
    metadata: { agentId, newSkills, runId: result.runId ?? null },
  });
  return { agent: data as AgentRow, newSkills, summary: result.summary };
}

/** Has this agent completed at least one study session (status done)? */
export async function hasCompletedStudySession(
  db: FleetDb,
  userId: string,
  agentId: string,
): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (db as any)
    .from("manovik_agi_runs")
    .select("id")
    .eq("user_id", userId)
    .like("goal", `${studyRunMarker(agentId)}%`)
    .eq("status", "done")
    .limit(1);
  if (error) return false;
  return ((data ?? []) as unknown[]).length > 0;
}

/**
 * Graduate a student to worker: needs ≥3 skills and a completed study
 * session. Arms next_run_at from its schedule so the tick picks it up.
 */
export async function graduateStudent(
  db: FleetDb,
  userId: string,
  agentId: string,
): Promise<AgentRow> {
  const agent = await getAgent(db, userId, agentId);
  if (agent.lifecycle_stage !== "student") {
    throw new Error(`Only students can graduate (this agent is ${agent.lifecycle_stage}).`);
  }
  if (agent.skills.length < 3) {
    throw new Error(
      `"${agent.name}" needs at least 3 skills to graduate (has ${agent.skills.length}) — run a study session first.`,
    );
  }
  const studied = await hasCompletedStudySession(db, userId, agentId);
  if (!studied) {
    throw new Error(`"${agent.name}" has no completed study session yet — teach first, then graduate.`);
  }
  let nextRun: string;
  try {
    nextRun = computeNextRunAt(parseSchedule(agent.schedule));
  } catch {
    nextRun = new Date(Date.now() + 86_400_000).toISOString();
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (db as any)
    .from("manovik_agents")
    .update({ lifecycle_stage: "worker", next_run_at: nextRun })
    .eq("id", agentId)
    .eq("user_id", userId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  const { logAgentAction } = await import("@/lib/agent-audit.server");
  await logAgentAction({
    userId,
    action: "fleet.graduate",
    summary: `Agent "${agent.name}" graduated from school → worker (${agent.skills.length} skills)`,
    metadata: { agentId, skills: agent.skills },
  });
  return data as AgentRow;
}

/** A pending proposal enriched with the proposing agent's name. */
export interface ProposalWithProposer extends ProposalRow {
  proposer_name: string | null;
}

/** Pending proposals for a user, newest first, with proposer names. */
export async function listProposals(
  db: FleetDb,
  userId: string,
  status: "pending" | "approved" | "rejected" = "pending",
): Promise<ProposalWithProposer[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyDb = db as any;
  const { data, error } = await anyDb
    .from("manovik_agent_proposals")
    .select("*")
    .eq("user_id", userId)
    .eq("status", status)
    .order("created_at", { ascending: false });
  if (error) {
    const msg = String(error.message ?? "");
    if (/42P01|relation .* does not exist/i.test(msg)) return [];
    throw new Error(msg);
  }
  const rows = (data ?? []) as ProposalRow[];
  const proposerIds = [...new Set(rows.map((r) => r.proposed_by_agent))];
  const names = new Map<string, string>();
  if (proposerIds.length > 0) {
    const { data: agents } = await anyDb
      .from("manovik_agents")
      .select("id,name")
      .eq("user_id", userId)
      .in("id", proposerIds);
    for (const a of (agents ?? []) as Array<{ id: string; name: string }>) {
      names.set(a.id, a.name);
    }
  }
  return rows.map((r) => ({ ...r, proposer_name: names.get(r.proposed_by_agent) ?? null }));
}

/** One proposal, ownership-enforced. */
export async function getProposal(
  db: FleetDb,
  userId: string,
  proposalId: string,
): Promise<ProposalRow> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (db as any)
    .from("manovik_agent_proposals")
    .select("*")
    .eq("id", proposalId)
    .eq("user_id", userId)
    .single();
  if (error || !data) throw new Error("Proposal not found.");
  return data as ProposalRow;
}

const rejectSchema = z.object({
  reason: z.string().trim().min(1).max(500),
});

/**
 * THE GOD-CONSOLE APPROVAL: a pending proposal becomes a real agent.
 *
 * Creates the agent as `applicant` with proposed_by set (createAgent
 * enforces MAX_AGENTS_PER_USER and validates the proposer belongs to the
 * user), then auto-enrolls it in school (applicant → student).
 * Nothing is born without the user's word.
 */
export async function approveProposal(
  db: FleetDb,
  userId: string,
  proposalId: string,
): Promise<{ agent: AgentRow; proposal: ProposalRow }> {
  const proposal = await getProposal(db, userId, proposalId);
  if (proposal.status !== "pending") {
    throw new Error(`Proposal is already ${proposal.status}.`);
  }
  const agent = await createAgent(db, userId, {
    name: proposal.name,
    role: proposal.role,
    job: proposal.job,
    lifecycle_stage: "applicant",
    proposed_by: proposal.proposed_by_agent,
    skills: [],
  });
  const student = await enrollStudent(db, userId, agent.id);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (db as any)
    .from("manovik_agent_proposals")
    .update({ status: "approved", decided_at: new Date().toISOString() })
    .eq("id", proposalId)
    .eq("user_id", userId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  const { logAgentAction } = await import("@/lib/agent-audit.server");
  await logAgentAction({
    userId,
    action: "fleet.proposal_approved",
    summary: `Approved hiring proposal "${proposal.name}" — born as student "${student.name}"`,
    metadata: { proposalId, agentId: student.id, proposedBy: proposal.proposed_by_agent },
  });
  return { agent: student, proposal: data as ProposalRow };
}

/** Reject a proposal with a human-readable reason (kept in history). */
export async function rejectProposal(
  db: FleetDb,
  userId: string,
  proposalId: string,
  rawReason: unknown,
): Promise<ProposalRow> {
  const { reason } = rejectSchema.parse({ reason: rawReason });
  const proposal = await getProposal(db, userId, proposalId);
  if (proposal.status !== "pending") {
    throw new Error(`Proposal is already ${proposal.status}.`);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (db as any)
    .from("manovik_agent_proposals")
    .update({
      status: "rejected",
      decided_at: new Date().toISOString(),
      decision_note: reason,
    })
    .eq("id", proposalId)
    .eq("user_id", userId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  const { logAgentAction } = await import("@/lib/agent-audit.server");
  await logAgentAction({
    userId,
    action: "fleet.proposal_rejected",
    summary: `Rejected hiring proposal "${proposal.name}": ${reason.slice(0, 120)}`,
    metadata: { proposalId },
  });
  return data as ProposalRow;
}
