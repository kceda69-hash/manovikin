import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

const TITLE = "Claude Code vs Cursor (2026): Key Differences";
const DESCRIPTION =
  "Claude Code (CLI) vs Cursor (IDE) compared: tool use, terminal workflows, and pricing — plus MANOVIK as the sovereign alternative.";
const URL = "https://manovik.in/blog/claude-code-vs-cursor";

export const Route = createFileRoute("/blog/claude-code-vs-cursor")({
  component: ClaudeCodeVsCursorPage,
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "article" },
      { property: "og:url", content: URL },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: TITLE },
      { name: "twitter:description", content: DESCRIPTION },
    ],
    links: [{ rel: "canonical", href: URL }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Article",
          headline: TITLE,
          description: DESCRIPTION,
          datePublished: "2026-07-09",
          author: { "@type": "Organization", name: "MANOVIK AI", url: "https://manovik.in" },
          publisher: {
            "@type": "Organization",
            name: "MANOVIK AI",
            url: "https://manovik.in",
            logo: { "@type": "ImageObject", url: "https://manovik.in/favicon.ico" },
          },
          mainEntityOfPage: URL,
        }),
      },
    ],
  }),
});

type Row = {
  dimension: string;
  claudeCode: string;
  cursor: string;
  manovik: string;
};

const COMPARISON: Row[] = [
  {
    dimension: "Surface",
    claudeCode: "Terminal (CLI, headless-capable)",
    cursor: "Forked VS Code IDE (GUI)",
    manovik: "CLI + editor bridge, self-hosted",
  },
  {
    dimension: "Primary model",
    claudeCode: "Claude Sonnet / Opus (Anthropic API)",
    cursor: "Multi-model router (GPT / Claude / Gemini)",
    manovik: "Bring-your-own model (Anthropic, OpenAI, Ollama, vLLM)",
  },
  {
    dimension: "Pricing model",
    claudeCode: "Pay-per-token via Anthropic API",
    cursor: "$20/mo subscription (Pro) with request caps",
    manovik: "One-time lifetime license (₹4,999)",
  },
  {
    dimension: "Runs in CI / cron",
    claudeCode: "Yes — headless mode",
    cursor: "No — requires the IDE window",
    manovik: "Yes — headless agent + MCP tools",
  },
  {
    dimension: "Editor freedom",
    claudeCode: "Any editor — CLI is orthogonal",
    cursor: "Locked to the Cursor fork",
    manovik: "Any editor; VS Code / JetBrains bridges",
  },
  {
    dimension: "Sovereign / air-gapped",
    claudeCode: "No — hits Anthropic API",
    cursor: "No — cloud-only agent traffic",
    manovik: "Yes — self-host end to end",
  },
  {
    dimension: "MCP tool support",
    claudeCode: "First-class (client)",
    cursor: "Yes (client, since 2025)",
    manovik: "First-class (client and server)",
  },
];

const CLAUDE_ONLY = [
  {
    title: "Headless / scripted runs",
    body: "Claude Code runs unattended: cron jobs, CI hooks, git pre-push checks. Cursor's agent needs the IDE window open — you cannot invoke it from a shell script or GitHub Action.",
  },
  {
    title: "Editor-agnostic",
    body: "You keep Neovim, JetBrains, Zed, or VS Code stock. Cursor requires switching to its VS Code fork; every extension, keybinding, and settings sync has to be re-verified in that fork.",
  },
  {
    title: "Pipeable output",
    body: "Claude Code's stdout composes with grep, jq, and shell pipelines. Cursor's agent output lives inside a chat pane — copy-paste only.",
  },
  {
    title: "Long-running background tasks",
    body: "A Claude Code session can run for hours against a large refactor without an IDE process holding memory. Cursor's per-request caps and IDE lifecycle make multi-hour agent runs impractical.",
  },
  {
    title: "Per-token cost transparency",
    body: "You see token usage per command. Cursor's subscription model hides that behind opaque 'fast request' counters, and heavy users get throttled once the monthly quota is spent.",
  },
];

const CURSOR_ONLY = [
  {
    title: "Inline tab-completion",
    body: "Cursor's Cmd+K and tab-completion are tightly integrated with the editor cursor position. Claude Code has no per-keystroke completion — it operates in agent turns.",
  },
  {
    title: "Visual diff review inside the editor",
    body: "Cursor renders agent diffs as an inline editor overlay you accept hunk by hunk. Claude Code writes files directly and relies on git diff for review.",
  },
];

function ClaudeCodeVsCursorPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <Link
        to="/blog/best-ai-coding-agents"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to the blog
      </Link>

      <header className="mt-6 space-y-3">
        <p className="text-sm uppercase tracking-wide text-muted-foreground">
          Comparison · 9 July 2026
        </p>
        <h1 className="text-4xl font-semibold tracking-tight">
          Claude Code vs Cursor: what Claude Code can do that Cursor can't
        </h1>
        <p className="text-lg text-muted-foreground">
          Claude Code and Cursor solve the same problem — AI that ships code — from opposite ends of
          the workflow. Claude Code lives in your terminal; Cursor lives inside a forked VS Code.
          Here's a concrete side-by-side, and where MANOVIK fits for teams that want the agentic
          power of both without the cloud dependency.
        </p>
      </header>

      <section className="mt-10 space-y-4">
        <h2 className="text-2xl font-semibold">At a glance</h2>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="p-3">Dimension</th>
                <th className="p-3">Claude Code</th>
                <th className="p-3">Cursor</th>
                <th className="p-3">MANOVIK</th>
              </tr>
            </thead>
            <tbody>
              {COMPARISON.map((row) => (
                <tr key={row.dimension} className="border-t border-border">
                  <td className="p-3 font-medium">{row.dimension}</td>
                  <td className="p-3 text-muted-foreground">{row.claudeCode}</td>
                  <td className="p-3 text-muted-foreground">{row.cursor}</td>
                  <td className="p-3 text-muted-foreground">{row.manovik}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-10 space-y-4">
        <h2 className="text-2xl font-semibold">What Claude Code can do that Cursor can't</h2>
        <ul className="space-y-4">
          {CLAUDE_ONLY.map((item) => (
            <li key={item.title} className="rounded-lg border border-border p-4">
              <p className="font-medium">{item.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{item.body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10 space-y-4">
        <h2 className="text-2xl font-semibold">What Cursor still does better</h2>
        <ul className="space-y-4">
          {CURSOR_ONLY.map((item) => (
            <li key={item.title} className="rounded-lg border border-border p-4">
              <p className="font-medium">{item.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{item.body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10 space-y-4">
        <h2 className="text-2xl font-semibold">Cost: pay-per-token vs subscription</h2>
        <p className="text-muted-foreground">
          Claude Code's pay-per-token model is honest but unbounded — a long refactor against Opus
          can quietly cross $20 in a single session. Cursor's $20/month Pro plan is predictable but
          caps "fast" requests; heavy agent users hit the slow queue by mid-month. Neither model is
          wrong; they optimize for different usage shapes. A one-off migration favors Claude Code;
          steady daily use favors Cursor.
        </p>
      </section>

      <section className="mt-10 space-y-4 rounded-lg border border-primary/20 bg-primary/5 p-6">
        <h2 className="text-2xl font-semibold">Where MANOVIK fits</h2>
        <p className="text-muted-foreground">
          MANOVIK is the sovereign alternative for teams that like the agentic power of both Claude
          Code and Cursor but need private, self-hosted deployments — regulated industries,
          air-gapped environments, or anyone tired of per-seat SaaS pricing.
        </p>
        <ul className="ml-5 list-disc space-y-2 text-muted-foreground">
          <li>
            Runs on your infrastructure — bring your own Anthropic, OpenAI, or local Ollama / vLLM
            model.
          </li>
          <li>
            Headless like Claude Code, editor-agnostic, and MCP-native on both client and server.
          </li>
          <li>One-time lifetime license (₹4,999) — no per-seat or per-token surprises.</li>
        </ul>
        <div className="flex flex-wrap gap-3 pt-2">
          <Link
            to="/vs-cursor"
            className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            MANOVIK vs Cursor →
          </Link>
          <Link
            to="/setup"
            className="inline-flex items-center rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            Set up MANOVIK
          </Link>
        </div>
      </section>

      <section className="mt-10 space-y-4">
        <h2 className="text-2xl font-semibold">Which should you pick?</h2>
        <ul className="ml-5 list-disc space-y-2 text-muted-foreground">
          <li>
            <strong>Pick Claude Code</strong> if you live in the terminal, want scripted / CI runs,
            and prefer keeping your existing editor.
          </li>
          <li>
            <strong>Pick Cursor</strong> if inline tab-completion and hunk-level accept/reject
            inside the editor matter more than headless automation.
          </li>
          <li>
            <strong>Pick MANOVIK</strong> if data can't leave your perimeter, or you want lifetime
            pricing instead of a subscription or a metered API bill.
          </li>
        </ul>
      </section>
    </main>
  );
}
