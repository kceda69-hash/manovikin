import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Ctx = { supabase: any; userId: string };

const missionInput = z.object({
  goal: z.string().trim().min(4).max(4000),
  maxSteps: z.number().int().min(1).max(8).default(5),
});

/** Run one autonomous MANO mission end to end and persist it. */
export const runMission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => missionInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as Ctx;
    const { runAgiMission } = await import("./agi.server");

    const { data: run, error } = await supabase
      .from("manovik_agi_runs")
      .insert({ user_id: userId, goal: data.goal, status: "running" })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    try {
      const result = await runAgiMission({
        goal: data.goal,
        supabase,
        userId,
        maxSteps: data.maxSteps,
        onStep: async (step) => {
          const { error: stepError } = await supabase.from("manovik_agi_steps").insert({
            run_id: run.id,
            user_id: userId,
            idx: step.idx,
            thought: step.thought,
            tool: step.tool,
            tool_input: step.input,
            observation: step.observation,
            ms: step.ms,
          });
          if (stepError) console.error("[agi:step]", stepError.message);
        },
      });

      await supabase
        .from("manovik_agi_runs")
        .update({
          status: result.status,
          answer: result.answer,
          steps_used: result.steps.length,
          score: result.score,
          completed_at: new Date().toISOString(),
        })
        .eq("id", run.id);

      return { ok: true as const, runId: run.id as string, ...result };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Mission failed";
      await supabase
        .from("manovik_agi_runs")
        .update({ status: "failed", error: message, completed_at: new Date().toISOString() })
        .eq("id", run.id);
      throw new Error(message);
    }
  });

/** Recent missions plus the lessons MANO has learned for this user. */
export const listMissions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as Ctx;
    const [runs, lessons] = await Promise.all([
      supabase
        .from("manovik_agi_runs")
        .select("id, goal, status, score, steps_used, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("manovik_agi_lessons")
        .select("id, topic, lesson, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);
    return { runs: runs.data ?? [], lessons: lessons.data ?? [] };
  });

/** Delete one learned lesson. */
export const forgetLesson = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as Ctx;
    const { error } = await supabase
      .from("manovik_agi_lessons")
      .delete()
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
