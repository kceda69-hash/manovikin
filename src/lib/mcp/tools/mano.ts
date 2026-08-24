import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { MANO_MODEL_ID, MANO_SKILLS, MANO_VERSION } from "@/lib/mano/mano1";
import { toolError } from "../ai-call";

export default defineTool({
  name: "mano",
  title: "MANO 1.1 (MANOVIK's own model)",
  description:
    "Run MANO 1.1 — MANOVIK's own model. It plans, drafts, adversarially reviews and synthesises the answer in one call, so use it for hard coding, architecture, reasoning, research and writing tasks where correctness matters more than latency.",
  inputSchema: {
    prompt: z.string().trim().min(1).max(20000).describe("The task for MANO 1.1."),
    depth: z
      .enum(["lite", "standard", "deep"])
      .optional()
      .describe("Inference depth. Omit to let MANO decide."),
    system: z.string().trim().max(4000).optional().describe("Extra operator instruction."),
  },
  annotations: { readOnlyHint: true, idempotentHint: false, openWorldHint: true },
  handler: async ({ prompt, depth, system }) => {
    try {
      const { runMano } = await import("@/lib/mano/engine.server");
      const result = await runMano({ prompt, depth, system });
      return {
        content: [{ type: "text", text: result.text }],
        structuredContent: {
          answer: result.text,
          model: result.model,
          version: result.version,
          depth: result.depth,
          skills: MANO_SKILLS.map((s) => s.id),
        },
      };
    } catch (err) {
      return toolError(err);
    }
  },
});

export const MANO_CARD = { model: MANO_MODEL_ID, version: MANO_VERSION };
