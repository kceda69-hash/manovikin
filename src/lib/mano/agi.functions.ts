import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";

/**
 * Minimal structural stand-in for the supabase client's chained query builder,
 * following the SupabaseLike pattern in agi.server.ts / training.server.ts.
 * (The manovik_agi_* tables are not in the generated Database types, so the
 * typed client cannot express them.)
 */
interface AgiQuery extends Promise<{ data: Json[] | null; error: { message: string } | null }> {
  select: (columns: string) => AgiQuery;
  insert: (row: Record<string, unknown>) => AgiQuery;
  update: (values: Record<string, unknown>) => AgiQuery;
  delete: () => AgiQuery;
  eq: (column: string, value: string | number | boolean) => AgiQuery;
  order: (column: string, opts: { ascending: boolean }) => AgiQuery;
  limit: (n: number) => Promise<{ data: Json[] | null; error: { message: string } | null }>;
  single: () => Promise<{ data: { id: string }; error: { message: string } | null }>;
}

type Ctx = { supabase: { from: (table: string) => AgiQuery }; userId: string };

const missionInput = z.object({
  goal: z.string().trim().min(4).max(4000),
  maxSteps: z.number().int().min(1).max(8).default(5),
  // Explicit opt-in for real-world device actions. Defaults to false: without
  // it the mission loop's device tool refuses (agent-safety audit fix 10).
  allowDeviceActions: z.boolean().default(false),
});

/** Run one autonomous MANO mission end to end and persist it. */
export const runMission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => missionInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as unknown as Ctx;
    const { runAgiMission } = await import("./agi.server");
    const { CREDIT_PRICES, isBillingExempt, spendCredits } = await import("@/lib/credits.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // FIX (agent-safety audit): this server-function path ran unmetered while
    // the chat path (mission-tool.ts) charges per step. Meter identically —
    // admins exempt — so the credit brake on autonomous device actions and
    // fetches applies uniformly.
    const missionId = crypto.randomUUID();
    const exempt = await isBillingExempt(supabaseAdmin, userId);
    const chargeStep = exempt
      ? undefined
      : async (stepIdx: number): Promise<boolean> => {
          const outcome = await spendCredits(
            supabaseAdmin,
            userId,
            CREDIT_PRICES.missionStep,
            `mission.step:${missionId}:${stepIdx}`,
          );
          return outcome === "ok";
        };

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
        chargeStep,
        deviceActions: data.allowDeviceActions ? "allow" : "deny",
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
    const { supabase, userId } = context as unknown as Ctx;
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

/** Compile past missions + lessons into MANO's active doctrine (self-training). */
export const trainMano = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as unknown as Ctx;
    const { trainDoctrine } = await import("./training.server");
    return await trainDoctrine(supabase, userId);
  });

/** The doctrine currently loaded into MANO's brain for this user. */
export const getDoctrine = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as unknown as Ctx;
    const { data } = await supabase
      .from("manovik_agi_doctrine")
      .select("doctrine, runs_used, lessons_used, created_at")
      .eq("user_id", userId)
      .eq("active", true)
      .order("created_at", { ascending: false })
      .limit(1);
    return { doctrine: (data ?? [])[0] ?? null };
  });

/** Delete one learned lesson. */
export const forgetLesson = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as unknown as Ctx;
    const { error } = await supabase
      .from("manovik_agi_lessons")
      .delete()
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
