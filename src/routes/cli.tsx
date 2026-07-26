import { createFileRoute, Link } from "@tanstack/react-router";
import { Terminal, Download, Workflow, Server, KeyRound, ArrowRight } from "lucide-react";

const URL = "https://manovik.in/cli";
const TITLE = "MANOVIK CLI — AI Coding Agent in Your Terminal";
const DESC =
  "Install the MANOVIK CLI and build, ship, and automate from the terminal. Full command reference for build, api, ship, automate, and self-hosted BYOK setups.";

export const Route = createFileRoute("/cli")({
  component: CliPage,
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "article" },
      { property: "og:url", content: URL },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: URL }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "MANOVIK CLI",
          applicationCategory: "DeveloperApplication",
          operatingSystem: "macOS, Linux, Windows",
          description: DESC,
          url: URL,
          offers: { "@type": "Offer", price: "0", priceCurrency: "INR" },
        }),
      },
    ],
  }),
});

type Cmd = {
  cmd: string;
  what: string;
  example: string;
};

const COMMANDS: Cmd[] = [
  {
    cmd: "manovik build",
    what: "Run an autonomous build in the current directory. Streams the plan, then the diffs, then the test run.",
    example: `manovik build "add Razorpay checkout with webhook verification"`,
  },
  {
    cmd: "manovik plan",
    what: "Plan only — extracts requirements and prints an actionable change plan without touching files.",
    example: `manovik plan "migrate auth to passkeys" --json > plan.json`,
  },
  {
    cmd: "manovik reverse",
    what: "Reverse-Engineer brain: maps architecture, risks, and a change plan for an existing repo or URL.",
    example: `manovik reverse https://github.com/sindresorhus/ky`,
  },
  {
    cmd: "manovik clone",
    what: "Clone-Exactly brain: reimplements a described feature in your stack and emits parity tests.",
    example: `manovik clone ./spec.md --target web --verify`,
  },
  {
    cmd: "manovik api",
    what: "Scaffold or call server endpoints. Generates typed routes, validation, and RLS-aware queries.",
    example: `manovik api new orders --auth --crud`,
  },
  {
    cmd: "manovik ship",
    what: "One-click ship pipeline. Produces store artifacts and pushes a staged rollout.",
    example: `manovik ship --target ios,android,web --staged 10`,
  },
  {
    cmd: "manovik automate",
    what: "Register a recurring agent job (cron or webhook triggered) that runs a prompt against your repo.",
    example: `manovik automate add nightly-audit --cron "0 3 * * *" --prompt "audit deps and open a PR"`,
  },
  {
    cmd: "manovik run",
    what: "Execute the project or a single file inside the sandbox and stream stdout/stderr back.",
    example: `manovik run src/scripts/seed.ts`,
  },
  {
    cmd: "manovik auth",
    what: "Sign in, switch workspaces, or attach your own model keys (BYOK).",
    example: `manovik auth login && manovik auth key set OPENAI_API_KEY`,
  },
  {
    cmd: "manovik serve",
    what: "Run MANOVIK sovereign — your infra, your database, any OpenAI-compatible model.",
    example: `manovik serve --model ollama/qwen3-coder --port 7331`,
  },
];

const USE_CASES = [
  {
    icon: Workflow,
    title: "CI that fixes itself",
    body: "Add `manovik build --non-interactive` to a GitHub Action so failing tests get a patch PR instead of a red badge.",
    code: `- run: npx manovik build "fix failing tests" --non-interactive --open-pr`,
  },
  {
    icon: Server,
    title: "Sovereign / air-gapped",
    body: "Point the CLI at a local model and keep every token inside your network. No data leaves your VPC.",
    code: `manovik serve --model ollama/qwen3-coder\nmanovik build "add audit log" --endpoint http://localhost:7331`,
  },
  {
    icon: KeyRound,
    title: "Bring your own keys",
    body: "Use your own provider billing while keeping MANOVIK's agent loop, sandbox, and skill packs.",
    code: `manovik auth key set ANTHROPIC_API_KEY\nmanovik build --model claude-fable-5`,
  },
];

function CliPage() {
  return (
    <main className="mx-auto w-full max-w-4xl px-5 py-16">
      <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/40 px-3 py-1 text-xs text-muted-foreground">
        <Terminal className="h-3.5 w-3.5 text-primary" /> MANOVIK CLI
      </div>

      <h1 className="mt-5 text-3xl font-semibold tracking-tight sm:text-4xl">
        The MANOVIK AI coding agent, in your terminal
      </h1>
      <p className="mt-4 max-w-2xl text-muted-foreground">
        Same agent as the web app — planning, reverse-engineering, sandboxed runs, and store
        shipping — driven from your shell, your CI, or your own infrastructure.
      </p>

      <section className="mt-10" aria-labelledby="install">
        <h2 id="install" className="text-xl font-semibold">
          Install
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Node 20+ required. The CLI authenticates against the same MANOVIK account as the web app.
        </p>
        <pre className="mt-4 overflow-x-auto rounded-xl border border-border/60 bg-card/40 p-4 font-mono text-xs text-foreground">
          <code>{`# npm
npm i -g manovik

# or run without installing
npx manovik build "scaffold a landing page with pricing"

# authenticate once
manovik auth login`}</code>
        </pre>
        <div className="mt-4 flex flex-wrap gap-3 text-sm">
          <Link
            to="/setup"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 px-3 py-2 text-muted-foreground transition hover:text-foreground"
          >
            <Download className="h-3.5 w-3.5" /> Self-host setup wizard
          </Link>
          <Link
            to="/rules/library"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 px-3 py-2 text-muted-foreground transition hover:text-foreground"
          >
            Rules library <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </section>

      <section className="mt-14" aria-labelledby="reference">
        <h2 id="reference" className="text-xl font-semibold">
          Command reference
        </h2>
        <div className="mt-5 space-y-4">
          {COMMANDS.map((c) => (
            <article key={c.cmd} className="rounded-xl border border-border/60 bg-card/30 p-4">
              <h3 className="font-mono text-sm text-primary">{c.cmd}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{c.what}</p>
              <pre className="mt-3 overflow-x-auto rounded-lg bg-background/60 p-3 font-mono text-xs text-foreground">
                <code>{c.example}</code>
              </pre>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-14" aria-labelledby="usecases">
        <h2 id="usecases" className="text-xl font-semibold">
          Use cases
        </h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          {USE_CASES.map((u) => (
            <article key={u.title} className="rounded-xl border border-border/60 bg-card/30 p-4">
              <u.icon className="h-4 w-4 text-primary" />
              <h3 className="mt-2 text-sm font-semibold">{u.title}</h3>
              <p className="mt-1.5 text-xs text-muted-foreground">{u.body}</p>
              <pre className="mt-3 overflow-x-auto rounded-lg bg-background/60 p-2.5 font-mono text-[11px] text-foreground">
                <code>{u.code}</code>
              </pre>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-14 rounded-2xl border border-border/60 bg-card/40 p-6">
        <h2 className="text-lg font-semibold">Prefer a UI?</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Every CLI command maps to the in-app workspace — file tree, diffs, run terminal, and the
          one-click ship pipeline.
        </p>
        <Link
          to="/login"
          className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90"
        >
          Start building <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </section>
    </main>
  );
}
