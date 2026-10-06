/**
 * Agent Fleet server functions for the /agents dashboard page.
 * Auth-required; every function enforces user_id ownership.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  createAgent,
  listAgents,
  setAgentStatus,
  removeAgent,
  resolveAgent,
  agentRunHistory,
  type FleetDb,
  type AgentRow,
} from "./fleet.server";
import {
  listProposals,
  approveProposal,
  rejectProposal,
  enrollStudent,
  teachStudent,
  graduateStudent,
} from "./school.server";
import { promoteToMentor, retireAgent } from "./lifecycle.server";
import { EXECUTIVE_TEMPLATES } from "./executive-templates";
import { EMPLOYEE_TEMPLATES } from "./employee-templates";

type Ctx = { supabase: FleetDb; userId: string };

/** Template catalog for the Hire section (static data, grouped by tier). */
export const listAgentTemplates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const leadership = EXECUTIVE_TEMPLATES.filter((t) => t.tier === "leadership");
    const team = EMPLOYEE_TEMPLATES.filter((t) => t.tier === "team");
    return { leadership, team };
  });

export const listFleetAgents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as unknown as Ctx;
    const agents = await listAgents(supabase, userId);
    // Lineage enrichment: resolve proposed_by / mentor ids to names.
    const ids = new Set<string>();
    for (const a of agents) {
      if (a.proposed_by) ids.add(a.proposed_by);
      if (a.mentor_id) ids.add(a.mentor_id);
    }
    const names = new Map<string, string>();
    if (ids.size > 0) {
      const byId = new Map(agents.map((a) => [a.id, a.name]));
      for (const id of ids) {
        if (byId.has(id)) {
          names.set(id, byId.get(id)!);
        } else {
          // Referenced agent not in the list (e.g. removed) — look it up.
          try {
            const { data } = await supabase
              .from("manovik_agents")
              .select("id,name")
              .eq("id", id)
              .eq("user_id", userId)
              .single();
            const r = data as unknown as { id: string; name: string } | null;
            if (r) names.set(r.id, r.name);
          } catch {
            /* best-effort */
          }
        }
      }
    }
    return agents.map((a: AgentRow) => ({
      ...a,
      proposed_by_name: a.proposed_by ? (names.get(a.proposed_by) ?? null) : null,
      mentor_name: a.mentor_id ? (names.get(a.mentor_id) ?? null) : null,
    }));
  });

export const createFleetAgent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.unknown().parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as unknown as Ctx;
    const { logAgentAction } = await import("@/lib/agent-audit.server");
    const agent = await createAgent(supabase, userId, data);
    await logAgentAction({
      userId,
      action: "fleet.create",
      summary: `Hired agent "${agent.name}" (${agent.role}), schedule ${agent.schedule}`,
      metadata: { agentId: agent.id, role: agent.role },
    });
    return agent;
  });

export const setFleetAgentStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), status: z.enum(["active", "paused"]) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as unknown as Ctx;
    const { logAgentAction } = await import("@/lib/agent-audit.server");
    const agent = await setAgentStatus(supabase, userId, data.id, data.status);
    await logAgentAction({
      userId,
      action: data.status === "paused" ? "fleet.pause" : "fleet.resume",
      summary: `Agent "${agent.name}" ${data.status}`,
      metadata: { agentId: agent.id },
    });
    return agent;
  });

export const runFleetAgentNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as unknown as Ctx;
    const { logAgentAction } = await import("@/lib/agent-audit.server");
    // Ownership check before kicking off the run.
    const agent = await resolveAgent(supabase, userId, data.id);
    const { runAgentJob } = await import("./runner.server");
    const result = await runAgentJob(agent.id, { userId });
    await logAgentAction({
      userId,
      action: "fleet.run_now",
      summary: `Manual run of agent "${agent.name}": ${result.status}`,
      metadata: { agentId: agent.id, status: result.status },
    });
    return result;
  });

export const removeFleetAgent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as unknown as Ctx;
    const { logAgentAction } = await import("@/lib/agent-audit.server");
    const agent = await resolveAgent(supabase, userId, data.id);
    await removeAgent(supabase, userId, data.id);
    await logAgentAction({
      userId,
      action: "fleet.remove",
      summary: `Removed agent "${agent.name}" (${agent.role})`,
      metadata: { agentId: data.id },
    });
    return { ok: true as const };
  });

export const fleetAgentRuns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid(), limit: z.number().int().min(1).max(25).default(10) }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as unknown as Ctx;
    return agentRunHistory(supabase, userId, data.id, data.limit);
  });

/** Pending hiring proposals with proposer names — the god-console queue. */
export const listFleetProposals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as unknown as Ctx;
    return listProposals(supabase, userId, "pending");
  });

/** Recently decided proposals (approved/rejected) for the history view. */
export const listFleetProposalHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ status: z.enum(["approved", "rejected"]) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as unknown as Ctx;
    return listProposals(supabase, userId, data.status);
  });

export const approveFleetProposal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as unknown as Ctx;
    const { agent } = await approveProposal(supabase, userId, data.id);
    return agent;
  });

export const rejectFleetProposal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), reason: z.string().trim().min(1).max(500) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as unknown as Ctx;
    return rejectProposal(supabase, userId, data.id, data.reason);
  });

/** Run a guided study session for a student agent. Can take a couple of minutes. */
export const teachFleetStudent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as unknown as Ctx;
    const { agent, newSkills } = await teachStudent(supabase, userId, data.id);
    return { agent, newSkills };
  });

/** Graduate a student to worker (needs ≥3 skills + a completed study session). */
export const graduateFleetStudent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as unknown as Ctx;
    return graduateStudent(supabase, userId, data.id);
  });

/** Re-enroll an applicant as a student (e.g. after a hire that skipped school). */
export const enrollFleetStudent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as unknown as Ctx;
    return enrollStudent(supabase, userId, data.id);
  });

/** Promote a proven worker to mentor. */
export const promoteFleetMentor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as unknown as Ctx;
    return promoteToMentor(supabase, userId, data.id);
  });

/** Retire a worker/mentor with a reason. */
export const retireFleetAgent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), reason: z.string().trim().min(1).max(500) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as unknown as Ctx;
    return retireAgent(supabase, userId, data.id, data.reason);
  });

/** World stats strip: totals, students in school, pending proposals, runs today. */
export const getFleetWorldStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as unknown as Ctx;
    const agents = await listAgents(supabase, userId);
    const byStage = (s: string) => agents.filter((a) => a.lifecycle_stage === s).length;
    let pendingProposals = 0;
    try {
      const rows = await listProposals(supabase, userId, "pending");
      pendingProposals = rows.length;
    } catch {
      /* proposals table may not exist yet */
    }
    let runsToday = 0;
    try {
      const dayStart = new Date();
      dayStart.setUTCHours(0, 0, 0, 0);
      const { data, error } = await supabase
        .from("manovik_agi_runs")
        .select("id")
        .eq("user_id", userId)
        .like("goal", "[fleet-%")
        .gte("created_at", dayStart.toISOString());
      if (!error) runsToday = ((data ?? []) as unknown[]).length;
    } catch {
      /* best-effort */
    }
    return {
      total: agents.length,
      applicants: byStage("applicant"),
      students: byStage("student"),
      workers: byStage("worker"),
      mentors: byStage("mentor"),
      retired: byStage("retired"),
      pendingProposals,
      runsToday,
    };
  });
