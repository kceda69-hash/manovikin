import { createFileRoute, Link } from "@tanstack/react-router";

const TITLE = "MANOVIK System Rules — Guide to .manovikrules Files";
const DESCRIPTION =
  "Define coding standards, architecture patterns, and library preferences with a .manovikrules file — a practical guide to MANOVIK system rules.";
const URL = "https://manovik.in/blog/system-rules";

export const Route = createFileRoute("/blog/system-rules")({
  component: SystemRulesPost,
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      {
        name: "keywords",
        content:
          "manovik rules, .manovikrules, cursor rules alternative, .cursorrules, AI agent rules, project instructions, system prompt, coding standards AI, custom rules",
      },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:url", content: URL },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "MANOVIK System Rules" },
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
          author: { "@type": "Organization", name: "MANOVIK" },
          publisher: { "@type": "Organization", name: "MANOVIK" },
          mainEntityOfPage: URL,
        }),
      },
    ],
  }),
});

function SystemRulesPost() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16 text-foreground">
      <nav className="text-sm text-muted-foreground mb-6">
        <Link to="/" className="hover:underline">Home</Link> / <span>Blog</span> /{" "}
        <span>System rules</span>
      </nav>

      <article className="prose prose-invert max-w-none">
        <h1 className="text-4xl font-bold tracking-tight mb-4">
          MANOVIK System Rules: Steer Your AI Agent with a .manovikrules File
        </h1>
        <p className="text-muted-foreground text-lg mb-8">
          The fastest way to make an autonomous coding agent feel like a senior teammate
          is to hand it your team's playbook. In MANOVIK, that playbook is a
          <code> .manovikrules</code> file — a plain-text list of standards, patterns, and
          preferences the agent reads on every turn. Think of it as the sovereign,
          self-hosted answer to <em>.cursorrules</em>.
        </p>

        <h2>Why rules beat prompting</h2>
        <p>
          You <em>could</em> repeat "use TypeScript strict mode, prefer server functions,
          never import from <code>src/pages</code>" in every prompt. But rules encode the
          intent once, apply it everywhere, and survive context resets. Teams that adopt
          rules see three wins:
        </p>
        <ul>
          <li><strong>Consistency</strong> — every generated file follows the same conventions.</li>
          <li><strong>Efficiency</strong> — no re-explaining architecture on each task.</li>
          <li><strong>Reviewability</strong> — the rules file is version-controlled and diff-able.</li>
        </ul>

        <h2>Creating your first .manovikrules file</h2>
        <p>
          Drop a <code>.manovikrules</code> file at the root of your repository. MANOVIK
          loads it automatically before every agent turn. Keep it short — under 200 lines
          is a good target — and phrase each rule as an imperative.
        </p>
        <pre><code>{`# .manovikrules

## Stack
- TanStack Start + React 19, Tailwind v4, Supabase.
- Prefer server functions (createServerFn) over API routes for app-internal logic.

## Style
- TypeScript strict, no \`any\`.
- Named exports only. No default exports.
- Tailwind semantic tokens (bg-background, text-foreground) — never bg-white.

## Architecture
- RLS enabled on every public table. Grants required.
- Roles live in public.user_roles, never on the profiles table.

## Don't
- Don't add src/pages/ — this is TanStack, routes go under src/routes/.
- Don't touch src/routeTree.gen.ts (auto-generated).
- Don't ship secrets to the client. process.env is server-only.`}</code></pre>

        <h2>What to put in rules (and what not to)</h2>
        <p>
          Rules shine for <strong>decisions the agent would otherwise re-litigate</strong>:
          the stack, naming conventions, folder layout, forbidden patterns, preferred
          libraries. Skip anything that changes per task — those belong in the prompt.
        </p>
        <ul>
          <li>✅ "Use zod for input validation."</li>
          <li>✅ "Never store JWTs in localStorage."</li>
          <li>❌ "Build a pricing page." (task, not rule)</li>
          <li>❌ "The button color is #3B82F6." (put it in the design system, not rules)</li>
        </ul>

        <h2>Scoped rules for monorepos</h2>
        <p>
          For large repos, place a <code>.manovikrules</code> at any subdirectory. MANOVIK
          merges the closest rules file with the root — nearer files win on conflict.
          This lets a <code>packages/api</code> workspace enforce different conventions
          than <code>apps/web</code>.
        </p>

        <h2>Rules vs. system prompt vs. memory</h2>
        <p>
          Three ways to steer MANOVIK, in order of persistence:
        </p>
        <ol>
          <li><strong>System prompt</strong> — one-off, per conversation.</li>
          <li><strong>Memory</strong> — cross-session facts about you or the project.</li>
          <li><strong>.manovikrules</strong> — version-controlled team standards.</li>
        </ol>

        <h2>Migrating from .cursorrules</h2>
        <p>
          Already have a <code>.cursorrules</code>? Copy it to <code>.manovikrules</code> and
          delete anything Cursor-specific (IDE shortcuts, chat behavior). The vast majority
          of coding conventions transfer directly.
        </p>

        <h2>Try it</h2>
        <p>
          Open a project on <Link to="/" className="text-primary hover:underline">MANOVIK</Link>,
          add a <code>.manovikrules</code> at the repo root, and watch the next agent turn
          honor it — with no extra prompting.
        </p>
      </article>
    </main>
  );
}
