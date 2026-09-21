import { createFileRoute, Link } from "@tanstack/react-router";

const TITLE = "AGI Roadmap for MANO 1.1 — Milestones and Progress | MANOVIK";
const DESC =
  "An honest, tracked roadmap of MANO 1.1 toward general capability: memory, long-term planning, goal prioritization, self-review, tool use, and self-awareness — with current progress on each.";
const URL = "https://manovik.in/agi-roadmap";

export const Route = createFileRoute("/agi-roadmap")({
  component: RoadmapPage,
  head: () => ({
    links: [{ rel: "canonical", href: URL }],
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "article" },
      { property: "og:url", content: URL },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: TITLE },
      { name: "twitter:description", content: DESC },
    ],
  }),
});

type Milestone = {
  name: string;
  progress: number;
  state: "Shipped" | "Partial" | "Early" | "Not started";
  what: string;
  now: string;
  next: string;
};

const MILESTONES: Milestone[] = [
  {
    name: "Tool use",
    progress: 85,
    state: "Shipped",
    what: "Choosing and running the right tool for a step instead of answering from memory alone.",
    now: "MANO picks its own tool each step from a whitelist: knowledge search, deep sub-reasoning, note-taking, finish.",
    next: "Add code execution and web retrieval as first-class mission tools.",
  },
  {
    name: "Long-term planning",
    progress: 70,
    state: "Partial",
    what: "Breaking a goal into ordered steps and adapting the plan as results come in.",
    now: "Missions run a bounded plan-act-observe loop (up to 8 steps) with a deep plan stage before drafting.",
    next: "Multi-session plans that survive across days and resume where they stopped.",
  },
  {
    name: "Self-review",
    progress: 75,
    state: "Shipped",
    what: "Attacking its own answer before delivering it, and scoring the result against the goal.",
    now: "Every deep run has an adversary pass plus synthesis; missions self-score 0-100 against the goal.",
    next: "Executable checks (tests, builds) as the scoring signal instead of self-judgement.",
  },
  {
    name: "Memory",
    progress: 65,
    state: "Partial",
    what: "Recalling relevant facts and past work rather than starting cold each time.",
    now: "Vector knowledge memory feeds chat and missions; missions store durable lessons per user.",
    next: "Automatic consolidation and forgetting so memory stays sharp as it grows.",
  },
  {
    name: "Self-training",
    progress: 45,
    state: "Early",
    what: "Turning its own past work into rules that change future behaviour.",
    now: "Missions and lessons compile into an operating doctrine that loads back into MANO's context.",
    next: "Score-weighted training and fine-tuned weights served behind the same mano-1.1 ID.",
  },
  {
    name: "Goal prioritization",
    progress: 30,
    state: "Early",
    what: "Deciding what to work on first when several goals compete.",
    now: "Scheduled agents run goals on a timetable; ordering within a mission is model-chosen.",
    next: "A standing goal queue with value, urgency, and cost ranking across missions.",
  },
  {
    name: "Self-awareness (operational)",
    progress: 25,
    state: "Early",
    what: "Knowing its own limits, cost, and confidence — not consciousness.",
    now: "MANO reports depth, domain, substrate, stage timings, and refuses out-of-scope requests.",
    next: "Calibrated confidence and explicit 'I cannot verify this' signals on every claim.",
  },
  {
    name: "Autonomous initiative",
    progress: 10,
    state: "Not started",
    what: "Starting useful work without being asked, safely and within budget.",
    now: "Nothing runs unprompted except schedules the user creates.",
    next: "Opt-in background missions with hard spend caps and an approval log.",
  },
];

const AVERAGE = Math.round(MILESTONES.reduce((s, m) => s + m.progress, 0) / MILESTONES.length);

function RoadmapPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "MANO 1.1 AGI roadmap milestones",
    itemListElement: MILESTONES.map((m, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: m.name,
      description: m.what,
    })),
  };

  return (
    <main className="mx-auto max-w-4xl px-4 py-14">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <h1 className="text-4xl font-semibold tracking-tight">MANO 1.1 AGI roadmap</h1>
      <p className="mt-4 text-lg text-muted-foreground">
        MANO 1.1 is not general intelligence and we will not claim it is. This page tracks the
        capabilities that separate a chat model from a genuinely autonomous agent, and exactly how
        far MANO has come on each one.
      </p>

      <div className="mt-8 rounded-xl border border-border bg-card p-5">
        <p className="text-sm text-muted-foreground">Overall roadmap progress</p>
        <p className="mt-1 text-3xl font-semibold">{AVERAGE}%</p>
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary" style={{ width: `${AVERAGE}%` }} />
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          Averaged across {MILESTONES.length} milestones. Updated as capabilities ship.
        </p>
      </div>

      <section className="mt-10 space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Milestones</h2>
        {MILESTONES.map((m) => (
          <article key={m.name} className="rounded-xl border border-border bg-card p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-lg font-semibold">{m.name}</h3>
              <span className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
                {m.state} · {m.progress}%
              </span>
            </div>
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary" style={{ width: `${m.progress}%` }} />
            </div>
            <p className="mt-3 text-sm text-muted-foreground">{m.what}</p>
            <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="font-medium">Where MANO is</dt>
                <dd className="mt-1 text-muted-foreground">{m.now}</dd>
              </div>
              <div>
                <dt className="font-medium">Next step</dt>
                <dd className="mt-1 text-muted-foreground">{m.next}</dd>
              </div>
            </dl>
          </article>
        ))}
      </section>

      <section className="mt-10 rounded-xl border border-border bg-card p-5">
        <h2 className="text-xl font-semibold">How progress is measured</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          A milestone counts as shipped only when it runs in production for real users, is bounded
          by safety limits, and leaves a record we can inspect. Anything self-reported by a model
          without a stored trace is treated as unproven.
        </p>
        <div className="mt-4 flex flex-wrap gap-3 text-sm">
          <Link to="/case-studies" className="underline">
            See real builds
          </Link>
          <Link to="/" className="underline">
            Start with MANOVIK
          </Link>
        </div>
      </section>
    </main>
  );
}
