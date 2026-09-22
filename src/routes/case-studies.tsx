import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight } from "lucide-react";

import forceMissionShot from "@/assets/case-force-mission.jpg";
import fullstackShot from "@/assets/case-fullstack-build.jpg";
import seoMonitorShot from "@/assets/case-seo-monitor.jpg";

const TITLE = "AI Agent Case Studies — Real MANOVIK Missions";
const DESCRIPTION =
  "Three real missions run on MANOVIK: a parallel agent swarm, a full-stack app build, and automated SEO monitoring — with interface walkthroughs and what each one shipped.";
const URL = "https://manovik.in/case-studies";

type CaseStudy = {
  id: string;
  eyebrow: string;
  title: string;
  brief: string;
  image: string;
  alt: string;
  shipped: string[];
  outcome: string;
  href: "/force" | "/ai-website-builder" | "/seo";
  hrefLabel: string;
};

const CASES: CaseStudy[] = [
  {
    id: "force-swarm",
    eyebrow: "Mission 01 · Parallel agents",
    title: "Running four specialist agents on one brief with MANOVIK FORCE",
    brief:
      "A single brief is expanded into a recon pass, then four specialist agents work the problem in parallel, cross-review each other's output, and a synthesis pass merges the surviving work into one answer.",
    image: forceMissionShot,
    alt: "MANOVIK FORCE mission dashboard showing recon, swarm, adversary and synthesis agents with progress and a mission score",
    shipped: [
      "Four-phase pipeline: recon → swarm → adversary → synthesis",
      "Every agent output stored with its critique and score, so the reasoning is auditable after the fact",
      "Missions, agents and steps persisted per owner with row-level security",
    ],
    outcome:
      "Runs finish with a scored, proof-carrying result instead of a single unchecked answer — the adversary phase rejects work before it reaches you.",
    href: "/force",
    hrefLabel: "See MANOVIK FORCE",
  },
  {
    id: "fullstack-build",
    eyebrow: "Mission 02 · Full-stack build",
    title: "From one prompt to a working storefront — schema, API and UI",
    brief:
      "A plain-language brief for a storefront: product grid, cart, checkout. MANOVIK writes the database schema and access rules first, then the validated server handlers, then the interface on top of them.",
    image: fullstackShot,
    alt: "MANOVIK coding workspace with chat on the left, TypeScript code in the centre and a live storefront preview on the right",
    shipped: [
      "SQL migration with tables, grants and row-level security written before any UI",
      "Typed server functions with schema validation on every input",
      "Real React and TypeScript you can export or self-host — no proprietary page format",
    ],
    outcome:
      "The build arrives as a running app with a live preview, not a mockup: signup, dashboards and payment flows work because the backend was generated alongside the pages.",
    href: "/ai-website-builder",
    hrefLabel: "Build a site this way",
  },
  {
    id: "seo-monitor",
    eyebrow: "Mission 03 · Autonomous operations",
    title: "A scheduled agent watching crawl and indexing health every day",
    brief:
      "MANOVIK was pointed at its own site and asked to keep watch. It built the snapshot tables, the daily job, the alerting rules and the dashboard that reads them.",
    image: seoMonitorShot,
    alt: "SEO monitoring dashboard with an impressions and clicks chart, indexed-page tiles and a list of crawl issues by severity",
    shipped: [
      "Daily snapshot job storing impressions, clicks and indexing state over time",
      "Alerts raised when crawl errors climb or indexed pages drop",
      "An operator dashboard that reads the cached snapshot instead of hammering the API",
    ],
    outcome:
      "Regressions surface as a dated alert the morning after they happen, rather than weeks later when traffic has already fallen.",
    href: "/seo",
    hrefLabel: "See the monitoring view",
  },
];

export const Route = createFileRoute("/case-studies")({
  component: CaseStudiesPage,
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: "Real MANOVIK Missions & Case Studies" },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "article" },
      { property: "og:url", content: URL },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Real MANOVIK Missions & Case Studies" },
      { name: "twitter:description", content: DESCRIPTION },
    ],
    links: [{ rel: "canonical", href: URL }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: "MANOVIK missions and case studies",
          itemListElement: CASES.map((c, i) => ({
            "@type": "ListItem",
            position: i + 1,
            name: c.title,
            description: c.outcome,
            url: `${URL}#${c.id}`,
          })),
        }),
      },
    ],
  }),
});

function CaseStudiesPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/40">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden /> Back to home
          </Link>
          <Link to="/login" className="text-sm font-semibold underline">
            Create a free account
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-14 px-4 py-12">
        <section className="space-y-4">
          <p className="text-sm uppercase tracking-wider text-muted-foreground">
            Missions &amp; case studies
          </p>
          <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
            Real missions MANOVIK has run, and what they shipped
          </h1>
          <p className="max-w-2xl text-lg text-muted-foreground">
            These are features of this product, built by MANOVIK itself — a parallel agent swarm, a
            full-stack app build, and a scheduled agent that monitors search health. The
            walkthroughs below show the interfaces and the concrete output of each run.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link
              to="/login"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
            >
              Start your first mission free <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            <Link
              to="/best-ai-coding-agent"
              className="rounded-lg border border-border px-5 py-2.5 text-sm font-semibold"
            >
              Compare with other AI agents
            </Link>
          </div>
        </section>

        {CASES.map((c) => (
          <article key={c.id} id={c.id} className="scroll-mt-8 space-y-5">
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-wider text-primary">{c.eyebrow}</p>
              <h2 className="text-2xl font-semibold md:text-3xl">{c.title}</h2>
              <p className="max-w-3xl text-muted-foreground">{c.brief}</p>
            </div>

            <img
              src={c.image}
              alt={c.alt}
              loading="lazy"
              width={1280}
              height={800}
              className="w-full rounded-xl border border-border/60"
            />

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-border/60 bg-card/40 p-5">
                <div className="font-semibold">What it shipped</div>
                <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
                  {c.shipped.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </div>
              <div className="rounded-xl border border-border/60 bg-card/40 p-5">
                <div className="font-semibold">Outcome</div>
                <p className="mt-2 text-sm text-muted-foreground">{c.outcome}</p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <Link to={c.href} className="text-sm font-semibold underline">
                    {c.hrefLabel} →
                  </Link>
                  <Link to="/login" className="text-sm font-semibold underline">
                    Run this yourself →
                  </Link>
                </div>
              </div>
            </div>
          </article>
        ))}

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">How a mission works, end to end</h2>
          <ol className="list-decimal space-y-2 pl-5 text-muted-foreground">
            <li>
              Write the brief in plain language — what you want, who it is for, what
              &quot;done&quot; looks like.
            </li>
            <li>
              MANOVIK runs recon, then splits the work across specialist agents working in parallel.
            </li>
            <li>
              An adversary pass reviews and scores each agent&apos;s output and discards weak work.
            </li>
            <li>
              Synthesis merges what survived into one deliverable with its reasoning attached.
            </li>
            <li>
              You keep iterating in chat, and you keep the code — including on your own server with
              the lifetime plan.
            </li>
          </ol>
        </section>

        <section className="rounded-xl border border-border/60 bg-card/40 p-6">
          <h2 className="text-xl font-semibold">Run your own mission</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Free to start, no card needed. Pro is ₹699 one-time and the one-time ₹4999 lifetime plan
            includes self-hosting.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              to="/login"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
            >
              Sign up free <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            <Link
              to="/how-to-make-a-website-with-ai"
              className="rounded-lg border border-border px-5 py-2.5 text-sm font-semibold"
            >
              Read the step-by-step guide
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
