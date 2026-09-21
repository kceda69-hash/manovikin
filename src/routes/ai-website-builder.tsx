import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Check, Wand2, Database, Rocket, IndianRupee } from "lucide-react";

const FAQS = [
  {
    q: "Can AI really build a full website for me?",
    a: "Yes, for most standard sites. You describe the site in plain language — pages, sections, what it should do — and MANOVIK generates the layout, the copy structure, the forms and the database behind them, then shows you a live preview you can keep editing by chatting.",
  },
  {
    q: "Do I need to know how to code?",
    a: "No. You can build and publish without writing code. If you do know how to code, you still get the full source — MANOVIK writes real React and TypeScript, not a locked-in page builder format.",
  },
  {
    q: "How much does it cost in India?",
    a: "You can start free. The Pro plan is ₹699/month, and there is a one-time lifetime plan at ₹4999 that also lets you self-host MANOVIK on your own server.",
  },
  {
    q: "Can it build more than a landing page?",
    a: "Yes. MANOVIK builds full-stack sites: login and signup, dashboards, admin panels, payment checkout, file uploads, APIs and scheduled jobs — not just static pages.",
  },
  {
    q: "Do I own the website and the code?",
    a: "Yes. The generated code is yours. On the lifetime plan you can run the whole thing on your own infrastructure, so nothing depends on a vendor staying online.",
  },
  {
    q: "How long does it take?",
    a: "A first working version of a simple site usually appears within minutes of the first prompt. Bigger applications take longer because MANOVIK also writes the database schema, validation and tests.",
  },
];

const TITLE = "AI Website Builder — Build a Site From One Prompt | MANOVIK";
const DESCRIPTION =
  "Describe your website in plain English and MANOVIK builds it — pages, database, login and payments included. Start free, Pro ₹699/mo, lifetime self-host ₹4999.";
const URL = "https://manovik.in/ai-website-builder";

export const Route = createFileRoute("/ai-website-builder")({
  component: AiWebsiteBuilderPage,
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: "AI Website Builder — MANOVIK" },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: URL },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "AI Website Builder — MANOVIK" },
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

function AiWebsiteBuilderPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/40">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden /> Back to home
          </Link>
          <Link to="/login" className="text-sm font-semibold underline">
            Start free
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-12 px-4 py-12">
        <section className="space-y-4">
          <p className="text-sm uppercase tracking-wider text-muted-foreground">
            AI website builder
          </p>
          <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
            Build a real website by describing it
          </h1>
          <p className="text-lg text-muted-foreground">
            MANOVIK is an AI website builder that turns one prompt into a working site — pages,
            database, login, payments and all. You keep chatting to change it, and you keep the
            code.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link
              to="/login"
              className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
            >
              Build my website free
            </Link>
            <Link
              to="/how-to-make-a-website-with-ai"
              className="rounded-lg border border-border px-5 py-2.5 text-sm font-semibold"
            >
              Read the step-by-step guide →
            </Link>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">What you get from one prompt</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {[
              {
                icon: Wand2,
                title: "Design and pages",
                body: "Responsive layout, sections, navigation and forms generated together — consistent across the whole site instead of page by page.",
              },
              {
                icon: Database,
                title: "A real backend",
                body: "Tables, row-level security, validation and APIs are written for you, so signup, dashboards and admin screens actually work.",
              },
              {
                icon: Rocket,
                title: "Publish and iterate",
                body: "Preview live, publish, then keep changing it in chat. Every change is versioned so you can roll back.",
              },
              {
                icon: IndianRupee,
                title: "Indian pricing",
                body: "Free to start, ₹699/month Pro, or a one-time ₹4999 lifetime plan with self-hosting. Payments in INR.",
              },
            ].map(({ icon: Icon, title, body }) => (
              <div key={title} className="rounded-xl border border-border/60 bg-card/40 p-5">
                <Icon className="h-5 w-5 text-primary" aria-hidden />
                <div className="mt-3 font-semibold">{title}</div>
                <p className="mt-1 text-sm text-muted-foreground">{body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">How it differs from a drag-and-drop builder</h2>
          <ul className="space-y-2">
            <li className="flex gap-2">
              <Check className="h-5 w-5 shrink-0 text-primary" aria-hidden /> It writes real React
              and TypeScript you can export, not a proprietary page format.
            </li>
            <li className="flex gap-2">
              <Check className="h-5 w-5 shrink-0 text-primary" aria-hidden /> It builds the database
              and server logic, so logged-in dashboards and payments are possible.
            </li>
            <li className="flex gap-2">
              <Check className="h-5 w-5 shrink-0 text-primary" aria-hidden /> It runs and checks its
              own work before handing the result back.
            </li>
            <li className="flex gap-2">
              <Check className="h-5 w-5 shrink-0 text-primary" aria-hidden /> On the lifetime plan
              you can host the builder itself on your own server.
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
          <div className="font-semibold">Describe your site, get a working version today</div>
          <p className="mt-1 text-sm text-muted-foreground">
            Start free, no card needed.{" "}
            <Link to="/case-studies" className="underline">
              See real missions MANOVIK has shipped →
            </Link>{" "}
            <Link to="/best-ai-coding-agent" className="underline">
              Compare MANOVIK with other AI builders →
            </Link>
          </p>
        </section>
      </main>
    </div>
  );
}
