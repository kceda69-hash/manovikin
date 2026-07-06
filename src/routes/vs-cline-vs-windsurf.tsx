import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/vs-cline-vs-windsurf")({
  component: ClineVsWindsurfPage,
  head: () => ({
    meta: [
      { title: "Cline vs Windsurf (2026) — And Why MANOVIK Beats Both" },
      {
        name: "description",
        content:
          "Cline vs Windsurf: agentic autonomy, pricing, privacy, and IDE experience compared. Plus how MANOVIK gives you the best of both with sovereign, lifetime-priced hosting.",
      },
      {
        name: "keywords",
        content:
          "Cline vs Windsurf, Windsurf alternative, Cline alternative, agentic coding tools, MANOVIK, sovereign AI coding agent",
      },
      { property: "og:title", content: "Cline vs Windsurf — And Why MANOVIK Beats Both" },
      {
        property: "og:description",
        content:
          "Head-to-head comparison of Cline and Windsurf across autonomy, pricing, and privacy — plus the sovereign, managed alternative.",
      },
      { property: "og:url", content: "https://manovik.in/vs-cline-vs-windsurf" },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Cline vs Windsurf — 2026 comparison" },
      {
        name: "twitter:description",
        content: "Which agentic coding tool wins in 2026 — and the sovereign alternative to both.",
      },
    ],
    links: [{ rel: "canonical", href: "https://manovik.in/vs-cline-vs-windsurf" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: [
            {
              "@type": "Question",
              name: "Cline vs Windsurf — which is better in 2026?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Cline is a fully open-source VS Code extension with maximum agent autonomy and BYO model keys. Windsurf is a polished Cursor-style IDE with a managed subscription. Cline wins on transparency and cost control; Windsurf wins on out-of-the-box UX. Neither offers managed sovereign hosting — MANOVIK does.",
              },
            },
            {
              "@type": "Question",
              name: "Is Windsurf more autonomous than Cline?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Windsurf's Cascade agent and Cline's ACT mode are close in raw capability. Cline exposes more of the loop and tool calls; Windsurf hides more behind a polished UI. For deep autonomy with full visibility, most power users prefer Cline; for a smoother IDE, Windsurf.",
              },
            },
            {
              "@type": "Question",
              name: "What's a good alternative to both Cline and Windsurf?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "MANOVIK AI combines Windsurf's managed experience with Cline's transparency, adds sovereign self-hosted deployment against Ollama/vLLM, and replaces per-token API bills with a one-time lifetime price.",
              },
            },
          ],
        }),
      },
    ],
  }),
});

function ClineVsWindsurfPage() {
  const rows: Array<{ feature: string; cline: string; windsurf: string; manovik: string }> = [
    { feature: "Pricing", cline: "Free tool + BYO per-token API bills", windsurf: "Per-seat monthly subscription + usage credits", manovik: "One-time lifetime payment" },
    { feature: "Sovereign / self-hosted", cline: "Manual — you configure everything", windsurf: "No managed sovereign option", manovik: "Yes — managed sovereign mode" },
    { feature: "Local model support", cline: "Yes (Ollama, vLLM, OpenRouter, any endpoint)", windsurf: "Limited — cloud-first", manovik: "Yes (Ollama, vLLM, custom OpenAI-compatible)" },
    { feature: "Agent autonomy", cline: "High — ACT mode, full tool visibility", windsurf: "High — Cascade, more UI-polished", manovik: "High — visible agent loop, sovereign-safe" },
    { feature: "IDE experience", cline: "VS Code extension", windsurf: "Custom Cursor-style IDE", manovik: "Hosted UI + editor integrations" },
    { feature: "Code privacy", cline: "Depends on chosen model provider", windsurf: "Sent to Windsurf / model providers", manovik: "Repo never leaves your network in sovereign mode" },
    { feature: "Cost predictability", cline: "Variable — scales with token usage", windsurf: "Subscription + variable credits", manovik: "Flat lifetime + included credits" },
    { feature: "Out-of-the-box product", cline: "Extension only; you wire billing/auth", windsurf: "Full IDE, hosted account", manovik: "Hosted UI, auth, billing, audit trail" },
  ];

  return (
    <main className="mx-auto max-w-5xl px-6 py-16 text-foreground">
      <nav className="text-sm text-muted-foreground mb-6">
        <Link to="/" className="hover:underline">Home</Link> / <span>Cline vs Windsurf</span>
      </nav>

      <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
        Cline vs Windsurf (2026)
      </h1>
      <p className="text-lg text-muted-foreground mb-10">
        The two most-hyped agentic coding tools of the year, compared honestly — plus a
        sovereign, lifetime-priced alternative that beats both on privacy and cost.
      </p>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-4">The 30-second summary</h2>
        <p className="leading-relaxed">
          <strong>Cline</strong> is open-source, transparent, and BYO-model — best when you want
          maximum control and don't mind wiring up API keys and paying per token.
          <strong> Windsurf</strong> is a polished managed IDE with the Cascade agent — best when
          you want a Cursor-style experience out of the box and don't mind a subscription plus
          usage credits. Neither ships a <strong>managed sovereign deployment</strong>, which is
          exactly where <Link to="/" className="underline">MANOVIK AI</Link> wins: the same agentic
          loop, on your infrastructure, for a one-time lifetime price.
        </p>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-4">Feature comparison</h2>
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-3 font-semibold">Feature</th>
                <th className="text-left p-3 font-semibold">Cline</th>
                <th className="text-left p-3 font-semibold">Windsurf</th>
                <th className="text-left p-3 font-semibold">MANOVIK AI</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.feature} className="border-t">
                  <td className="p-3 font-medium">{r.feature}</td>
                  <td className="p-3 text-muted-foreground">{r.cline}</td>
                  <td className="p-3 text-muted-foreground">{r.windsurf}</td>
                  <td className="p-3 text-emerald-600 dark:text-emerald-400">{r.manovik}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-4">When Cline wins</h2>
        <ul className="space-y-2 list-disc pl-6 text-muted-foreground">
          <li>You want a fully open-source, auditable agent loop.</li>
          <li>You already have model API keys and want fine-grained control over tools and prompts.</li>
          <li>You live in VS Code and don't want a separate IDE.</li>
        </ul>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-4">When Windsurf wins</h2>
        <ul className="space-y-2 list-disc pl-6 text-muted-foreground">
          <li>You want a polished, opinionated agentic IDE with zero wiring.</li>
          <li>You prefer a predictable monthly subscription over per-token billing.</li>
          <li>Cascade's inline multi-file edits fit your workflow.</li>
        </ul>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-4">When MANOVIK beats both</h2>
        <ul className="space-y-3 list-disc pl-6">
          <li><strong>Sovereignty:</strong> managed self-hosted mode against Ollama/vLLM — code never leaves your network.</li>
          <li><strong>Lifetime pricing:</strong> one payment instead of forever-subscriptions or per-token bills.</li>
          <li><strong>Compliance:</strong> straightforward path to SOC2, HIPAA, GDPR, and India's DPDP.</li>
          <li><strong>Full product:</strong> hosted UI, auth, billing, audit trail, agent tools, and MCP endpoint out of the box.</li>
        </ul>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-4">FAQ</h2>
        <div className="space-y-4">
          <div>
            <h3 className="font-semibold">Cline vs Windsurf — which should I pick?</h3>
            <p className="text-muted-foreground">Pick Cline for transparency and BYO control; pick Windsurf for a polished managed IDE. Pick MANOVIK if you want sovereignty and lifetime pricing on top.</p>
          </div>
          <div>
            <h3 className="font-semibold">Is Windsurf more autonomous than Cline?</h3>
            <p className="text-muted-foreground">Comparable. Cline exposes more of the loop; Windsurf hides more behind polish. Different taste, similar capability.</p>
          </div>
          <div>
            <h3 className="font-semibold">Can I self-host any of these?</h3>
            <p className="text-muted-foreground">Cline can be pointed at local models manually. Windsurf is cloud-first. MANOVIK ships a managed sovereign mode.</p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border bg-card p-8 text-center">
        <h2 className="text-2xl font-bold mb-2">Get the sovereign alternative to Cline and Windsurf</h2>
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
