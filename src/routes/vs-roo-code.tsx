import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/vs-roo-code")({
  component: VsRooCodePage,
  head: () => ({
    meta: [
      { title: "MANOVIK AI vs Roo Code — The Sovereign Alternative" },
      {
        name: "description",
        content:
          "Roo Code alternative: MANOVIK AI offers managed sovereign hosting, local model support, and lifetime pricing versus BYO-key per-token costs.",
      },
      {
        name: "keywords",
        content:
          "Roo Code alternative, Roo Cline alternative, autonomous coding agent, sovereign AI, MANOVIK vs Roo Code, VS Code AI agent",
      },
      {
        property: "og:title",
        content: "MANOVIK AI vs Roo Code — The Sovereign, Lifetime-Priced Alternative",
      },
      {
        property: "og:description",
        content:
          "Head-to-head: sovereign hosting, managed infrastructure, and lifetime pricing vs BYO-key per-token bills.",
      },
      { property: "og:url", content: "https://manovik.in/vs-roo-code" },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "MANOVIK AI vs Roo Code" },
      {
        name: "twitter:description",
        content: "The sovereign, lifetime-priced Roo Code alternative.",
      },
    ],
    links: [{ rel: "canonical", href: "https://manovik.in/vs-roo-code" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: [
            {
              "@type": "Question",
              name: "Is MANOVIK AI a good Roo Code alternative?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Yes. MANOVIK AI delivers the same autonomous coding-agent workflow as Roo Code (formerly Roo Cline), with managed sovereign hosting, local model support, and a one-time lifetime price instead of BYO-key per-token API bills.",
              },
            },
            {
              "@type": "Question",
              name: "What's the difference between Roo Code and MANOVIK AI?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Roo Code is a VS Code extension you install locally and wire to your own model API keys. MANOVIK AI is a fully managed product: hosted chat UI, sovereign infrastructure option, auth, billing, and audit trail included — no extension, no manual key management.",
              },
            },
            {
              "@type": "Question",
              name: "How does MANOVIK AI pricing compare to Roo Code?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Roo Code is free but every token flows through your own Anthropic, OpenAI, or OpenRouter key — costs scale linearly with usage and are hard to predict. MANOVIK AI is a one-time lifetime purchase with included credits and predictable overage pricing.",
              },
            },
            {
              "@type": "Question",
              name: "Can MANOVIK AI run on-prem like Roo Code with a local model?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Yes. MANOVIK AI can point at any OpenAI-compatible endpoint — Ollama, vLLM, llama.cpp, or a private cluster — and run fully offline. Sovereign mode is managed rather than DIY.",
              },
            },
          ],
        }),
      },
    ],
  }),
});

function VsRooCodePage() {
  const rows: Array<{ feature: string; manovik: string; roo: string }> = [
    {
      feature: "Delivery model",
      manovik: "Managed hosted product + sovereign option",
      roo: "VS Code extension (self-installed)",
    },
    {
      feature: "Pricing model",
      manovik: "Lifetime — one-time payment + included credits",
      roo: "Free extension + BYO per-token API bills",
    },
    {
      feature: "Cost predictability",
      manovik: "Flat lifetime; overage priced up front",
      roo: "Variable — scales linearly with tokens",
    },
    {
      feature: "Sovereign / on-prem hosting",
      manovik: "Managed sovereign mode",
      roo: "DIY: you host the model, extension stays local",
    },
    {
      feature: "Local model support",
      manovik: "Yes (Ollama / vLLM / OpenAI-compatible)",
      roo: "Yes, via manual configuration",
    },
    {
      feature: "Key management",
      manovik: "Managed — no keys to rotate",
      roo: "You manage every provider key",
    },
    {
      feature: "Out-of-the-box experience",
      manovik: "Hosted chat UI, auth, billing, audit trail",
      roo: "Editor extension only; rest is DIY",
    },
    {
      feature: "Compliance posture",
      manovik: "Clear path to SOC2 / HIPAA / GDPR / DPDP",
      roo: "Depends on chosen model provider + your setup",
    },
  ];

  return (
    <main className="mx-auto max-w-4xl px-6 py-16 text-foreground">
      <nav className="text-sm text-muted-foreground mb-6">
        <Link to="/" className="hover:underline">
          Home
        </Link>{" "}
        / <span>vs Roo Code</span>
      </nav>

      <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">MANOVIK AI vs Roo Code</h1>
      <p className="text-lg text-muted-foreground mb-10">
        Looking for a <strong>Roo Code alternative</strong> with managed sovereign hosting and
        predictable, lifetime pricing instead of BYO-key per-token bills? Here's the honest
        head-to-head.
      </p>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-4">The 30-second summary</h2>
        <p className="leading-relaxed">
          Roo Code (formerly Roo Cline) is a capable open-source autonomous coding extension for VS
          Code, but it's a <strong>DIY setup</strong>: you install the extension, wire your own
          model keys, and pay per token forever. MANOVIK AI ships the same agentic loop as a
          <strong> fully managed product</strong> — with a hosted chat UI, optional{" "}
          <strong>managed sovereign infrastructure</strong>, and a{" "}
          <strong>one-time lifetime price</strong> instead of unpredictable API bills.
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
                <th className="text-left p-3 font-semibold">Roo Code</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.feature} className="border-t">
                  <td className="p-3 font-medium">{r.feature}</td>
                  <td className="p-3 text-emerald-600 dark:text-emerald-400">{r.manovik}</td>
                  <td className="p-3 text-muted-foreground">{r.roo}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-4">Why teams switch from Roo Code</h2>
        <ul className="space-y-3 list-disc pl-6">
          <li>
            <strong>Predictable cost:</strong> a single lifetime payment replaces unbounded
            per-token API bills from Anthropic, OpenAI, or OpenRouter.
          </li>
          <li>
            <strong>Managed sovereign hosting:</strong> a real on-prem option run for you, not a DIY
            project stitched together with a local extension.
          </li>
          <li>
            <strong>Full product, not just an extension:</strong> hosted chat UI, auth, billing, and
            audit trail out of the box — no VS Code required.
          </li>
          <li>
            <strong>Zero key management:</strong> nothing to rotate, nothing to leak from a
            developer machine.
          </li>
          <li>
            <strong>Compliance:</strong> easier path to SOC2, HIPAA, GDPR, and India's DPDP when
            inference stays on-prem.
          </li>
        </ul>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-4">When Roo Code is still a good fit</h2>
        <p className="leading-relaxed text-muted-foreground">
          Roo Code is great if you're a solo developer who wants a free extension, already lives
          inside VS Code, and is comfortable managing your own API keys and token spend. MANOVIK AI
          is the better fit when you want a managed product, sovereign infrastructure, or
          predictable lifetime pricing for a team.
        </p>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-4">FAQ</h2>
        <div className="space-y-4">
          <div>
            <h3 className="font-semibold">Is MANOVIK AI a good Roo Code alternative?</h3>
            <p className="text-muted-foreground">
              Yes — especially if you want managed sovereign hosting, predictable lifetime pricing,
              or a fully hosted product instead of a VS Code extension you wire up yourself.
            </p>
          </div>
          <div>
            <h3 className="font-semibold">Can I run MANOVIK AI fully offline?</h3>
            <p className="text-muted-foreground">
              Yes — point it at any OpenAI-compatible endpoint (Ollama, vLLM, llama.cpp) and the
              agent works with no external API calls.
            </p>
          </div>
          <div>
            <h3 className="font-semibold">Do I still need to bring my own model keys?</h3>
            <p className="text-muted-foreground">
              No. MANOVIK AI manages inference for you. Sovereign customers can plug in their own
              cluster instead — either way, there's no per-developer API-key sprawl.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border bg-card p-8 text-center">
        <h2 className="text-2xl font-bold mb-2">Try the sovereign Roo Code alternative</h2>
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
