import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Check, Server, Lock, Workflow, ShieldCheck } from "lucide-react";

const FAQS = [
  {
    q: "What is an autonomous AI software engineer?",
    a: "An autonomous AI software engineer plans a task, writes and edits files, runs commands and tests, reviews its own output, and iterates until the work is finished. Unlike a chat assistant that only suggests snippets, it operates a real environment end to end and reports what it verified.",
  },
  {
    q: "How is MANOVIK different from Devin?",
    a: "Devin runs only in its vendor cloud on per-seat monthly pricing. MANOVIK AI offers a one-time lifetime plan and sovereign / on-prem deployment, so the agent and your source code stay inside your own perimeter.",
  },
  {
    q: "Can an autonomous agent run without supervision?",
    a: "MANOVIK plans and executes autonomously, but anything that touches a connected machine is queued for your explicit approval first. You keep an audit trail of every proposed and executed action.",
  },
  {
    q: "How does it avoid shipping broken code?",
    a: "MANOVIK FORCE runs several specialist agents on the same objective in parallel, has a hostile reviewer score every draft, then merges the winning work into a single deliverable that must carry machine-checkable proof — tests, commands, or verifiable output.",
  },
  {
    q: "Does it work on an existing codebase?",
    a: "Yes. You can index your own documents and repositories into Knowledge Memory, and the agent retrieves the relevant context semantically before it plans, so its edits follow your existing conventions rather than generic defaults.",
  },
  {
    q: "What does it cost?",
    a: "A one-time lifetime plan plus optional credits, instead of a recurring per-seat subscription. Self-hosting is available for teams that must keep everything on their own infrastructure.",
  },
];

const TITLE = "Autonomous AI Software Engineer | MANOVIK";
const DESCRIPTION =
  "MANOVIK is an autonomous AI software engineer: it plans, writes, runs and verifies code end to end — with lifetime pricing, sovereign self-hosting, and approval-gated actions.";
const URL = "https://manovik.in/autonomous-ai-software-engineer";

export const Route = createFileRoute("/autonomous-ai-software-engineer")({
  component: AutonomousEngineerPage,
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: "Autonomous AI Software Engineer — MANOVIK" },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: URL },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Autonomous AI Software Engineer — MANOVIK" },
      { name: "twitter:description", content: DESCRIPTION },
    ],
    links: [{ rel: "canonical", href: URL }],
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

function AutonomousEngineerPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/40">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" aria-hidden /> Back to home
          </Link>
          <Link to="/login" className="text-sm font-semibold underline">
            Get started
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-12 px-4 py-12">
        <section className="space-y-4">
          <p className="text-sm uppercase tracking-wider text-muted-foreground">
            Autonomous AI Software Engineer
          </p>
          <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
            An autonomous AI software engineer that runs inside your perimeter
          </h1>
          <p className="text-lg text-muted-foreground">
            MANOVIK takes an objective, plans the work, writes the code, runs it, reviews itself and
            reports proof of what it verified — without your source code leaving infrastructure you
            control, and without a per-seat subscription.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link
              to="/login"
              className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
            >
              Start free
            </Link>
            <Link to="/vs-devin" className="rounded-lg border border-border px-5 py-2.5 text-sm font-semibold">
              Compare with Devin →
            </Link>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">How the agent works, step by step</h2>
          <ol className="space-y-3 text-muted-foreground">
            <li>
              <span className="font-medium text-foreground">1. Recon.</span> It restates the objective
              as a mission brief with explicit constraints and success criteria before touching code.
            </li>
            <li>
              <span className="font-medium text-foreground">2. Parallel swarm.</span> Specialist agents
              — architect, implementer, test engineer, security auditor — attack the same objective at
              once instead of a single linear pass.
            </li>
            <li>
              <span className="font-medium text-foreground">3. Adversarial review.</span> A hostile
              reviewer scores every draft and names its failure modes.
            </li>
            <li>
              <span className="font-medium text-foreground">4. Proof-carrying delivery.</span> The
              merged deliverable ships with the checks that back it, and every phase is snapshotted so
              you can rewind and fork any decision.
            </li>
          </ol>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          {[
            {
              icon: Server,
              title: "Sovereign deployment",
              body: "Run the agent on your own infrastructure. Prompts and source stay inside your perimeter — not a vendor cloud.",
            },
            {
              icon: Lock,
              title: "Lifetime pricing",
              body: "A one-time plan plus optional credits, instead of paying per autonomous seat every month.",
            },
            {
              icon: Workflow,
              title: "Executes, not just suggests",
              body: "Plans, edits files, runs builds and tests, reads the failures, and fixes them until the objective is met.",
            },
            {
              icon: ShieldCheck,
              title: "Approval-gated actions",
              body: "Anything that reaches a connected machine is queued for your explicit approval, with a full audit trail.",
            },
          ].map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-xl border border-border/60 bg-card/40 p-5">
              <Icon className="h-5 w-5 text-primary" aria-hidden />
              <div className="mt-3 font-semibold">{title}</div>
              <p className="mt-1 text-sm text-muted-foreground">{body}</p>
            </div>
          ))}
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">Why teams pick a sovereign autonomous engineer</h2>
          <ul className="space-y-2">
            <li className="flex gap-2">
              <Check className="h-5 w-5 shrink-0 text-primary" aria-hidden /> Proprietary code never
              leaves infrastructure you control.
            </li>
            <li className="flex gap-2">
              <Check className="h-5 w-5 shrink-0 text-primary" aria-hidden /> One-time cost instead of
              a recurring per-seat autonomy tax.
            </li>
            <li className="flex gap-2">
              <Check className="h-5 w-5 shrink-0 text-primary" aria-hidden /> Knowledge Memory indexes
              your own docs so plans follow your conventions.
            </li>
            <li className="flex gap-2">
              <Check className="h-5 w-5 shrink-0 text-primary" aria-hidden /> Scheduled agents run
              recurring missions unattended and keep their run history.
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
          <div className="font-semibold">Put an autonomous engineer on your next task</div>
          <p className="mt-1 text-sm text-muted-foreground">
            Start on the free tier, or take the lifetime plan and self-host.{" "}
            <Link to="/best-ai-coding-agent" className="underline">
              See how it compares →
            </Link>
          </p>
        </section>
      </main>
    </div>
  );
}
