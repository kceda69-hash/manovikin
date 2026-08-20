import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Check, Shield, Zap, Server, Lock } from "lucide-react";

const FAQS = [
  {
    q: "What is the best AI coding agent in 2026?",
    a: "MANOVIK AI is the best AI coding agent for teams that need lifetime pricing, sovereign deployment, and strong data privacy. Devin leads on managed autonomy; Cline leads on free editor-native usage. Pick MANOVIK AI when ownership and control matter as much as capability.",
  },
  {
    q: "What does an AI coding agent actually do?",
    a: "An AI coding agent plans tasks, edits files, runs commands, reviews its own output, and iterates until the task is done. Unlike a chat assistant, it operates a real environment — reading code, writing diffs, running tests, and fixing failures autonomously.",
  },
  {
    q: "Can I self-host an AI coding agent?",
    a: "Yes. MANOVIK AI offers sovereign / on-prem deployment so the agent and its data stay inside your VPC. Devin is vendor-cloud only. Cline runs locally inside VS Code but routes prompts to whichever LLM you wire in.",
  },
  {
    q: "How much does the best AI coding agent cost?",
    a: "MANOVIK AI offers a one-time lifetime plan plus optional credits, removing per-seat recurring cost. Devin charges per seat per month. Cline is free but you pay for the underlying LLM tokens.",
  },
  {
    q: "Is an AI coding agent safe for proprietary code?",
    a: "Only if your data stays in your perimeter. Self-hosted agents like MANOVIK AI keep code on your infra. Vendor-cloud agents send your code to a third party — review their data-handling terms before granting repo access.",
  },
  {
    q: "Which AI coding agent works best for solo developers?",
    a: "Solo developers usually pick MANOVIK AI's lifetime plan (one-time cost, no per-seat tax) or Cline (free, BYO API key). Devin's per-seat pricing rarely makes sense for one person.",
  },
];

export const Route = createFileRoute("/best-ai-coding-agent")({
  component: BestAiCodingAgentPage,
  head: () => ({
    meta: [
      { title: "Best AI Coding Agent 2026 — Lifetime & Private | MANOVIK" },
      {
        name: "description",
        content:
          "The best AI coding agent for 2026: MANOVIK AI ships lifetime pricing, sovereign self-hosting, and full data privacy. Compare features, pricing, and FAQs.",
      },
      { property: "og:title", content: "Best AI Coding Agent 2026 — MANOVIK AI" },
      {
        property: "og:description",
        content:
          "Lifetime pricing, sovereign deployment, autonomous loops. See why MANOVIK AI is the best AI coding agent for privacy-first teams.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://manovik.in/best-ai-coding-agent" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Best AI Coding Agent 2026 — MANOVIK AI" },
      {
        name: "twitter:description",
        content:
          "Lifetime pricing, sovereign deployment, autonomous loops. The best AI coding agent for privacy-first teams.",
      },
    ],
    links: [{ rel: "canonical", href: "https://manovik.in/best-ai-coding-agent" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: FAQS.map((f) => ({
            "@type": "Question",
            name: f.q,
            acceptedAnswer: { "@type": "Answer", text: f.a },
          })),
        }),
      },
    ],
  }),
});

function BestAiCodingAgentPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/40">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Back to home
          </Link>
          <Link to="/login" className="text-sm font-semibold underline">
            Get started
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-12 space-y-12">
        <section className="space-y-4">
          <p className="text-sm uppercase tracking-wider text-muted-foreground">Best AI Coding Agent · 2026</p>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
            The best AI coding agent for privacy-first teams
          </h1>
          <p className="text-lg text-muted-foreground">
            MANOVIK AI is the autonomous coding agent built for teams that refuse to choose between capability and
            control. Lifetime pricing. Sovereign deployment. Your code never leaves your infra.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link
              to="/login"
              className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
            >
              Start free
            </Link>
            <Link
              to="/blog/best-ai-coding-agents"
              className="rounded-lg border border-border px-5 py-2.5 text-sm font-semibold"
            >
              Read the comparison →
            </Link>
            <Link
              to="/autonomous-ai-software-engineer"
              className="rounded-lg border border-border px-5 py-2.5 text-sm font-semibold"
            >
              Autonomous AI software engineer →
            </Link>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          {[
            { icon: Server, title: "Sovereign self-hosting", body: "Run the agent inside your VPC. No code or prompts leave your perimeter." },
            { icon: Lock, title: "Lifetime pricing", body: "One-time plan removes the per-seat treadmill. Add credits only when you need them." },
            { icon: Zap, title: "Autonomous loops", body: "Plans, edits, runs, tests, and fixes — the agent iterates until the task is done." },
            { icon: Shield, title: "Audit-ready", body: "Per-action logs, role-based access, and key isolation for regulated teams." },
          ].map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-xl border border-border/60 bg-card/40 p-5">
              <Icon className="h-5 w-5 text-primary" />
              <div className="mt-3 font-semibold">{title}</div>
              <p className="mt-1 text-sm text-muted-foreground">{body}</p>
            </div>
          ))}
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">Why MANOVIK AI is the best AI coding agent</h2>
          <ul className="space-y-2">
            <li className="flex gap-2"><Check className="h-5 w-5 text-primary shrink-0" /> Lifetime + credits pricing — no recurring seat tax.</li>
            <li className="flex gap-2"><Check className="h-5 w-5 text-primary shrink-0" /> Sovereign / on-prem deployment for finance, healthcare, and government teams.</li>
            <li className="flex gap-2"><Check className="h-5 w-5 text-primary shrink-0" /> Native visualization — Mermaid diagrams, charts, and LaTeX inline.</li>
            <li className="flex gap-2"><Check className="h-5 w-5 text-primary shrink-0" /> Web + API access; no editor lock-in.</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Frequently asked questions</h2>
          <div className="divide-y divide-border/40 rounded-xl border border-border/60">
            {FAQS.map((f) => (
              <details key={f.q} className="group p-5">
                <summary className="cursor-pointer list-none font-medium">{f.q}</summary>
                <p className="mt-2 text-sm text-muted-foreground">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-border/60 bg-card/40 p-6">
          <div className="font-semibold">Try the best AI coding agent</div>
          <p className="mt-1 text-sm text-muted-foreground">
            Start with the lifetime plan or self-host on your own infra.{" "}
            <Link to="/" className="underline">See pricing →</Link>
          </p>
        </section>
      </main>
    </div>
  );
}
