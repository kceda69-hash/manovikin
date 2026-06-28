import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/vs-github-copilot")({
  component: VsCopilotPage,
  head: () => ({
    meta: [
      { title: "MANOVIK AI vs GitHub Copilot — Sovereign Alternative" },
      {
        name: "description",
        content:
          "GitHub Copilot alternative: MANOVIK offers self-hosted AI coding, lifetime pricing, and full code privacy — no per-seat subscription.",
      },
      {
        name: "keywords",
        content:
          "GitHub Copilot alternative, self-hosted AI coding assistant, Copilot vs MANOVIK, private AI coding, lifetime AI coding",
      },
      { property: "og:title", content: "MANOVIK AI vs GitHub Copilot" },
      {
        property: "og:description",
        content:
          "Head-to-head: privacy, hosting, pricing, and TCO. Why teams pick MANOVIK over GitHub Copilot.",
      },
      { property: "og:url", content: "https://manovik.in/vs-github-copilot" },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "MANOVIK AI vs GitHub Copilot" },
      {
        name: "twitter:description",
        content: "The sovereign, lifetime-priced GitHub Copilot alternative.",
      },
    ],
    links: [{ rel: "canonical", href: "https://manovik.in/vs-github-copilot" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: [
            {
              "@type": "Question",
              name: "Is MANOVIK AI a good GitHub Copilot alternative?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Yes. MANOVIK AI gives you the same in-editor AI coding experience as GitHub Copilot, plus sovereign self-hosting, local model support, and a one-time lifetime price instead of a per-seat monthly subscription.",
              },
            },
            {
              "@type": "Question",
              name: "Does my code leave the network like with GitHub Copilot?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "No. In sovereign mode MANOVIK runs against your own Ollama / vLLM / OpenAI-compatible endpoint, so prompts and code never leave your infrastructure — unlike Copilot, which sends snippets to GitHub.",
              },
            },
            {
              "@type": "Question",
              name: "What is the total cost of ownership vs Copilot?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "GitHub Copilot Business is roughly $19 per developer per month indefinitely. MANOVIK AI is a one-time lifetime payment with included credits and optional self-hosting, so TCO over 2–3 years is dramatically lower for most teams.",
              },
            },
            {
              "@type": "Question",
              name: "Is MANOVIK AI suitable for regulated industries?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Yes. Because inference can stay fully on-prem, MANOVIK fits SOC2, HIPAA, GDPR and India's DPDP workflows more cleanly than a SaaS-only assistant.",
              },
            },
          ],
        }),
      },
    ],
  }),
});

function VsCopilotPage() {
  const rows: Array<{ feature: string; manovik: string; copilot: string }> = [
    { feature: "Pricing model", manovik: "Lifetime — one-time payment", copilot: "Per-seat monthly subscription" },
    { feature: "Sovereign / self-hosted deployment", manovik: "Yes — managed sovereign mode", copilot: "No — SaaS only" },
    { feature: "Local model support", manovik: "Yes (Ollama / vLLM / custom endpoints)", copilot: "No" },
    { feature: "Code privacy", manovik: "Repo never leaves your network in sovereign mode", copilot: "Snippets sent to GitHub for inference" },
    { feature: "Compliance posture", manovik: "On-prem path for SOC2 / HIPAA / GDPR / DPDP", copilot: "SaaS DPA only" },
    { feature: "Model choice", manovik: "Bring any OpenAI-compatible model", copilot: "GitHub-selected models" },
    { feature: "Total cost over 3 years (per dev)", manovik: "One-time lifetime fee", copilot: "~$684+ per seat" },
  ];

  return (
    <main className="mx-auto max-w-4xl px-6 py-16 text-foreground">
      <nav className="text-sm text-muted-foreground mb-6">
        <Link to="/" className="hover:underline">Home</Link> / <span>vs GitHub Copilot</span>
      </nav>

      <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
        MANOVIK AI vs GitHub Copilot
      </h1>
      <p className="text-lg text-muted-foreground mb-10">
        Looking for a <strong>GitHub Copilot alternative</strong> with sovereign hosting,
        predictable lifetime pricing, and zero data leaving your network? Here's the
        honest head-to-head.
      </p>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-4">The 30-second summary</h2>
        <p className="leading-relaxed">
          GitHub Copilot is a polished SaaS coding assistant — but every prompt and code
          snippet leaves your network, and you keep paying per developer every month.
          MANOVIK AI delivers the same in-editor experience with <strong>managed
          sovereign hosting</strong>, <strong>local model support</strong>, and a
          <strong> one-time lifetime price</strong>.
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
                <th className="text-left p-3 font-semibold">GitHub Copilot</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.feature} className="border-t">
                  <td className="p-3 font-medium">{r.feature}</td>
                  <td className="p-3 text-emerald-600 dark:text-emerald-400">{r.manovik}</td>
                  <td className="p-3 text-muted-foreground">{r.copilot}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-4">Why teams switch from GitHub Copilot</h2>
        <ul className="space-y-3 list-disc pl-6">
          <li><strong>Data privacy:</strong> in sovereign mode your code never leaves your network.</li>
          <li><strong>Predictable cost:</strong> one lifetime payment replaces a forever per-seat bill.</li>
          <li><strong>Compliance:</strong> cleaner story for SOC2, HIPAA, GDPR, and India's DPDP.</li>
          <li><strong>Model freedom:</strong> bring any OpenAI-compatible model — not just what GitHub picks.</li>
        </ul>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-4">FAQ</h2>
        <div className="space-y-4">
          <div>
            <h3 className="font-semibold">Is MANOVIK AI a good GitHub Copilot alternative?</h3>
            <p className="text-muted-foreground">Yes — especially when privacy, lifetime pricing, or on-prem hosting matter.</p>
          </div>
          <div>
            <h3 className="font-semibold">Does code leave my network?</h3>
            <p className="text-muted-foreground">Not in sovereign mode — inference happens against your own local model endpoint.</p>
          </div>
          <div>
            <h3 className="font-semibold">How does total cost of ownership compare?</h3>
            <p className="text-muted-foreground">Copilot Business is ~$19/dev/month forever. MANOVIK is one-time lifetime + optional self-hosting — usually far cheaper over 2–3 years.</p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border bg-card p-8 text-center">
        <h2 className="text-2xl font-bold mb-2">Try the sovereign Copilot alternative</h2>
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
