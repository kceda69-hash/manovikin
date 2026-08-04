import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { askManovik, toolError } from "../ai-call";

const FORMAT_PROMPT: Record<string, string> = {
  article: "Write a structured long-form article with H2/H3 headings, scannable paragraphs and a conclusion.",
  blog: "Write an engaging blog post: hook opening, subheadings, concrete examples, short paragraphs.",
  landing: "Write landing-page copy: headline, subheadline, 3-5 benefit blocks, social-proof line, and a CTA.",
  email: "Write an email: subject line, preview text, tight body, single clear call to action.",
  social: "Write short social posts: punchy, no fluff, platform-appropriate length, no hashtag spam.",
  docs: "Write technical documentation: purpose, prerequisites, step-by-step usage, examples, gotchas.",
  outline: "Produce a detailed outline only: nested bullets with one line of intent per section.",
};

export default defineTool({
  name: "manovik_write",
  title: "MANOVIK writing studio",
  description:
    "Generate publication-ready written content: articles, blog posts, landing-page copy, emails, social posts, documentation or outlines. Supports tone, audience, target length, SEO keywords and language.",
  inputSchema: {
    topic: z.string().trim().min(1).max(8000).describe("What to write about, including any key facts to include."),
    format: z
      .enum(["article", "blog", "landing", "email", "social", "docs", "outline"])
      .default("article")
      .describe("Kind of content to produce."),
    tone: z.string().trim().max(80).optional().describe("Desired tone, e.g. 'confident, technical, no hype'."),
    audience: z.string().trim().max(160).optional().describe("Who is reading, e.g. 'senior backend engineers'."),
    words: z.number().int().min(50).max(4000).optional().describe("Approximate target word count."),
    keywords: z.array(z.string().max(60)).optional().describe("SEO keywords to weave in naturally."),
    language: z.string().trim().max(40).optional().describe("Output language. Defaults to the input language."),
  },
  annotations: { readOnlyHint: true, idempotentHint: false, openWorldHint: true },
  handler: async ({ topic, format, tone, audience, words, keywords, language }) => {
    try {
      const rules = [FORMAT_PROMPT[format] ?? ""];
      if (tone) rules.push(`Tone: ${tone}.`);
      if (audience) rules.push(`Audience: ${audience}.`);
      if (words) rules.push(`Target length: about ${words} words.`);
      if (keywords?.length) rules.push(`Include these keywords naturally: ${keywords.join(", ")}.`);
      if (language) rules.push(`Write in ${language}.`);
      rules.push("Return only the finished content in markdown — no preamble, no meta-commentary.");

      const { text, model, tier } = await askManovik({
        prompt: topic,
        system: rules.filter(Boolean).join("\n"),
        maxTokens: words ? Math.min(8000, Math.ceil(words * 3)) : 4000,
      });
      return { content: [{ type: "text", text }], structuredContent: { content: text, format, model, tier } };
    } catch (err) {
      return toolError(err);
    }
  },
});
