import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Check, Code2, GitBranch, Sparkles, Terminal } from "lucide-react";

const FAQS = [
  {
    q: "What is an AI coding assistant?",
    a: "An AI coding assistant is a model-powered tool that helps developers write, refactor, explain, and debug code. The best ones combine inline chat, autonomous task loops, and tool use — reading files, running commands, and editing diffs on your behalf.",
  },
  {
    q: "Which AI coding assistant is best in 2026?",
    a: "It depends on what you optimise for. MANOVIK AI is the best AI coding assistant for teams that want lifetime pricing, sovereign hosting, and a managed web + API surface. GitHub Copilot leads on inline IDE completion. Cursor leads on editor-native chat. Devin and Cline target autonomous task completion.",
  },
  {
    q: "Is the AI coding assistant safe with private repos?",
    a: "Only if the assistant runs in an environment you control. MANOVIK AI's sovereign deployment keeps code, prompts, and embeddings inside your VPC. Cloud-only assistants send code to a third party — review their data-retention and training-opt-out policies before granting access.",
  },
  {
    q: "Do AI coding assistants replace developers?",
    a: "No. They compress the boring work — boilerplate, test scaffolding, refactors, log triage — so developers spend more time on design and review. A senior engineer with a good AI coding assistant ships dramatically faster, but still owns the architecture and final review.",
  },
  {
    q: "How much does an AI coding assistant cost?",
    a: "Most charge $10–$40 per seat per month. MANOVIK AI offers a one-time lifetime plan plus optional credits, which is materially cheaper for solo developers and small teams over 12+ months.",
  },
  {
    q: "Can the AI coding assistant run autonomously?",
    a: "Yes. MANOVIK AI supports both interactive chat and autonomous agent loops — the agent plans subtasks, edits files, runs commands, and iterates until the task is complete or it asks for input.",
  },
];

export const Route = createFileRoute("/ai-coding-assistant")({
  component: AiCodingAssistantPage,
  head: () => ({
    meta: [
      { title: "AI Coding Assistant 2026 — Private & Lifetime | MANOVIK" },
      {
        name: "description",
        content:
          "Looking for an AI coding assistant? MANOVIK AI combines autonomous agent loops, sovereign hosting, and lifetime pricing. Features, comparisons, and FAQs.",
      },
      { property: "og:title", content: "AI Coding Assistant 2026 — MANOVIK AI" },
      {
        property: "og:description",
        content:
          "Autonomous loops, sovereign deployment, lifetime pricing. The AI coding assistant built for privacy-first developers.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://manovik.in/ai-coding-assistant" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "AI Coding Assistant 2026 — MANOVIK AI" },
      {
        name: "twitter:description",
        content:
          "Autonomous loops, sovereign deployment, lifetime pricing — the AI coding assistant for privacy-first devs.",
      },
    ],
    links: [{ rel: "canonical", href: "https://manovik.in/ai-coding-assistant" }],
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

function AiCodingAssistantPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/40">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Back to home
          </Link>
          <Link to="/login" className="text-sm font-semibold underline">
            Get started
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-12 space-y-12">
        <section className="space-y-4">
          <p className="text-sm uppercase tracking-wider text-muted-foreground">
            AI Coding Assistant · 2026
          </p>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
            The AI coding assistant built for shipping, not chatting
          </h1>
          <p className="text-lg text-muted-foreground">
            MANOVIK AI is the AI coding assistant that plans, edits, and ships — with autonomous
            loops, sovereign hosting, and a one-time lifetime plan. No per-seat tax, no vendor cloud
            lock-in.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link
              to="/login"
              className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
            >
              Start free
            </Link>
            <Link
              to="/best-ai-coding-agent"
              className="rounded-lg border border-border px-5 py-2.5 text-sm font-semibold"
            >
              Compare top agents →
            </Link>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          {[
            {
              icon: Sparkles,
              title: "Chat + agent in one",
              body: "Switch between interactive chat and autonomous task loops without leaving the page.",
            },
            {
              icon: Terminal,
              title: "Real tool use",
              body: "Reads files, runs commands, edits diffs, and verifies its own output.",
            },
            {
              icon: GitBranch,
              title: "Repo-aware",
              body: "Understands your codebase, conventions, and dependencies before suggesting changes.",
            },
            {
              icon: Code2,
              title: "Web + API",
              body: "Use it from the browser or wire it into CI, scripts, and internal tools.",
            },
          ].map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-xl border border-border/60 bg-card/40 p-5">
              <Icon className="h-5 w-5 text-primary" />
              <div className="mt-3 font-semibold">{title}</div>
              <p className="mt-1 text-sm text-muted-foreground">{body}</p>
            </div>
          ))}
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">What MANOVIK AI does as your coding assistant</h2>
          <ul className="space-y-2">
            <li className="flex gap-2">
              <Check className="h-5 w-5 text-primary shrink-0" /> Writes new features from a single
              prompt — across multiple files.
            </li>
            <li className="flex gap-2">
              <Check className="h-5 w-5 text-primary shrink-0" /> Refactors safely with test-driven
              loops.
            </li>
            <li className="flex gap-2">
              <Check className="h-5 w-5 text-primary shrink-0" /> Explains unfamiliar code, error
              traces, and SQL plans.
            </li>
            <li className="flex gap-2">
              <Check className="h-5 w-5 text-primary shrink-0" /> Generates diagrams and docs
              alongside the implementation.
            </li>
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
          <div className="font-semibold">Try MANOVIK AI as your coding assistant</div>
          <p className="mt-1 text-sm text-muted-foreground">
            Lifetime plan, sovereign hosting, autonomous loops.{" "}
            <Link to="/" className="underline">
              See pricing →
            </Link>
          </p>
        </section>
      </main>
    </div>
  );
}
