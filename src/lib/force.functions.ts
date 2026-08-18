import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { ForceMode, ForceRun, ForceStep, AgentResult } from "@/lib/force/types";

const RUNS = "manovik_force_runs";
const AGENTS = "manovik_force_agents";
const STEPS = "manovik_force_steps";

function fail(tag: string, error: unknown): never {
  console.error(`[force:${tag}]`, error);
  throw new Error(error instanceof Error ? error.message : "MANOVIK FORCE request failed");
}

const startInput = z.object({
  objective: z.string().trim().min(8).max(8000),
  mode: z.enum(["build", "research", "operate", "clone"]).default("build"),
  agents: z.number().int().min(2).max(4).default(4),
  parentRunId: z.string().uuid().nullable().default(null),
  forkFromStep: z.number().int().min(0).max(50).nullable().default(null),
});

/**
 * Launch a swarm run. Runs the full engine inline and returns the finished run
 * so the caller gets one deterministic result (the engine streams its phases
 * into the steps table as it goes, which powers the rewind timeline).
 */
export const startForceRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => startInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };

    const { data: run, error } = await supabase
      .from(RUNS)
      .insert({
        user_id: userId,
        objective: data.objective,
        mode: data.mode,
        status: "running",
        parent_run_id: data.parentRunId,
        fork_from_step: data.forkFromStep,
      })
      .select("id")
      .single();
    if (error) fail("createRun", error);

    const runId = run.id as string;
    let idx = 0;

    try {
      const { runForce } = await import("@/lib/force/engine.server");
      const outcome = await runForce(data.objective, data.mode as ForceMode, data.agents, async (phase, label, payload) => {
        const { error: stepError } = await supabase.from(STEPS).insert({
          run_id: runId,
          user_id: userId,
          idx: idx++,
          phase,
          label,
          payload: payload as Record<string, unknown>,
        });
        // A dropped step silently breaks the rewind timeline — surface it.
        if (stepError) fail("saveStep", stepError);
      });

      const { error: agentsError } = await supabase.from(AGENTS).insert(
        outcome.agents.map((a) => ({
          run_id: runId,
          user_id: userId,
          role: a.role,
          model: a.model,
          output: a.output,
          critique: a.critique,
          score: a.score,
        })),
      );
      if (agentsError) fail("saveAgents", agentsError);

      const { error: finishError } = await supabase
        .from(RUNS)
        .update({
          status: "done",
          answer: outcome.answer,
          score: outcome.score,
          proof: outcome.proof,
          actions: outcome.actions,
          completed_at: new Date().toISOString(),
        })
        .eq("id", runId);
      // Without this the swarm result is computed but never persisted, and the
      // mission stays stuck on "running" for the user.
      if (finishError) fail("finishRun", finishError);

      return { runId };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Swarm failed";
      console.error("[force:run]", err);
      await supabase
        .from(RUNS)
        .update({ status: "failed", error: message, completed_at: new Date().toISOString() })
        .eq("id", runId);
      return { runId, error: message };
    }
  });

export const listForceRuns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    const { data, error } = await supabase
      .from(RUNS)
      .select("id,objective,mode,status,score,created_at,parent_run_id")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) fail("listRuns", error);
    return (data ?? []) as Array<Pick<ForceRun, "id" | "objective" | "mode" | "status" | "score" | "created_at" | "parent_run_id">>;
  });

export const getForceRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };

    const { data: run, error } = await supabase
      .from(RUNS)
      .select("*")
      .eq("id", data.id)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) fail("getRun", error);
    if (!run) throw new Error("Run not found");

    const [{ data: agents }, { data: steps }] = await Promise.all([
      supabase
        .from(AGENTS)
        .select("role,model,output,critique,score")
        .eq("run_id", data.id)
        .order("created_at", { ascending: true }),
      supabase
        .from(STEPS)
        .select("idx,phase,label,created_at")
        .eq("run_id", data.id)
        .order("idx", { ascending: true }),
    ]);

    return {
      run: run as ForceRun,
      agents: (agents ?? []) as AgentResult[],
      steps: (steps ?? []) as ForceStep[],
    };
  });

export const deleteForceRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    const { error } = await supabase.from(RUNS).delete().eq("id", data.id).eq("user_id", userId);
    if (error) fail("deleteRun", error);
    return { ok: true };
  });
