// Server-only runner for MANOVIK Scheduled Agents.
// Executes due schedules with the FORCE swarm engine and records each run.

import { runForce } from "@/lib/force/engine.server";
import type { ForceMode } from "@/lib/force/types";

const CADENCE_MS: Record<string, number> = {
  hourly: 60 * 60 * 1000,
  daily: 24 * 60 * 60 * 1000,
  weekly: 7 * 24 * 60 * 60 * 1000,
};

export type ScheduleRow = {
  id: string;
  user_id: string;
  objective: string;
  mode: string;
  cadence: string;
  run_count: number;
};

export function nextRunFrom(cadence: string, from = Date.now()): string {
  return new Date(from + (CADENCE_MS[cadence] ?? CADENCE_MS["daily"]!)).toISOString();
}

/** Run one schedule and persist the outcome. Never throws. */
export async function executeSchedule(row: ScheduleRow) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const started = Date.now();

  const { data: run } = await supabaseAdmin
    .from("manovik_schedule_runs")
    .insert({ schedule_id: row.id, user_id: row.user_id, status: "running" })
    .select("id")
    .single();

  try {
    const mode = (["build", "research", "operate", "clone"].includes(row.mode) ? row.mode : "research") as ForceMode;
    const outcome = await runForce(row.objective, mode, 3, async () => {});
    await supabaseAdmin
      .from("manovik_schedule_runs")
      .update({
        status: "success",
        result: outcome.answer.slice(0, 40_000),
        duration_ms: Date.now() - started,
      })
      .eq("id", run?.id ?? "");
    return { ok: true as const };
  } catch (err) {
    await supabaseAdmin
      .from("manovik_schedule_runs")
      .update({
        status: "failed",
        error: String((err as Error)?.message ?? err).slice(0, 800),
        duration_ms: Date.now() - started,
      })
      .eq("id", run?.id ?? "");
    return { ok: false as const, error: String((err as Error)?.message ?? err) };
  } finally {
    await supabaseAdmin
      .from("manovik_schedules")
      .update({
        last_run_at: new Date().toISOString(),
        next_run_at: nextRunFrom(row.cadence),
        run_count: row.run_count + 1,
      })
      .eq("id", row.id);
  }
}

/** Run every schedule that is due. Bounded so a cron tick cannot run forever. */
export async function runDueSchedules(limit = 5) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("manovik_schedules")
    .select("id, user_id, objective, mode, cadence, run_count")
    .eq("enabled", true)
    .lte("next_run_at", new Date().toISOString())
    .order("next_run_at", { ascending: true })
    .limit(limit);
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as ScheduleRow[];
  const results = [];
  for (const row of rows) results.push({ id: row.id, ...(await executeSchedule(row)) });
  return { ran: results.length, results };
}
