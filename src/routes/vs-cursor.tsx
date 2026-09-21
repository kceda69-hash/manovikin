import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/vs-cursor")({
  component: VsCursorPage,
  head: () => ({
    meta: [
      { title: "MANOVIK AI vs Cursor AI — Sovereign Alternative" },
      {
        name: "description",
        content:
          "Cursor AI alternative: MANOVIK offers sovereign deployment, local model support, and lifetime pricing. Privacy-first AI coding assistant.",
      },
      {
        name: "keywords",
        content:
          "Cursor AI alternative, Cursor AI privacy, local AI coding, sovereign AI, MANOVIK vs Cursor",
      },
      { property: "og:title", content: "MANOVIK AI vs Cursor AI — The Sovereign Alternative" },
      {
        property: "og:description",
        content:
          "Head-to-head: privacy, deployment, pricing, and capabilities. Why developers pick MANOVIK over Cursor.",
      },
      { property: "og:url", content: "https://manovik.in/vs-cursor" },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "MANOVIK AI vs Cursor AI" },
      {
        name: "twitter:description",
        content: "The sovereign, lifetime-priced Cursor alternative.",
      },
    ],
    links: [{ rel: "canonical", href: "https://manovik.in/vs-cursor" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: [
            {
              "@type": "Question",
              name: "Is MANOVIK AI a good Cursor AI alternative?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Yes. MANOVIK AI offers a sovereign deployment option, local model support, and one-time lifetime pricing, addressing the three most common Cursor pain points: data privacy, vendor lock-in, and recurring subscription costs.",
              },
            },
            {
              "@type": "Question",
              name: "Does MANOVIK AI support local models like Cursor?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "MANOVIK AI supports running against local model endpoints and self-hosted inference, in addition to managed cloud models. Cursor restricts most advanced features to its hosted plane.",
              },
            },
            {
              "@type": "Question",
              name: "How does MANOVIK AI pricing compare to Cursor?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Cursor is subscription-only (~$20/month per seat). MANOVIK AI offers a lifetime plan — one payment, unlimited use, no seat metering.",
              },
            },
          ],
        }),
      },
    ],
  }),
});

function VsCursorPage() {
  const rows: Array<{ feature: string; manovik: string; cursor: string }> = [
    {
      feature: "Pricing model",
      manovik: "Lifetime — one-time payment",
      cursor: "Subscription, per seat / month",
    },
    {
      feature: "Sovereign / self-hosted deployment",
      manovik: "Yes — on your infra",
      cursor: "No — cloud only",
    },
    {
      feature: "Local model support",
      manovik: "Yes (Ollama / vLLM / custom endpoints)",
      cursor: "Limited; advanced features cloud-only",
    },
    {
      feature: "Code privacy",
      manovik: "Your repo never leaves your network in sovereign mode",
      cursor: "Code sent to Cursor's cloud",
    },
    {
      feature: "Multi-language fluency",
      manovik: "100+ languages with per-language memory",
      cursor: "Strong but cloud-tied",
    },
    {
      feature: "Vendor lock-in",
      manovik: "Open architecture, swappable models",
      cursor: "Tightly coupled to Cursor cloud",
    },
    {
      feature: "Pricing transparency",
      manovik: "Public, one-time, no metered seats",
      cursor: "Per-seat, plan-tiered",
    },
  ];

  return (
    <main className="mx-auto max-w-4xl px-6 py-16 text-foreground">
      <nav className="text-sm text-muted-foreground mb-6">
        <Link to="/" className="hover:underline">
          Home
        </Link>{" "}
        / <span>vs Cursor AI</span>
      </nav>

      <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
        MANOVIK AI vs Cursor AI
      </h1>
      <p className="text-lg text-muted-foreground mb-10">
        Looking for a <strong>Cursor AI alternative</strong> that respects privacy, runs on your
        infrastructure, and doesn't lock you into a subscription? Here's the honest head-to-head.
      </p>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-4">The 30-second summary</h2>
        <p className="leading-relaxed">
          Cursor is an excellent cloud-first AI IDE — but every keystroke, file, and prompt flows
          through their servers, and you pay monthly per seat forever. MANOVIK AI is built for teams
          who need <strong>sovereign deployment</strong>, <strong>local model support</strong>, and{" "}
          <strong>lifetime pricing</strong>. Same agentic power, none of the recurring bill or data
          exfiltration.
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
                <th className="text-left p-3 font-semibold">Cursor AI</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.feature} className="border-t">
                  <td className="p-3 font-medium">{r.feature}</td>
                  <td className="p-3 text-emerald-600 dark:text-emerald-400">{r.manovik}</td>
                  <td className="p-3 text-muted-foreground">{r.cursor}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-4">Why developers switch from Cursor</h2>
        <ul className="space-y-3 list-disc pl-6">
          <li>
            <strong>Privacy:</strong> proprietary code, customer data, and secrets never leave your
            perimeter in MANOVIK's sovereign mode.
          </li>
          <li>
            <strong>Cost:</strong> one lifetime payment replaces ~$240/year/seat indefinitely.
          </li>
          <li>
            <strong>Control:</strong> swap models freely — Claude, Gemini, GPT, local Llama, Qwen —
            without changing tools.
          </li>
          <li>
            <strong>Compliance:</strong> easier path to SOC2, HIPAA, GDPR, and India's DPDP
            requirements when inference stays on-prem.
          </li>
        </ul>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-4">FAQ</h2>
        <div className="space-y-4">
          <div>
            <h3 className="font-semibold">Is MANOVIK AI a good Cursor AI alternative?</h3>
            <p className="text-muted-foreground">
              Yes — especially if privacy, local models, or lifetime pricing matter to you.
            </p>
          </div>
          <div>
            <h3 className="font-semibold">Can I run MANOVIK AI entirely offline?</h3>
            <p className="text-muted-foreground">
              Yes, with a self-hosted model endpoint (Ollama, vLLM, llama.cpp) the agent works
              without external API calls.
            </p>
          </div>
          <div>
            <h3 className="font-semibold">How does pricing compare?</h3>
            <p className="text-muted-foreground">
              Cursor is subscription-only. MANOVIK offers a lifetime plan — pay once, use forever.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border bg-card p-8 text-center">
        <h2 className="text-2xl font-bold mb-2">Try the sovereign Cursor alternative</h2>
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
