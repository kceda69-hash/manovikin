import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

// Static catalog of published blog posts on manovik.in. Keep in sync with
// src/routes/blog.*.tsx and the sitemap.
const POSTS = [
  {
    slug: "mcp-guide",
    title: "MCP Servers with MANOVIK — A Sovereign AI Guide",
    url: "https://manovik.in/blog/mcp-guide",
    summary:
      "How to extend MANOVIK AI with Model Context Protocol (MCP) servers on a sovereign, self-hosted deployment.",
  },
  {
    slug: "self-hosting-ai-with-ollama",
    title: "Self-Hosting AI with Ollama",
    url: "https://manovik.in/blog/self-hosting-ai-with-ollama",
    summary: "Run local LLMs alongside MANOVIK using Ollama for a fully sovereign AI stack.",
  },
  {
    slug: "best-ai-coding-agents",
    title: "The Best AI Coding Agents",
    url: "https://manovik.in/blog/best-ai-coding-agents",
    summary: "A comparison of leading AI coding agents and where MANOVIK fits in.",
  },
  {
    slug: "ai-pricing-comparison",
    title: "AI Pricing Comparison",
    url: "https://manovik.in/blog/ai-pricing-comparison",
    summary:
      "Side-by-side pricing of major AI coding assistants including MANOVIK's lifetime plan.",
  },
  {
    slug: "will-ai-replace-software-engineers",
    title: "Will AI Replace Software Engineers?",
    url: "https://manovik.in/blog/will-ai-replace-software-engineers",
    summary: "A grounded take on how AI reshapes — not replaces — software engineering.",
  },
] as const;

export default defineTool({
  name: "list_blog_posts",
  title: "List blog posts",
  description:
    "List MANOVIK blog posts (slug, title, URL, summary). Use before fetching a specific post.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: () => ({
    content: [{ type: "text", text: JSON.stringify(POSTS, null, 2) }],
    structuredContent: { posts: POSTS },
  }),
});
