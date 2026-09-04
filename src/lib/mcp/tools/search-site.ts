import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

// Lightweight in-memory search over the public marketing/content routes so
// MCP clients can discover pages without crawling. Extend as new routes ship.
const PAGES = [
  { path: "/", title: "MANOVIK AI — Sovereign AI Coding Agent", keywords: ["home", "landing", "manovik"] },
  { path: "/setup", title: "Setup MANOVIK", keywords: ["install", "setup", "getting started"] },
  { path: "/students", title: "MANOVIK for Students", keywords: ["students", "education", "discount"] },
  { path: "/contact", title: "Contact MANOVIK", keywords: ["contact", "support", "help"] },
  { path: "/privacy", title: "Privacy Policy", keywords: ["privacy", "policy", "data"] },
  { path: "/terms", title: "Terms of Service", keywords: ["terms", "tos", "legal"] },
  { path: "/refund", title: "Refund Policy", keywords: ["refund", "returns"] },
  { path: "/vs-cursor", title: "MANOVIK vs Cursor", keywords: ["cursor", "comparison", "alternative"] },
  { path: "/vs-cline", title: "MANOVIK vs Cline", keywords: ["cline", "comparison"] },
  { path: "/vs-windsurf", title: "MANOVIK vs Windsurf", keywords: ["windsurf", "comparison"] },
  { path: "/vs-github-copilot", title: "MANOVIK vs GitHub Copilot", keywords: ["copilot", "github", "comparison"] },
  { path: "/ai-coding-assistant", title: "AI Coding Assistant", keywords: ["ai", "coding", "assistant"] },
  { path: "/best-ai-coding-agent", title: "Best AI Coding Agent", keywords: ["best", "coding", "agent"] },
  { path: "/blog/mcp-guide", title: "MCP Servers with MANOVIK", keywords: ["mcp", "guide", "servers"] },
  { path: "/mcp-servers-list", title: "MCP Servers List", keywords: ["mcp", "servers", "list", "directory"] },
  { path: "/blog/self-hosting-ai-with-ollama", title: "Self-Hosting AI with Ollama", keywords: ["ollama", "self-host"] },
  { path: "/blog/best-ai-coding-agents", title: "Best AI Coding Agents", keywords: ["blog", "coding", "agents"] },
  { path: "/blog/ai-pricing-comparison", title: "AI Pricing Comparison", keywords: ["pricing", "comparison"] },
  { path: "/blog/will-ai-replace-software-engineers", title: "Will AI Replace Software Engineers?", keywords: ["ai", "future", "engineers"] },
];

export default defineTool({
  name: "search_site",
  title: "Search manovik.in",
  description:
    "Search MANOVIK marketing and blog pages by title/keyword. Returns matching pages with absolute URLs.",
  inputSchema: {
    query: z.string().trim().min(1).max(200).describe("Search query (matched against title and keywords)."),
    limit: z.number().int().min(1).max(20).default(5).describe("Max results to return."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: ({ query, limit }) => {
    const q = query.toLowerCase();
    const matches = PAGES.filter(
      (p) => p.title.toLowerCase().includes(q) || p.keywords.some((k) => k.includes(q)),
    )
      .slice(0, limit)
      .map((p) => ({ ...p, url: `https://manovik.in${p.path}` }));
    return {
      content: [{ type: "text", text: JSON.stringify(matches, null, 2) }],
      structuredContent: { results: matches, count: matches.length },
    };
  },
});
