import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/vs-bolt-new")({
  component: VsBoltNewPage,
  head: () => ({
    meta: [
      { title: "MANOVIK AI vs Bolt.new — Lifetime-Priced Alternative" },
      {
        name: "description",
        content:
          "Bolt.new alternative: MANOVIK AI ships prompt-to-app building with sovereign hosting, multi-language support, and lifetime pricing.",
      },
      {
        name: "keywords",
        content:
          "Bolt.new alternative, MANOVIK AI vs Bolt.new, prompt to app, browser AI builder, sovereign AI, StackBlitz Bolt alternative",
      },
      { property: "og:title", content: "MANOVIK AI vs Bolt.new — The Sovereign Alternative" },
      {
        property: "og:description",
        content:
          "Head-to-head: sovereign hosting, multi-language stack support, and lifetime pricing vs Bolt.new's web-only subscription.",
      },
      { property: "og:url", content: "https://manovik.in/vs-bolt-new" },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "MANOVIK AI vs Bolt.new" },
      {
        name: "twitter:description",
        content: "The sovereign, lifetime-priced Bolt.new alternative.",
      },
    ],
    links: [{ rel: "canonical", href: "https://manovik.in/vs-bolt-new" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: [
            {
              "@type": "Question",
              name: "Is MANOVIK AI a good Bolt.new alternative?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Yes. MANOVIK AI covers the same prompt-to-app workflow as Bolt.new, adds sovereign hosting, works beyond the browser sandbox, and replaces Bolt's subscription with a one-time lifetime price.",
              },
            },
            {
              "@type": "Question",
              name: "What's the difference between Bolt.new and MANOVIK AI?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Bolt.new runs entirely inside a StackBlitz WebContainer in the browser, which limits it to JavaScript/TypeScript stacks and web-only output. MANOVIK AI runs a real backend, targets Play Store, App Store, and web deploys, and offers sovereign infrastructure for teams that need it.",
              },
            },
            {
              "@type": "Question",
              name: "How does MANOVIK AI pricing compare to Bolt.new?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Bolt.new bills a monthly subscription tied to token usage. MANOVIK AI is a one-time lifetime purchase with included credits and predictable overage pricing — better economics for long-running projects.",
              },
            },
            {
              "@type": "Question",
              name: "Can MANOVIK AI build mobile apps like Bolt.new?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "MANOVIK AI's Ship-to-Stores flow packages deliverables for Play Store, App Store, and web deploys. Bolt.new is web-first and mobile builds require exporting to another toolchain.",
              },
            },
          ],
        }),
      },
    ],
  }),
});

function VsBoltNewPage() {
  const rows: Array<{ feature: string; manovik: string; bolt: string }> = [
    {
      feature: "Delivery model",
      manovik: "Managed hosted product + sovereign option",
      bolt: "Browser-only WebContainer",
    },
    {
      feature: "Pricing model",
      manovik: "Lifetime — one-time payment + included credits",
      bolt: "Monthly subscription tied to token usage",
    },
    {
      feature: "Cost predictability",
      manovik: "Flat lifetime; overage priced up front",
      bolt: "Variable — scales with prompts + tokens",
    },
    {
      feature: "Sovereign / on-prem hosting",
      manovik: "Managed sovereign mode",
      bolt: "Not available — SaaS only",
    },
    {
      feature: "Stack coverage",
      manovik: "Node, Python, Go, mobile, edge, more",
      bolt: "JS/TS only (WebContainer sandbox)",
    },
    { feature: "Ship targets", manovik: "Play Store, App Store, Web", bolt: "Web (Netlify) only" },
    {
      feature: "Local model support",
      manovik: "Yes (Ollama / vLLM / OpenAI-compatible)",
      bolt: "No — managed provider only",
    },
    {
      feature: "Data residency",
      manovik: "Configurable — India / EU / on-prem",
      bolt: "Vendor-controlled",
    },
  ];

  return (
    <main className="mx-auto max-w-4xl px-6 py-16 text-foreground">
      <nav className="text-sm text-muted-foreground mb-6">
        <Link to="/" className="hover:underline">
          Home
        </Link>{" "}
        / <span>vs Bolt.new</span>
      </nav>

      <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">MANOVIK AI vs Bolt.new</h1>
      <p className="text-lg text-muted-foreground mb-10">
        Looking for a <strong>Bolt.new alternative</strong> that ships beyond the browser sandbox,
        supports sovereign hosting, and charges once instead of monthly? Here's the honest
        head-to-head.
      </p>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-4">The 30-second summary</h2>
        <p className="leading-relaxed">
          Bolt.new is a slick prompt-to-app builder from StackBlitz that runs entirely inside a
          <strong> browser WebContainer</strong>. That makes it fast to try, but it locks you into
          JS/TS, web-only output, and a <strong>monthly subscription</strong>. MANOVIK AI runs a
          real backend, targets <strong>Play Store, App Store, and Web</strong> from the same
          prompt, offers <strong>managed sovereign infrastructure</strong>, and ships as a{" "}
          <strong>one-time lifetime purchase</strong>.
        </p>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-4">Feature comparison</h2>
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-3 font-semibold">Feature</th>
                <th className="text-left p-3 font-semibold">MANOVIK AI</th>
                <th className="text-left p-3 font-semibold">Bolt.new</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.feature} className="border-t">
                  <td className="p-3 font-medium">{r.feature}</td>
                  <td className="p-3 text-emerald-600 dark:text-emerald-400">{r.manovik}</td>
                  <td className="p-3 text-muted-foreground">{r.bolt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-4">Why teams switch from Bolt.new</h2>
        <ul className="space-y-3 list-disc pl-6">
          <li>
            <strong>Real stack coverage:</strong> Python, Go, mobile, and edge — not just what fits
            in a browser sandbox.
          </li>
          <li>
            <strong>Ship-to-Stores:</strong> Play Store, App Store, and Web deliverables generated
            from the same prompt.
          </li>
          <li>
            <strong>Managed sovereign hosting:</strong> a real on-prem option for regulated teams,
            not SaaS-only.
          </li>
          <li>
            <strong>Predictable cost:</strong> a single lifetime payment replaces a monthly
            subscription that scales with usage.
          </li>
          <li>
            <strong>Local model support:</strong> point at Ollama, vLLM, or any OpenAI-compatible
            endpoint and run offline.
          </li>
        </ul>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-4">When Bolt.new is still a good fit</h2>
        <p className="leading-relaxed text-muted-foreground">
          Bolt.new is great for quick JS/TS web prototypes you want to spin up and share from a
          browser tab. MANOVIK AI is the better fit when you want mobile output, sovereign
          infrastructure, multi-language support, or predictable lifetime pricing for a team.
        </p>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-4">FAQ</h2>
        <div className="space-y-4">
          <div>
            <h3 className="font-semibold">Is MANOVIK AI a good Bolt.new alternative?</h3>
            <p className="text-muted-foreground">
              Yes — especially if you need mobile output, sovereign hosting, or predictable lifetime
              pricing instead of a monthly SaaS bill.
            </p>
          </div>
          <div>
            <h3 className="font-semibold">Can MANOVIK AI ship mobile apps?</h3>
            <p className="text-muted-foreground">
              Yes. The Ship-to-Stores flow packages Play Store, App Store, and Web deliverables from
              a single prompt.
            </p>
          </div>
          <div>
            <h3 className="font-semibold">Does MANOVIK AI run in the browser like Bolt.new?</h3>
            <p className="text-muted-foreground">
              MANOVIK AI has a hosted chat + workspace UI, but the actual build runs against a real
              backend — no WebContainer limitations on language or runtime.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border bg-card p-8 text-center">
        <h2 className="text-2xl font-bold mb-2">Try the sovereign Bolt.new alternative</h2>
        <p className="text-muted-foreground mb-6">
          One payment. Unlimited use. Your code stays yours.
        </p>
        <Link
          to="/"
          className="inline-flex items-center justify-center rounded-lg bg-primary px-6 py-3 font-semibold text-primary-foreground hover:opacity-90"
        >
          Get started
        </Link>
      </section>
    </main>
  );
}
