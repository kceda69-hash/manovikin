import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

const STEPS = [
  {
    name: "Write down what the site must do",
    text: 'Before prompting, list the pages you need, who visits them, and the one action a visitor should take. A prompt like "a bakery site with a menu, an order form and WhatsApp contact" produces a far better first build than "make me a website".',
  },
  {
    name: "Describe it to the AI builder in one prompt",
    text: "Open MANOVIK and paste that description in the chat box. Include your business name, the tone you want, and any content you already have. The first version appears as a live preview you can click through.",
  },
  {
    name: "Refine by conversation, not by dragging",
    text: "Ask for changes in plain language: shorter hero, add a pricing table, move testimonials above the form. Each change is applied to the real code and versioned, so you can undo anything.",
  },
  {
    name: "Add the working parts",
    text: "Ask for login, a contact form that stores submissions, an admin page, or payment checkout. MANOVIK writes the database tables, access rules and server code alongside the interface.",
  },
  {
    name: "Check it on a phone and fix the details",
    text: "Most visitors in India arrive on mobile. Open the preview on a phone, check text size, tap targets and form fields, and ask for fixes where something feels cramped.",
  },
  {
    name: "Publish and connect your domain",
    text: "Publish from inside MANOVIK, then point your custom domain at it. Add a clear page title and description for each page so search engines show something useful.",
  },
  {
    name: "Keep improving it after launch",
    text: "A site earns traffic when it keeps answering real questions. Add a page for each service or question your customers ask, and let the agent draft and publish them on a schedule.",
  },
];

const TITLE = "How to Make a Website With AI (Step by Step) | MANOVIK";
const DESCRIPTION =
  "A practical 7-step guide to building and publishing a real website with AI — planning the prompt, adding login and payments, checking mobile, and launching on your own domain.";
const URL = "https://manovik.in/how-to-make-a-website-with-ai";

export const Route = createFileRoute("/how-to-make-a-website-with-ai")({
  component: HowToPage,
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: "How to Make a Website With AI — Step by Step" },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "article" },
      { property: "og:url", content: URL },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "How to Make a Website With AI — Step by Step" },
      { name: "twitter:description", content: DESCRIPTION },
    ],
    links: [{ rel: "canonical", href: URL }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "HowTo",
          name: "How to make a website with AI",
          description: DESCRIPTION,
          totalTime: "PT1H",
          step: STEPS.map((s, i) => ({
            "@type": "HowToStep",
            position: i + 1,
            name: s.name,
            text: s.text,
          })),
        }),
      },
    ],
  }),
});

function HowToPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/40">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden /> Back to home
          </Link>
          <Link to="/login" className="text-sm font-semibold underline">
            Try it free
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-10 px-4 py-12">
        <section className="space-y-4">
          <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
            How to make a website with AI, step by step
          </h1>
          <p className="text-lg text-muted-foreground">
            AI builders can now produce a working, publishable site — not just a mockup. The quality
            depends almost entirely on how you brief them. Here is the sequence that works.
          </p>
        </section>

        <section className="space-y-6">
          {STEPS.map((s, i) => (
            <article key={s.name} className="rounded-xl border border-border/60 bg-card/40 p-5">
              <h2 className="text-xl font-semibold">
                {i + 1}. {s.name}
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">{s.text}</p>
            </article>
          ))}
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">Common mistakes to avoid</h2>
          <ul className="list-disc space-y-2 pl-5 text-muted-foreground">
            <li>
              Prompting for a "beautiful website" without saying what it sells or who it serves.
            </li>
            <li>
              Rebuilding from scratch after every change instead of refining the same project.
            </li>
            <li>
              Launching without page titles and descriptions, so search results show nothing useful.
            </li>
            <li>Skipping the mobile check when most of your visitors are on phones.</li>
            <li>
              Choosing a builder that locks the output, leaving you unable to export or self-host.
            </li>
          </ul>
        </section>

        <section className="rounded-xl border border-border/60 bg-card/40 p-6">
          <div className="font-semibold">Build yours now</div>
          <p className="mt-1 text-sm text-muted-foreground">
            Start free with MANOVIK's{" "}
            <Link to="/ai-website-builder" className="underline">
              AI website builder
            </Link>{" "}
            — real code, real database, yours to keep.
          </p>
        </section>
      </main>
    </div>
  );
}
