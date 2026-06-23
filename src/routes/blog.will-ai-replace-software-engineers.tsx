import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Check } from "lucide-react";

export const Route = createFileRoute("/blog/will-ai-replace-software-engineers")({
  component: WillAiReplaceEngineersPage,
  head: () => ({
    meta: [
      { title: "Will AI Replace Software Engineers? An Honest 2026 Take" },
      {
        name: "description",
        content:
          "Will AI replace software engineers? A balanced 2026 take on what autonomous agents like MANOVIK AI automate — and where engineers stay essential.",
      },
      { property: "og:title", content: "Will AI Replace Software Engineers? An Honest 2026 Take" },
      {
        property: "og:description",
        content:
          "Autonomous AI agents are reshaping software engineering, not erasing it. Here's what changes — and what doesn't.",
      },
      { property: "og:type", content: "article" },
      { property: "og:url", content: "https://manovik.in/blog/will-ai-replace-software-engineers" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Will AI Replace Software Engineers? An Honest 2026 Take" },
      {
        name: "twitter:description",
        content:
          "Autonomous AI agents are reshaping software engineering, not erasing it. Here's what changes — and what doesn't.",
      },
    ],
    links: [{ rel: "canonical", href: "https://manovik.in/blog/will-ai-replace-software-engineers" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Article",
          headline: "Will AI Replace Software Engineers? An Honest 2026 Take",
          description:
            "A balanced look at whether AI will replace software engineers, how autonomous AI agents like MANOVIK AI change the job, and what skills stay valuable.",
          author: { "@type": "Organization", name: "MANOVIK AI", url: "https://manovik.in" },
          publisher: { "@type": "Organization", name: "MANOVIK AI", url: "https://manovik.in", logo: { "@type": "ImageObject", url: "https://manovik.in/favicon.ico" } },
          mainEntityOfPage: "https://manovik.in/blog/will-ai-replace-software-engineers",
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: [
            {
              "@type": "Question",
              name: "Will AI replace software engineers?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "No — AI agents are automating large parts of coding, but software engineering is more than typing code. Engineers still own architecture, product judgment, security trade-offs, debugging in production, and accountability. AI shifts the role toward higher-leverage work.",
              },
            },
            {
              "@type": "Question",
              name: "What can autonomous AI coding agents actually do today?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Modern agents like MANOVIK AI can plan multi-step changes, scaffold apps and APIs, write and run tests, fix common bugs, and ship to production end-to-end — all from a natural language prompt.",
              },
            },
            {
              "@type": "Question",
              name: "What stays human in software engineering?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Defining the right problem, making architecture and trade-off decisions, reviewing AI-generated code, owning security and compliance, communicating with stakeholders, and being accountable for production outcomes.",
              },
            },
            {
              "@type": "Question",
              name: "How should engineers work with AI agents?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Treat the agent as a junior engineer who never sleeps. You write the spec, the agent drafts the implementation, you review and steer. Tools like MANOVIK AI sit inside your workflow so the human stays in the loop.",
              },
            },
          ],
        }),
      },
    ],
  }),
});

function WillAiReplaceEngineersPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60 px-4 py-3">
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Back to home
        </Link>
      </header>

      <article className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
          Will AI replace software engineers?
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Short answer: no — but the job is changing fast. Here's an honest, 2026 perspective from a
          team building an autonomous AI coding agent.
        </p>

        <section className="mt-10 space-y-4">
          <h2 className="text-2xl font-semibold">The honest take</h2>
          <p>
            Autonomous AI agents like <strong>MANOVIK AI</strong> can already plan, code, test, and
            ship real software. That's a genuine step-change. But "software engineering" was never
            just typing code — it's understanding ambiguous problems, picking the right trade-offs,
            and being accountable for what runs in production.
          </p>
          <p>
            What's actually happening: routine implementation work is being absorbed by AI agents,
            while judgment, taste, and ownership become more valuable, not less.
          </p>
        </section>

        <section className="mt-10 space-y-4">
          <h2 className="text-2xl font-semibold">What AI agents do well today</h2>
          <ul className="space-y-2">
            {[
              "Scaffolding full-stack apps, APIs, and database schemas from a prompt",
              "Writing tests, fixing flaky ones, and running them in a loop until green",
              "Hunting down common bugs across a repo",
              "Migrations, refactors, and tedious cross-file edits",
              "Shipping end-to-end: code, deploy, and verify in production",
            ].map((line) => (
              <li key={line} className="flex gap-2">
                <Check className="size-5 text-primary shrink-0 mt-0.5" />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-10 space-y-4">
          <h2 className="text-2xl font-semibold">What stays human</h2>
          <ul className="space-y-2">
            {[
              "Defining the right problem to solve in the first place",
              "Architecture and long-horizon trade-offs",
              "Security, privacy, and compliance accountability",
              "Reviewing AI output critically — taste and judgment",
              "Debugging weird production incidents under pressure",
              "Communicating with users, stakeholders, and teammates",
            ].map((line) => (
              <li key={line} className="flex gap-2">
                <Check className="size-5 text-primary shrink-0 mt-0.5" />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-10 space-y-4">
          <h2 className="text-2xl font-semibold">The "AI employee" model</h2>
          <p>
            We think of MANOVIK as an <em>AI employee</em> — a tireless junior engineer who picks up
            tickets, drafts code, and ships PRs while you focus on the harder calls. You stay the
            architect; the agent does the heavy lifting.
          </p>
          <p>
            That's a much better story than "AI replaces engineers". One engineer plus a capable
            agent can now ship what used to take a small team — which is why demand for engineers
            who can <em>direct</em> AI well is growing, not shrinking.
          </p>
        </section>

        <section className="mt-10 space-y-4">
          <h2 className="text-2xl font-semibold">How to stay ahead</h2>
          <ol className="list-decimal pl-6 space-y-2">
            <li>Get fluent with at least one autonomous agent — use it on real work, daily.</li>
            <li>Invest in system design, security, and product judgment. Those compound.</li>
            <li>Own outcomes, not just tickets. Agents handle tickets; humans own outcomes.</li>
            <li>Learn to read and review AI-generated code quickly and skeptically.</li>
          </ol>
        </section>

        <section className="mt-12 rounded-2xl border border-border/60 bg-card/40 p-6 text-center">
          <h2 className="text-2xl font-semibold">Try an AI employee for yourself</h2>
          <p className="mt-2 text-muted-foreground">
            MANOVIK AI is an autonomous coding agent that builds apps, APIs, and automations
            end-to-end. Free to start, lifetime self-host available.
          </p>
          <div className="mt-4 flex gap-3 justify-center">
            <Link
              to="/login"
              className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              Launch MANOVIK AI
            </Link>
            <Link
              to="/blog/best-ai-coding-agents"
              className="inline-flex items-center rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-card/60"
            >
              Compare agents
            </Link>
          </div>
        </section>
      </article>
    </main>
  );
}
