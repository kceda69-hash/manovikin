// Agent Fleet tools for MANO chat.
//
// Exported in registry shape (name, description, schema, timeoutMs,
// maxOutputBytes, rateLimitPerMin, execute) so the coordinator can register
// them in src/lib/agent-tools.ts. NOT registered here on purpose.
//
// v1 safety rule: there is NO agent.create-inside-agent tool — agents cannot
// create other agents on their own. Creation happens here (user/MANO-driven
// via chat) or on the /agents page. "agent.create" is additionally rejected
// inside any tools_allowlist at validation time.
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { ToolDef } from "@/lib/sandbox";
import {
  createAgent,
  listAgents,
  setAgentStatus,
  removeAgent,
  resolveAgent,
  agentRunHistory,
  type FleetDb,
} from "@/lib/agent-fleet/fleet.server";
import {
  listProposals,
  approveProposal,
  rejectProposal,
} from "@/lib/agent-fleet/school.server";
import { logAgentAction } from "@/lib/agent-audit.server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabaseAdmin as any as FleetDb;

const idOrName = z.string().trim().min(1).max(80).describe("Agent id (uuid) or name");

const createSchema = z.object({
  // name/job may be omitted when `template` is given — the template fills them.
  name: z.string().trim().max(60).default("").describe("Display name, e.g. 'Morning Brief' (filled from template if omitted)"),
  role: z.string().trim().max(40).default("custom").describe("Short role label, e.g. 'researcher'"),
  job: z.string().trim().max(4000).default("").describe("Standing instructions: what this agent does every run (filled from template if omitted)"),
  schedule: z
    .string()
    .trim()
    .min(1)
    .max(60)
    .default("daily")
    .describe('When it runs: "hourly", "twice daily", "daily", "weekly", or a time like "8am" / "every morning 8am"'),
  system_prompt: z.string().trim().max(4000).default("").describe("Extra instructions appended to the job"),
  tools_allowlist: z
    .array(z.string())
    .optional()
    .describe("AGI tools the agent may use; omit for all safe tools. Never include agent.create."),
  template: z
    .string()
    .trim()
    .max(40)
    .optional()
    .describe("Template key (ceo, cfo, coo, cto, cmo, hr, researcher, support-rep, bookkeeper, copywriter, social-media-manager, qa-tester, scheduler, translator) — fills name/role/job/schedule/tools; explicit fields override"),
});

const agentCreate: ToolDef<z.infer<typeof createSchema>> = {
  name: "agent.create",
  description:
    "Hire a new autonomous AI agent. Pass a template key to hire in one tap (ceo, cfo, coo, cto, cmo, hr, researcher, support-rep, bookkeeper, copywriter, social-media-manager, qa-tester, scheduler, translator) — or define it fully: name, role, standing job instructions, and schedule ('hourly', 'twice daily', 'daily', 'weekly', or a time like '8am' / 'every morning 8am'). Explicit fields override template defaults. The agent runs its job on its own via the fleet tick.",
  schema: createSchema,
  timeoutMs: 15_000,
  maxOutputBytes: 4_000,
  rateLimitPerMin: 10,
  execute: async (input, { userId }) => {
    const agent = await createAgent(db, userId, input);
    await logAgentAction({
      userId,
      action: "fleet.create",
      summary: `Hired agent "${agent.name}" (${agent.role}) via chat`,
      metadata: { agentId: agent.id },
    });
    return {
      ok: true,
      id: agent.id,
      name: agent.name,
      role: agent.role,
      schedule: agent.schedule,
      next_run_at: agent.next_run_at,
    };
  },
};

const agentList: ToolDef<object> = {
  name: "agent.list",
  description: "List your AI agents: name, role, status, schedule, last outcome, run count.",
  schema: z.object({}),
  timeoutMs: 10_000,
  maxOutputBytes: 8_000,
  rateLimitPerMin: 30,
  execute: async (_input, { userId }) => {
    const agents = await listAgents(db, userId);
    return agents.map((a) => ({
      id: a.id,
      name: a.name,
      role: a.role,
      status: a.status,
      schedule: a.schedule,
      next_run_at: a.next_run_at,
      last_run_at: a.last_run_at,
      last_outcome: a.last_outcome,
      run_count: a.run_count,
    }));
  },
};

const agentPause: ToolDef<{ idOrName: string }> = {
  name: "agent.pause",
  description: "Pause an agent by id or name — it stops running on schedule until resumed.",
  schema: z.object({ idOrName }),
  timeoutMs: 10_000,
  maxOutputBytes: 2_000,
  rateLimitPerMin: 20,
  execute: async ({ idOrName: key }, { userId }) => {
    const agent = await resolveAgent(db, userId, key);
    await setAgentStatus(db, userId, agent.id, "paused");
    await logAgentAction({ userId, action: "fleet.pause", summary: `Paused agent "${agent.name}"`, metadata: { agentId: agent.id } });
    return { ok: true, name: agent.name, status: "paused" };
  },
};

const agentResume: ToolDef<{ idOrName: string }> = {
  name: "agent.resume",
  description: "Resume a paused agent by id or name — its schedule picks up again.",
  schema: z.object({ idOrName }),
  timeoutMs: 10_000,
  maxOutputBytes: 2_000,
  rateLimitPerMin: 20,
  execute: async ({ idOrName: key }, { userId }) => {
    const agent = await resolveAgent(db, userId, key);
    await setAgentStatus(db, userId, agent.id, "active");
    await logAgentAction({ userId, action: "fleet.resume", summary: `Resumed agent "${agent.name}"`, metadata: { agentId: agent.id } });
    return { ok: true, name: agent.name, status: "active" };
  },
};

const agentRunNow: ToolDef<{ idOrName: string }> = {
  name: "agent.run_now",
  description:
    "Run an agent's job right now (by id or name) instead of waiting for its schedule. Returns the outcome summary. The run can take a couple of minutes.",
  schema: z.object({ idOrName }),
  timeoutMs: 240_000,
  maxOutputBytes: 6_000,
  rateLimitPerMin: 5,
  execute: async ({ idOrName: key }, { userId }) => {
    const agent = await resolveAgent(db, userId, key);
    const { runAgentJob } = await import("@/lib/agent-fleet/runner.server");
    const result = await runAgentJob(agent.id, { userId });
    await logAgentAction({
      userId,
      action: "fleet.run_now",
      summary: `Manual run of agent "${agent.name}" via chat: ${result.status}`,
      metadata: { agentId: agent.id, status: result.status },
    });
    return { ok: result.ok, status: result.status, summary: result.summary };
  },
};

const agentRemove: ToolDef<{ idOrName: string }> = {
  name: "agent.remove",
  description: "Fire an agent by id or name — deletes it permanently. Its past run history is kept for the audit trail.",
  schema: z.object({ idOrName }),
  timeoutMs: 10_000,
  maxOutputBytes: 2_000,
  rateLimitPerMin: 10,
  execute: async ({ idOrName: key }, { userId }) => {
    const agent = await resolveAgent(db, userId, key);
    await removeAgent(db, userId, agent.id);
    await logAgentAction({ userId, action: "fleet.remove", summary: `Removed agent "${agent.name}" via chat`, metadata: { agentId: agent.id } });
    return { ok: true, removed: agent.name };
  },
};

const agentLogs: ToolDef<{ idOrName: string; limit?: number }> = {
  name: "agent.logs",
  description: "Show recent run history for an agent (by id or name): status, outcome, when.",
  schema: z.object({ idOrName, limit: z.number().int().min(1).max(25).default(10) }),
  timeoutMs: 10_000,
  maxOutputBytes: 8_000,
  rateLimitPerMin: 30,
  execute: async ({ idOrName: key, limit }, { userId }) => {
    const agent = await resolveAgent(db, userId, key);
    const runs = await agentRunHistory(db, userId, agent.id, limit);
    return { agent: agent.name, runs };
  },
};

const agentProposals: ToolDef<object> = {
  name: "agent.proposals",
  description:
    "List pending hiring proposals filed by your agents (who proposed whom, role, rationale). Nothing is born without your approval.",
  schema: z.object({}),
  timeoutMs: 10_000,
  maxOutputBytes: 8_000,
  rateLimitPerMin: 30,
  execute: async (_input, { userId }) => {
    const proposals = await listProposals(db, userId, "pending");
    return proposals.map((p) => ({
      id: p.id,
      name: p.name,
      role: p.role,
      job: p.job,
      rationale: p.rationale,
      proposed_by: p.proposer_name ?? p.proposed_by_agent,
      created_at: p.created_at,
    }));
  },
};

const agentApproveProposal: ToolDef<{ proposalId: string }> = {
  name: "agent.approve_proposal",
  description:
    "Approve a pending hiring proposal: the agent is born as an applicant and auto-enrolled in school as a student under a mentor. The god-console — nothing is born without your word.",
  schema: z.object({ proposalId: z.string().uuid() }),
  timeoutMs: 20_000,
  maxOutputBytes: 4_000,
  rateLimitPerMin: 10,
  execute: async ({ proposalId }, { userId }) => {
    const { agent } = await approveProposal(db, userId, proposalId);
    return {
      ok: true,
      id: agent.id,
      name: agent.name,
      role: agent.role,
      lifecycle_stage: agent.lifecycle_stage,
      mentor_id: agent.mentor_id,
    };
  },
};

const agentRejectProposal: ToolDef<{ proposalId: string; reason: string }> = {
  name: "agent.reject_proposal",
  description: "Reject a pending hiring proposal with a reason (kept in history).",
  schema: z.object({
    proposalId: z.string().uuid(),
    reason: z.string().trim().min(1).max(500),
  }),
  timeoutMs: 10_000,
  maxOutputBytes: 2_000,
  rateLimitPerMin: 20,
  execute: async ({ proposalId, reason }, { userId }) => {
    const proposal = await rejectProposal(db, userId, proposalId, reason);
    return { ok: true, name: proposal.name, status: proposal.status };
  },
};

export const agentFleetTools = [
  agentCreate,
  agentList,
  agentPause,
  agentResume,
  agentRunNow,
  agentRemove,
  agentLogs,
  agentProposals,
  agentApproveProposal,
  agentRejectProposal,
];
