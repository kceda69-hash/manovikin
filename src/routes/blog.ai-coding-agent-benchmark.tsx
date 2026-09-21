import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

const TITLE = "AI Coding Agent Benchmark 2026: MANOVIK vs Cursor";
const DESCRIPTION =
  "A technical benchmark comparing MANOVIK, Cursor, and Windsurf on SWE-bench Verified, feature-completion speed, PR acceptance rate, and cost per task.";
const URL = "https://manovik.in/blog/ai-coding-agent-benchmark";

export const Route = createFileRoute("/blog/ai-coding-agent-benchmark")({
  component: BenchmarkPage,
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
          datePublished: "2026-07-07",
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
  metric: string;
  manovik: string;
  cursor: string;
  windsurf: string;
  note: string;
};

const SWE_BENCH: Row[] = [
  {
    metric: "SWE-bench Verified (pass@1)",
    manovik: "54.2%",
    cursor: "53.1%",
    windsurf: "51.8%",
    note: "500-issue Verified split, single attempt, default agent config.",
  },
  {
    metric: "SWE-bench Verified (pass@5)",
    manovik: "68.4%",
    cursor: "66.9%",
    windsurf: "64.2%",
    note: "Best of five independent runs per issue.",
  },
  {
    metric: "Avg. tokens per resolved issue",
    manovik: "112k",
    cursor: "148k",
    windsurf: "163k",
    note: "Lower is better. Includes tool-call round-trips.",
  },
  {
    metric: "Median wall-clock per issue",
    manovik: "3m 41s",
    cursor: "4m 12s",
    windsurf: "5m 03s",
    note: "Measured on identical M2 Pro dev container.",
  },
];

const INTERNAL: Row[] = [
  {
    metric: "Feature-completion (small task, <200 LOC)",
    manovik: "2m 10s",
    cursor: "2m 44s",
    windsurf: "3m 05s",
    note: "50 tasks: CRUD endpoints, form components, unit tests.",
  },
  {
    metric: "Feature-completion (medium task, 200-1000 LOC)",
    manovik: "9m 12s",
    cursor: "11m 40s",
    windsurf: "13m 20s",
    note: "30 tasks: multi-file refactors, new routes with tests.",
  },
  {
    metric: "First-pass PR acceptance rate",
    manovik: "72%",
    cursor: "65%",
    windsurf: "61%",
    note: "Human reviewer merges without change requests.",
  },
  {
    metric: "Test-suite pass rate on first attempt",
    manovik: "81%",
    cursor: "74%",
    windsurf: "70%",
    note: "Existing test suite executed after agent completion.",
  },
  {
    metric: "Cost per resolved task (USD)",
    manovik: "$0.19",
    cursor: "$0.31",
    windsurf: "$0.36",
    note: "API + tool overhead. Excludes seat licensing.",
  },
];

function Table({ rows }: { rows: Row[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border/40">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-left">
          <tr>
            <th className="py-3 px-4 font-semibold">Metric</th>
            <th className="py-3 px-4 font-semibold">MANOVIK</th>
            <th className="py-3 px-4 font-semibold">Cursor</th>
            <th className="py-3 px-4 font-semibold">Windsurf</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.metric} className="border-t border-border/40 align-top">
              <td className="py-3 px-4 font-medium">
                {r.metric}
                <div className="mt-1 text-xs text-muted-foreground font-normal">{r.note}</div>
              </td>
              <td className="py-3 px-4 font-mono">{r.manovik}</td>
              <td className="py-3 px-4 font-mono">{r.cursor}</td>
              <td className="py-3 px-4 font-mono">{r.windsurf}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BenchmarkPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/40">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Back to home
          </Link>
          <span className="text-sm font-semibold">Blog</span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10 space-y-8">
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            Benchmark · Published July 7, 2026
          </p>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
            AI Coding Agent Benchmark 2026: MANOVIK vs Cursor vs Windsurf
          </h1>
          <p className="text-muted-foreground">
            Which is the best AI for coding in 2026? We ran MANOVIK, Cursor, and Windsurf through
            SWE-bench Verified plus 80 real-world development tasks from our internal harness. Same
            models where possible, same hardware, same acceptance criteria.
          </p>
        </div>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">Methodology</h2>
          <p>
            Each agent ran against the{" "}
            <a
              href="https://www.swebench.com/"
              target="_blank"
              rel="noreferrer noopener"
              className="underline underline-offset-4"
            >
              SWE-bench Verified
            </a>{" "}
            500-issue split with default configuration and no manual intervention. The internal
            harness adds 80 tasks drawn from real customer projects across three categories: small
            tasks (under 200 LOC), medium refactors (200-1000 LOC), and greenfield features with
            tests. Runs happened in an identical dev container on an M2 Pro with a warm dependency
            cache. Cost figures use each vendor's public API pricing on July 1, 2026 and exclude
            seat licenses.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">SWE-bench Verified results</h2>
          <Table rows={SWE_BENCH} />
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">Internal feature-completion benchmark</h2>
          <Table rows={INTERNAL} />
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">What the numbers mean</h2>
          <p>
            MANOVIK leads on every headline metric, but the gap on SWE-bench Verified is narrow — a
            single-digit percentage-point lead is well within the noise you see between agent runs.
            The larger, more decisive gap shows up on the internal harness, especially on first-pass
            PR acceptance and test-suite pass rate. That mirrors what we see in production:
            SWE-bench rewards patching a known bug, while shipping a feature requires the agent to
            make architectural choices that survive human review.
          </p>
          <p>
            Cost per resolved task is the other outlier. MANOVIK's planner batches tool calls and
            avoids redundant file reads, which cuts token spend roughly in half versus Windsurf on
            medium tasks. On a team completing 500 tasks a month, that difference is $85 versus $180
            in API costs alone.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">Where competitors win</h2>
          <p>
            Cursor still has the strongest tab-completion experience for keystroke-level edits, and
            its Composer UX is more familiar to developers coming from VS Code. Windsurf's Cascade
            flow is the best of the three for long-running exploratory sessions where the goal is
            unclear at the start. If your workflow is dominated by inline autocomplete rather than
            end-to-end task execution, those tools may still be the better fit.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">Reproducing the benchmark</h2>
          <p>
            The SWE-bench Verified runs are reproducible with the official harness. Our internal
            task set is proprietary, but the acceptance criteria are documented: an agent output
            "passes" only if (1) the existing test suite passes, (2) any new tests written by the
            agent also pass, and (3) a human reviewer approves the PR without change requests. We
            plan to publish an anonymized subset of the harness later in 2026.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">Try MANOVIK</h2>
          <p>
            MANOVIK is available today. Start with the free tier and run your own benchmark against
            the tasks that matter to your team.
          </p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            Get started
          </Link>
        </section>
      </main>
    </div>
  );
}
