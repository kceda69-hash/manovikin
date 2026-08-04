import { defineTool } from "@lovable.dev/mcp-js";

const CAPABILITIES = {
  product: "MANOVIK AI",
  site: "https://manovik.in",
  summary:
    "Sovereign, quantum-grade AI engineering agent. Reachable over MCP so any assistant (ChatGPT, Claude, Cursor, Codex) can use MANOVIK's brain, coding agent and services.",
  tools: [
    { name: "manovik_ask", use: "Reasoning, research, analysis, planning, writing, math, science, general knowledge." },
    { name: "manovik_code", use: "Build, debug, refactor, review, test, architect, optimize, or explain code." },
    { name: "manovik_reverse_engineer", use: "Requirements extraction, architecture maps, clone plans, clean-room reimplementation." },
    { name: "manovik_write", use: "Articles, blog posts, landing copy, emails, social posts, docs, outlines." },
    { name: "manovik_translate", use: "Translate and localize text while preserving markdown, code and placeholders." },
    { name: "manovik_extract", use: "Messy text to structured JSON: extraction, classification, entities, sentiment, summaries." },
    { name: "manovik_optimize_prompt", use: "Rewrite prompts for chat, coding, image, agent or search targets." },
    { name: "manovik_supply_chain_scan", use: "Offline audit of package.json, lockfile, AI hosts and model config with a 0-100 score." },
    { name: "manovik_models", use: "Preview MANOVIK's model routing tiers and fallback chain for a prompt." },
    { name: "manovik_run_tool", use: "Sandboxed utilities: arithmetic, text transforms, server time, allow-listed HTTP GET." },
    { name: "search_site", use: "Find pages on manovik.in." },
    { name: "list_blog_posts", use: "Browse the MANOVIK blog catalog." },
    { name: "get_pricing", use: "Current lifetime-license pricing." },
  ],
  in_app_only: [
    { feature: "Image studio", detail: "Ultra-detail 4K/8K generation with seed, aspect ratio and upscaling — https://manovik.in/chat" },
    { feature: "Device bridge (JARVIS mode)", detail: "Pair a computer or phone and run safety-screened commands — https://manovik.in/devices" },
    { feature: "Coding workspace", detail: "In-browser IDE with file tree, diffs, terminal sandbox and live preview — https://manovik.in/chat" },
    { feature: "Sovereign self-hosting", detail: "Run MANOVIK against your own OpenAI-compatible endpoint (Ollama, vLLM) — https://manovik.in/setup" },
  ],
  notes:
    "MCP tools run without a MANOVIK account and are rate-limited. Account-scoped features (credits, devices, saved threads, billing) require signing in at https://manovik.in.",
} as const;

export default defineTool({
  name: "manovik_capabilities",
  title: "MANOVIK capabilities",
  description:
    "List everything MANOVIK can do over MCP and which services require the MANOVIK web app. Call this first to decide which MANOVIK tool to use.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: () => ({
    content: [{ type: "text", text: JSON.stringify(CAPABILITIES, null, 2) }],
    structuredContent: CAPABILITIES,
  }),
});
