import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { askManovik, toolError } from "../ai-call";

const MODE_PROMPT: Record<string, string> = {
  auto: "",
  think:
    "Reason deeply and step by step before answering. Surface the key trade-offs, then give a decisive conclusion.",
  research:
    "Answer as a domain researcher: structure the answer with headings, cover competing positions, and clearly separate established fact from inference.",
  explain:
    "Explain clearly for a smart non-expert: concrete analogies, short paragraphs, and a one-line summary at the end.",
  plan:
    "Produce an execution plan: numbered milestones, owner-less concrete tasks, dependencies, risks, and a definition of done.",
};

export default defineTool({
  name: "manovik_ask",
  title: "Ask MANOVIK AI",
  description:
    "Ask MANOVIK AI anything — reasoning, research, analysis, planning, writing, math, science, business, or general knowledge. Returns MANOVIK's full answer as markdown. Use `manovik_code` instead for code generation, debugging, or architecture work.",
  inputSchema: {
    prompt: z.string().trim().min(1).max(20000).describe("The question or task for MANOVIK AI."),
    mode: z
      .enum(["auto", "think", "research", "explain", "plan"])
      .default("auto")
      .describe("Response style: auto, deep reasoning, research report, plain explanation, or execution plan."),
    language: z
      .string()
      .trim()
      .max(40)
      .optional()
      .describe("Reply language, e.g. 'English', 'Hindi'. Defaults to the language of the prompt."),
  },
  annotations: { readOnlyHint: true, idempotentHint: false, openWorldHint: true },
  handler: async ({ prompt, mode, language }) => {
    try {
      const parts = [MODE_PROMPT[mode] ?? ""];
      if (language) parts.push(`Reply in ${language}.`);
      const system = parts.filter(Boolean).join("\n");
      const { text, model, tier } = await askManovik({ prompt, system: system || undefined });
      return {
        content: [{ type: "text", text }],
        structuredContent: { answer: text, model, tier },
      };
    } catch (err) {
      return toolError(err);
    }
  },
});
