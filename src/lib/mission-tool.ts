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
    const { CREDIT_PRICES, isBillingExempt, spendCredits } = await import("./credits.server");
    const missionId = crypto.randomUUID();
    // Missions burn a model call per step: price what burns. Admins exempt.
    const exempt = await isBillingExempt(supabaseAdmin, ctx.userId);
    const chargeStep = exempt
      ? undefined
      : async (stepIdx: number): Promise<boolean> => {
          const outcome = await spendCredits(
            supabaseAdmin,
            ctx.userId,
            CREDIT_PRICES.missionStep,
            `mission.step:${missionId}:${stepIdx}`,
          );
          return outcome === "ok";
        };
    const result = await runAgiMission({
      goal,
      supabase: supabaseAdmin as unknown as SupabaseLike,
      userId: ctx.userId,
      maxSteps: 6,
      chargeStep,
      // Chat path: the mission starts inside an active chat turn, so the
      // user is present — device actions are allowed (audit fix 10).
      deviceActions: "allow",
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
