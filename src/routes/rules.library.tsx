import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Copy, Check } from "lucide-react";

const TITLE = "MANOVIK Rules Library — Ready-to-use .manovikrules templates";
const DESCRIPTION =
  "A curated gallery of copy-paste .manovikrules templates for Next.js, React, FastAPI, Tailwind, Django, TanStack Start, Expo, and more. Steer the MANOVIK AI agent with proven system rules — a sovereign alternative to .cursorrules libraries.";
const URL = "https://manovik.in/rules/library";

type Template = {
  id: string;
  name: string;
  tag: string;
  description: string;
  rules: string;
};

const TEMPLATES: Template[] = [
  {
    id: "nextjs",
    name: "Next.js 15 (App Router)",
    tag: "Framework",
    description: "Server components first, typed routes, Tailwind, and shadcn/ui conventions.",
    rules: `# .manovikrules — Next.js 15 App Router
- Use the App Router under /app. Never create /pages files.
- Default to Server Components. Add "use client" only when you need state, effects, or browser APIs.
- Fetch data in server components with async/await; never useEffect for initial loads.
- Use next/image for all raster images; set width, height, and alt.
- Style with Tailwind v4 tokens (bg-background, text-foreground); never hardcode hex.
- Shared UI lives in components/ui (shadcn). Route-specific components live next to the route.
- Use zod for all form and API input validation.
- Prefer Route Handlers under app/api/*/route.ts for server endpoints.
- Never commit secrets. Read them via process.env inside server code only.`,
  },
  {
    id: "tanstack-start",
    name: "TanStack Start (React 19 + Vite)",
    tag: "Framework",
    description: "File-based routing, server functions, and loader-driven data fetching.",
    rules: `# .manovikrules — TanStack Start
- All routes live in src/routes; never install react-router-dom.
- Use createFileRoute for pages and createServerFn from @tanstack/react-start for server logic.
- Fetch initial data in loaders via context.queryClient.ensureQueryData; render with useSuspenseQuery.
- Never edit src/routeTree.gen.ts — it is auto-generated.
- Read process.env inside .handler() only; use import.meta.env.VITE_* in the browser.
- Protected server functions use .middleware([requireSupabaseAuth]).
- Webhooks and public APIs go under src/routes/api/public/*.
- Head metadata: every leaf route sets its own title, description, og:*, twitter:card.`,
  },
  {
    id: "react-tailwind",
    name: "React + Tailwind + shadcn/ui",
    tag: "Frontend",
    description: "Design-token discipline, accessible primitives, and small focused components.",
    rules: `# .manovikrules — React + Tailwind + shadcn
- Use semantic tokens (bg-background, text-foreground, text-muted-foreground) — never bg-white/text-black or arbitrary hex.
- Icon-only buttons MUST include aria-label.
- Wrap the primary route content in exactly one <main>.
- Prefer shadcn primitives over hand-rolled Dialogs, Popovers, or Comboboxes.
- Keep components under ~200 lines; extract sub-components early.
- Use lucide-react for icons; import only what you use.
- Use useId() for form control ids inside list-rendered items to avoid duplicates.
- Colocate types with the component; export only what other files import.`,
  },
  {
    id: "fastapi",
    name: "FastAPI (Python 3.12)",
    tag: "Backend",
    description: "Async routes, pydantic v2 schemas, and dependency-injected auth.",
    rules: `# .manovikrules — FastAPI
- Use async def for all route handlers unless they are trivially sync.
- Validate every request/response body with pydantic v2 models; never accept dict[str, Any].
- Group routes by domain in routers/ and register them in main.py.
- Auth belongs in a Depends() dependency, not in route bodies.
- Never call blocking IO in a request path — use httpx.AsyncClient, asyncpg, or run_in_threadpool.
- Log with structlog; include request_id and user_id when available.
- Use ruff + mypy --strict; no untyped defs allowed.
- Tests use pytest-asyncio + httpx.AsyncClient against the ASGI app.`,
  },
  {
    id: "django",
    name: "Django 5 + DRF",
    tag: "Backend",
    description: "Class-based views, DRF serializers, and migrations-first schema changes.",
    rules: `# .manovikrules — Django 5 + DRF
- Model changes go through makemigrations + migrate — never edit historical migrations.
- Serializers validate input; never trust request.data directly.
- Business logic lives in services/, not in views or serializers.
- Use select_related / prefetch_related on every list endpoint that renders relations.
- Permission classes gate every viewset; default deny.
- Use django-environ for settings; secrets never touch settings.py.
- Tests use pytest-django with factory_boy fixtures.`,
  },
  {
    id: "tailwind-v4",
    name: "Tailwind CSS v4",
    tag: "Styling",
    description: "Native @theme tokens, no legacy config, and Lightning CSS constraints.",
    rules: `# .manovikrules — Tailwind v4
- Define tokens in @theme inside styles.css; no tailwind.config.js.
- Keep all @import rules at the very top of styles.css, before @theme.
- Never @import a remote URL — load web fonts via <link> in the root head.
- Use CSS variables (hsl(var(--primary))) inside @theme, not raw hex.
- Prefer @utility for one-off utilities over inline arbitrary values.
- Dark mode: use @custom-variant dark (&:where(.dark, .dark *)); toggle .dark on <html>.`,
  },
  {
    id: "expo",
    name: "Expo (React Native)",
    tag: "Mobile",
    description: "Expo Router, EAS Build, and native-friendly component conventions.",
    rules: `# .manovikrules — Expo (React Native)
- Use expo-router; routes live under app/. Never mix with react-navigation stacks.
- Prefer expo-image over Image for caching and blurhash.
- Use react-native-reanimated for animation, not Animated.
- All native modules must have an Expo config plugin or be part of Expo SDK.
- Ship with EAS Build; never commit ios/ or android/ unless the project uses bare workflow.
- Use SafeAreaView from react-native-safe-area-context for every screen root.
- Handle offline: wrap network calls with react-query and set retry + staleTime.`,
  },
  {
    id: "supabase",
    name: "Supabase (Postgres + RLS)",
    tag: "Data",
    description: "RLS-first, security-definer helpers, and typed client usage.",
    rules: `# .manovikrules — Supabase
- Every new public table: CREATE TABLE, then GRANT, then ENABLE RLS, then CREATE POLICY — in that order.
- Never store roles on profiles; use a separate user_roles table + has_role() security-definer function.
- Never call supabase.auth.admin from client code; use it only in server functions.
- Generated types live in integrations/supabase/types.ts — never hand-edit.
- Migrations are append-only; new file per change.
- Anon key is safe to ship; service_role never touches the browser bundle.`,
  },
  {
    id: "node-ts",
    name: "Node.js + TypeScript",
    tag: "Backend",
    description: "ESM-only, strict TS, and Zod at every trust boundary.",
    rules: `# .manovikrules — Node.js + TypeScript
- ESM only ("type": "module"); no require().
- tsconfig: strict, noUncheckedIndexedAccess, exactOptionalPropertyTypes.
- Validate every external input (env, HTTP, queue payloads) with zod.
- Never throw strings — always Error subclasses with a machine-readable code.
- Structured logging via pino; correlate with a request id.
- HTTP client: undici fetch, not axios.
- Tests: vitest with 100% type coverage on public APIs.`,
  },
  {
    id: "monorepo",
    name: "Turborepo / pnpm monorepo",
    tag: "Tooling",
    description: "Workspace boundaries, task pipelines, and shared configs.",
    rules: `# .manovikrules — Monorepo
- Apps live in apps/*, shared libraries in packages/*.
- No app imports another app; cross-app code goes into packages/.
- Every package exports through its package.json "exports" field; no deep imports.
- Shared tsconfig, eslint, and prettier live in packages/config.
- Use turbo run build --filter for scoped builds; never turbo run build with no filter in CI.
- Bump versions with changesets; no manual package.json edits.`,
  },
];

export const Route = createFileRoute("/rules/library")({
  component: RulesLibrary,
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      {
        name: "keywords",
        content:
          "manovik rules library, .manovikrules templates, cursor rules library, .cursorrules templates, AI agent rules, system rules gallery, coding rules for AI, next.js AI rules, fastapi AI rules, tailwind AI rules",
      },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:url", content: URL },
      { property: "og:type", content: "website" },
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
          "@type": "CollectionPage",
          name: TITLE,
          description: DESCRIPTION,
          url: URL,
          mainEntity: {
            "@type": "ItemList",
            numberOfItems: TEMPLATES.length,
            itemListElement: TEMPLATES.map((t, i) => ({
              "@type": "ListItem",
              position: i + 1,
              name: t.name,
              description: t.description,
            })),
          },
        }),
      },
    ],
  }),
});

function RulesLibrary() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-16">
      <nav className="mb-8 text-sm text-muted-foreground">
        <Link to="/" className="hover:text-foreground">Home</Link>
        <span className="mx-2">/</span>
        <span>Rules Library</span>
      </nav>

      <header className="mb-10">
        <span className="inline-block rounded-full border border-border/60 bg-muted/40 px-3 py-1 text-xs uppercase tracking-wider text-muted-foreground">
          MANOVIK Rules Library
        </span>
        <h1 className="mt-4 text-4xl font-bold tracking-tight md:text-5xl">
          Ready-to-use <code className="rounded bg-muted px-2 py-1 text-3xl md:text-4xl">.manovikrules</code> templates
        </h1>
        <p className="mt-4 max-w-3xl text-lg text-muted-foreground">
          Steer the MANOVIK autonomous agent with proven system rules. Copy any template into a
          <code className="mx-1 rounded bg-muted px-1.5 py-0.5">.manovikrules</code>
          file at your project root — MANOVIK will follow them on every prompt. A sovereign alternative to
          <code className="mx-1 rounded bg-muted px-1.5 py-0.5">.cursorrules</code>
          libraries.
        </p>
      </header>

      <section aria-label="Template gallery" className="grid gap-6">
        {TEMPLATES.map((template) => (
          <TemplateCard key={template.id} template={template} />
        ))}
      </section>

      <section className="mt-16 rounded-xl border border-border/60 bg-muted/30 p-6">
        <h2 className="text-xl font-semibold">How MANOVIK uses your rules</h2>
        <p className="mt-2 text-muted-foreground">
          Drop a <code>.manovikrules</code> file at the root of your project. MANOVIK reads it before every
          reasoning cycle and treats each rule as a hard constraint — the same way Cursor honors
          <code className="mx-1">.cursorrules</code>. Combine templates freely; MANOVIK deduplicates
          overlapping guidance.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            to="/blog/system-rules"
            className="rounded-md border border-border/60 bg-background px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            Read the system-rules guide →
          </Link>
          <Link
            to="/"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Try MANOVIK
          </Link>
        </div>
      </section>
    </main>
  );
}

function TemplateCard({ template }: { template: Template }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(template.rules);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <article className="overflow-hidden rounded-xl border border-border/60 bg-card">
      <header className="flex items-start justify-between gap-4 border-b border-border/60 p-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-border/60 bg-muted/40 px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
              {template.tag}
            </span>
            <h2 className="text-lg font-semibold">{template.name}</h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{template.description}</p>
        </div>
        <button
          type="button"
          onClick={handleCopy}
          aria-label={`Copy ${template.name} rules to clipboard`}
          className="inline-flex shrink-0 items-center gap-2 rounded-md border border-border/60 bg-background px-3 py-2 text-xs font-medium hover:bg-muted"
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </header>
      <pre className="overflow-x-auto bg-muted/30 p-5 text-xs leading-relaxed">
        <code>{template.rules}</code>
      </pre>
    </article>
  );
}
