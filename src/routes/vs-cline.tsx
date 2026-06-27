import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/vs-cline")({
  component: VsClinePage,
  head: () => ({
    meta: [
      { title: "MANOVIK AI vs Cline — Sovereign Alternative" },
      {
        name: "description",
        content:
          "Cline alternative: MANOVIK offers sovereign hosting, local model support, and lifetime pricing for autonomous AI coding agents.",
      },
      { name: "keywords", content: "Cline alternative, Cline AI, autonomous coding agent, sovereign AI, MANOVIK vs Cline" },
      { property: "og:title", content: "MANOVIK AI vs Cline — The Sovereign Alternative" },
      {
        property: "og:description",
        content: "Head-to-head: autonomy, privacy, hosting, and pricing. Why teams pick MANOVIK over Cline.",
      },
      { property: "og:url", content: "https://manovik.in/vs-cline" },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "MANOVIK AI vs Cline" },
      { name: "twitter:description", content: "The sovereign, lifetime-priced Cline alternative." },
    ],
    links: [{ rel: "canonical", href: "https://manovik.in/vs-cline" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: [
            {
              "@type": "Question",
              name: "Is MANOVIK AI a good Cline alternative?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Yes. MANOVIK AI delivers the same autonomous coding-agent experience as Cline, with first-class sovereign hosting, local model support, and a one-time lifetime price instead of per-token API costs.",
              },
            },
            {
              "@type": "Question",
              name: "Does MANOVIK AI run locally like Cline?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Yes. MANOVIK AI can run fully on-prem against Ollama, vLLM, or any OpenAI-compatible local endpoint — no code or prompts leave your network.",
              },
            },
            {
              "@type": "Question",
              name: "How does MANOVIK AI pricing compare to Cline?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Cline itself is open source but you pay per-token for whichever cloud model you wire in (Claude, GPT, Gemini). MANOVIK AI offers a lifetime plan plus included credits, with no surprise token bills.",
              },
            },
          ],
        }),
      },
    ],
  }),
});

function VsClinePage() {
  const rows: Array<{ feature: string; manovik: string; cline: string }> = [
    { feature: "Pricing model", manovik: "Lifetime — one-time payment", cline: "Free tool + per-token API bills" },
    { feature: "Sovereign / self-hosted deployment", manovik: "Yes — managed sovereign mode", cline: "BYO setup, no managed sovereign offering" },
    { feature: "Local model support", manovik: "Yes (Ollama / vLLM / custom endpoints)", cline: "Yes, via manual configuration" },
    { feature: "Code privacy", manovik: "Repo never leaves your network in sovereign mode", cline: "Depends on chosen model provider" },
    { feature: "Multi-language fluency", manovik: "100+ languages with per-language memory", cline: "Depends on backing model" },
    { feature: "Out-of-the-box experience", manovik: "Hosted UI, auth, billing, audit trail", cline: "VS Code extension; you wire the rest" },
    { feature: "Token cost predictability", manovik: "Flat lifetime + included credits", cline: "Variable — scales with usage" },
  ];

  return (
    <main className="mx-auto max-w-4xl px-6 py-16 text-foreground">
      <nav className="text-sm text-muted-foreground mb-6">
        <Link to="/" className="hover:underline">Home</Link> / <span>vs Cline</span>
      </nav>

      <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
        MANOVIK AI vs Cline
      </h1>
      <p className="text-lg text-muted-foreground mb-10">
        Looking for a <strong>Cline alternative</strong> with sovereign hosting, predictable
        pricing, and a fully managed experience? Here's the honest head-to-head.
      </p>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-4">The 30-second summary</h2>
        <p className="leading-relaxed">
          Cline is a great open-source autonomous coding extension, but you still bring your
          own model keys and pay per-token forever. MANOVIK AI gives you the same agentic
          loop with <strong>managed sovereign hosting</strong>, <strong>local model
          support</strong>, and <strong>lifetime pricing</strong> — no per-token surprises and
          no manual plumbing.
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
                <th className="text-left p-3 font-semibold">Cline</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.feature} className="border-t">
                  <td className="p-3 font-medium">{r.feature}</td>
                  <td className="p-3 text-emerald-600 dark:text-emerald-400">{r.manovik}</td>
                  <td className="p-3 text-muted-foreground">{r.cline}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-4">Why developers switch from Cline</h2>
        <ul className="space-y-3 list-disc pl-6">
          <li><strong>Predictable cost:</strong> a single lifetime payment replaces unbounded per-token API bills.</li>
          <li><strong>Sovereign hosting:</strong> managed on-prem mode, not a DIY project.</li>
          <li><strong>Full product:</strong> hosted chat UI, auth, billing, and audit trail out of the box.</li>
          <li><strong>Compliance:</strong> easier path to SOC2, HIPAA, GDPR, and India's DPDP when inference stays on-prem.</li>
        </ul>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-4">FAQ</h2>
        <div className="space-y-4">
          <div>
            <h3 className="font-semibold">Is MANOVIK AI a good Cline alternative?</h3>
            <p className="text-muted-foreground">Yes — especially if you want sovereign hosting, predictable pricing, or a fully managed product instead of a DIY setup.</p>
          </div>
          <div>
            <h3 className="font-semibold">Can I run MANOVIK AI fully offline?</h3>
            <p className="text-muted-foreground">Yes, with a self-hosted model endpoint (Ollama, vLLM, llama.cpp) the agent works without external API calls.</p>
          </div>
          <div>
            <h3 className="font-semibold">How does pricing compare?</h3>
            <p className="text-muted-foreground">Cline is free but you pay per-token to whichever provider you wire in. MANOVIK is one lifetime payment with included credits.</p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border bg-card p-8 text-center">
        <h2 className="text-2xl font-bold mb-2">Try the sovereign Cline alternative</h2>
        <p className="text-muted-foreground mb-6">One payment. Unlimited use. Your code stays yours.</p>
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
