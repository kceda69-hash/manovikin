import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { askManovik, toolError } from "../ai-call";

export default defineTool({
  name: "manovik_translate",
  title: "MANOVIK translate & localize",
  description:
    "Translate or localize text between any languages while preserving markdown, code blocks, placeholders ({name}, %s, {{var}}) and formatting. Supports formal/informal register and glossary terms that must stay untranslated.",
  inputSchema: {
    text: z.string().trim().min(1).max(20000).describe("Text to translate. Markdown and code are preserved."),
    to: z.string().trim().min(2).max(40).describe("Target language, e.g. 'Hindi', 'Japanese', 'pt-BR'."),
    from: z.string().trim().max(40).optional().describe("Source language. Auto-detected when omitted."),
    register: z
      .enum(["neutral", "formal", "informal", "marketing", "technical"])
      .default("neutral")
      .describe("Tone/register of the translation."),
    keep_terms: z
      .array(z.string().max(60))
      .optional()
      .describe("Terms that must remain untranslated, e.g. brand names."),
  },
  annotations: { readOnlyHint: true, idempotentHint: false, openWorldHint: true },
  handler: async ({ text, to, from, register, keep_terms }) => {
    try {
      const rules = [
        `Translate the user's text into ${to}${from ? ` from ${from}` : ""}.`,
        `Register: ${register}.`,
        "Preserve markdown structure, code blocks, inline code, URLs and placeholder tokens exactly.",
        "Return only the translation — no notes, no original text.",
      ];
      if (keep_terms?.length) rules.push(`Do not translate these terms: ${keep_terms.join(", ")}.`);

      const { text: out, model, tier } = await askManovik({
        prompt: text,
        system: rules.join("\n"),
        maxTokens: 6000,
      });
      return {
        content: [{ type: "text", text: out }],
        structuredContent: { translation: out, to, from: from ?? "auto", model, tier },
      };
    } catch (err) {
      return toolError(err);
    }
  },
});
