import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { TIER_MODEL, fallbackChainFor, routeModel } from "@/lib/model-router";
import { toolError } from "../ai-call";

export default defineTool({
  name: "manovik_models",
  title: "MANOVIK model routing",
  description:
    "Inspect MANOVIK's model router: list the tiers (trivial, standard, hard, vision) and the model each maps to, and — when a prompt is supplied — show which model MANOVIK would route that prompt to, with its fallback chain. Useful for cost/latency planning before calling `manovik_ask` or `manovik_code`.",
  inputSchema: {
    prompt: z
      .string()
      .trim()
      .max(8000)
      .optional()
      .describe("Optional prompt to preview routing for (no model call is made)."),
    has_attachments: z
      .boolean()
      .default(false)
      .describe("Whether the request would include images or files."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: ({ prompt, has_attachments }) => {
    try {
      const tiers = Object.entries(TIER_MODEL).map(([tier, cfg]) => ({
        tier,
        model: cfg.model,
        priority: cfg.priority,
      }));

      const routed = prompt
        ? (() => {
            const route = routeModel(prompt, { hasAttachments: has_attachments });
            return { ...route, fallbacks: fallbackChainFor(route) };
          })()
        : null;

      const payload = { tiers, routed };
      return {
        content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
        structuredContent: payload,
      };
    } catch (err) {
      return toolError(err);
    }
  },
});
