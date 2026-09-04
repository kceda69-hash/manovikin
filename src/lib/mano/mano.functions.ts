import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { MANO_MODEL_ID, MANO_SKILLS, MANO_VERSION } from "./mano1";

const playgroundInput = z.object({
  prompt: z.string().trim().min(1).max(20000),
  system: z.string().trim().max(4000).optional(),
  depth: z.enum(["auto", "lite", "standard", "deep"]).default("auto"),
  maxTokens: z.number().int().min(256).max(8000).default(4000),
});

/** Run one MANO 1.1 inference for a signed-in user and return the full stage trace. */
export const runManoPlayground = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => playgroundInput.parse(input))
  .handler(async ({ data }) => {
    const { runMano } = await import("./engine.server");
    const started = Date.now();
    try {
      const result = await runMano({
        prompt: data.prompt,
        ...(data.system ? { system: data.system } : {}),
        ...(data.depth === "auto" ? {} : { depth: data.depth }),
        maxTokens: data.maxTokens,
      });
      return { ok: true as const, ...result, totalMs: Date.now() - started };
    } catch (error) {
      console.error("[mano:playground]", error);
      throw new Error(error instanceof Error ? error.message : "MANO 1.1 request failed");
    }
  });

/** Public model card for the playground sidebar. */
export const getManoCard = createServerFn({ method: "GET" }).handler(async () => {
  const sovereign = Boolean(process.env.MANOVIK_AI_BASE_URL);
  return {
    model: MANO_MODEL_ID,
    version: MANO_VERSION,
    skills: MANO_SKILLS,
    serving: sovereign ? ("manovik-cloud" as const) : ("substrate" as const),
    weights: process.env.MANOVIK_AI_MODEL_ID ? "manovik-trained" : "composite",
  };
});
