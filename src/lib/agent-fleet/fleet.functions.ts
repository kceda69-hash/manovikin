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
} from "./fleet.server";
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
    return listAgents(supabase, userId);
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
