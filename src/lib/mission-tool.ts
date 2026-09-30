// Server-side sandbox tool: mission.start.
//
// Exported as a plain tool-definition object so the coordinator can register it
// into the chat sandbox registry with: sandbox.register(missionTool).
// Do NOT import this file from client code — execute() runs the AGI mission
// loop server-side and returns a short summary. NOT registered here on purpose.
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { SupabaseLike } from "./mano/agi.server";

export const missionTool = {
  name: "mission.start",
  description:
    "Run an autonomous multi-step mission toward a goal (web research, device actions, memory). Use for tasks that need several steps over time — e.g. 'research the best noise-cancelling headphones under ₹15000 and notify me of the top 3'. Reports back when done.",
  schema: z.object({ goal: z.string().trim().min(3).max(2000) }),
  timeoutMs: 180_000,
  maxOutputBytes: 8_000,
  rateLimitPerMin: 10,
  execute: async (
    { goal }: { goal: string },
    ctx: { userId: string; signal: AbortSignal },
  ): Promise<unknown> => {
    const { runAgiMission } = await import("./mano/agi.server");
    const result = await runAgiMission({
      goal,
      supabase: supabaseAdmin as unknown as SupabaseLike,
      userId: ctx.userId,
      maxSteps: 6,
    });
    return {
      ok: true,
      status: result.status,
      stepsUsed: result.steps.length,
      score: result.score,
      summary: result.answer.slice(0, 3000),
    };
  },
};
