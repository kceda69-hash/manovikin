/**
 * Agent Fleet tick: finds due agents and runs each one's job.
 *
 * Called by the hourly agent-fleet-tick hook. Sequential, bounded, and
 * failure-isolated: one agent failing never kills the tick or the others.
 *
 * Lifecycle gate (phase 2): only `worker` and `mentor` stages run on the
 * tick. Applicants/students are in school (teach/graduate drive them);
 * retired agents never run again.
 */
import { runAgentJob } from "./runner.server";
import { isTickableStage } from "./lifecycle.server";

export interface FleetTickResult {
  ok: boolean;
  checked: number;
  ran: number;
  succeeded: number;
  failed: number;
  error?: string;
}

/** Max agents per tick so one cron invocation can't run forever. */
const TICK_LIMIT = 10;

export async function runDueAgents(): Promise<FleetTickResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { logAgentAction } = await import("@/lib/agent-audit.server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any;

  let due: Array<{ id: string; user_id: string; name: string; lifecycle_stage: string }>;
  try {
    const { data, error } = await db
      .from("manovik_agents")
      .select("id,user_id,name,lifecycle_stage")
      .eq("status", "active")
      .lte("next_run_at", new Date().toISOString())
      .order("next_run_at", { ascending: true })
      .limit(TICK_LIMIT);
    if (error) throw new Error(error.message);
    // Lifecycle gate: applicants/students are in school, retired stay retired.
    due = ((data ?? []) as Array<{ id: string; user_id: string; name: string; lifecycle_stage: string }>).filter(
      (a) => isTickableStage(a.lifecycle_stage as "worker" | "mentor" | "student" | "applicant" | "retired"),
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/42P01|relation .* does not exist/i.test(msg)) {
      // Fail closed: table not set up yet — report, don't crash the hook.
      return { ok: false, checked: 0, ran: 0, succeeded: 0, failed: 0, error: "manovik_agents table not set up" };
    }
    throw e;
  }

  const result: FleetTickResult = { ok: true, checked: due.length, ran: 0, succeeded: 0, failed: 0 };
  for (const agent of due) {
    try {
      const r = await runAgentJob(agent.id);
      result.ran += 1;
      if (r.ok) result.succeeded += 1;
      else result.failed += 1;
    } catch (e) {
      // Belt and suspenders: runAgentJob never throws, but the tick must
      // survive even if that contract ever breaks.
      result.ran += 1;
      result.failed += 1;
      await logAgentAction({
        userId: agent.user_id,
        action: "fleet.tick_agent_error",
        summary: `Tick: agent "${agent.name}" threw unexpectedly`,
        metadata: { agentId: agent.id, error: e instanceof Error ? e.message.slice(0, 200) : "unknown" },
      });
    }
  }
  return result;
}
