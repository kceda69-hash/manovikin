import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/vs-windsurf")({
  component: VsWindsurfPage,
  head: () => ({
    meta: [
      { title: "MANOVIK AI vs Windsurf — Sovereign Alternative" },
      {
        name: "description",
        content:
          "Windsurf alternative: MANOVIK offers sovereign self-hosting, local model support, and lifetime pricing vs Windsurf Pro's monthly plan.",
      },
      { name: "keywords", content: "windsurf ai coding agent, Windsurf alternative, Codeium Windsurf, sovereign AI IDE, self-hosted AI coding" },
      { property: "og:title", content: "MANOVIK AI vs Windsurf — Sovereign Alternative" },
      {
        property: "og:description",
        content: "Head-to-head: sovereign hosting, local models, lifetime pricing vs Windsurf Pro subscription.",
      },
      { property: "og:url", content: "https://manovik.in/vs-windsurf" },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "MANOVIK AI vs Windsurf" },
      { name: "twitter:description", content: "Sovereign, lifetime-priced Windsurf alternative." },
    ],
    links: [{ rel: "canonical", href: "https://manovik.in/vs-windsurf" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: [
            {
              "@type": "Question",
              name: "Is MANOVIK AI a good Windsurf alternative?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Yes. Windsurf (by Codeium) is a cloud-first agentic IDE. MANOVIK AI gives you the same agentic capabilities with full sovereign self-hosting, local model support, and a one-time lifetime license instead of a monthly Pro subscription.",
              },
            },
            {
              "@type": "Question",
              name: "Can I self-host MANOVIK the way I can't self-host Windsurf?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Yes. MANOVIK ships a sovereign deployment mode that runs entirely on your infrastructure with Ollama, vLLM, or any OpenAI-compatible endpoint. Windsurf Pro is cloud-only.",
              },
            },
            {
              "@type": "Question",
              name: "How does MANOVIK's lifetime price compare to Windsurf Pro?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Windsurf Pro is a monthly subscription per user (~$15/month). MANOVIK offers a lifetime plan — one payment, unlimited use, no per-seat metering — which pays back within the first year for most teams.",
              },
            },
          ],
        }),
      },
    ],
  }),
});

function VsWindsurfPage() {
  const rows: Array<{ feature: string; manovik: string; windsurf: string }> = [
    { feature: "Pricing model", manovik: "Lifetime — one-time payment", windsurf: "Subscription (Windsurf Pro, monthly per user)" },
    { feature: "Sovereign / self-hosted deployment", manovik: "Yes — full self-host on your infra", windsurf: "No — cloud-only" },
    { feature: "Local model support", manovik: "Yes (Ollama, vLLM, OpenAI-compatible)", windsurf: "Cloud models only" },
    { feature: "Code privacy", manovik: "Your repo never leaves your network in sovereign mode", windsurf: "Code processed in Codeium's cloud" },
    { feature: "Agentic capabilities", manovik: "Full multi-step agent with tool calling", windsurf: "Cascade agent (cloud)" },
    { feature: "Vendor lock-in", manovik: "Open — swap models and hosting anytime", windsurf: "Tied to Codeium cloud" },
    { feature: "Compliance posture", manovik: "SOC2, HIPAA, GDPR, DPDP friendly via on-prem", windsurf: "Depends on Codeium's cloud certifications" },
  ];

  return (
    <main className="mx-auto max-w-4xl px-6 py-16 text-foreground">
      <nav className="text-sm text-muted-foreground mb-6">
        <Link to="/" className="hover:underline">Home</Link> / <span>vs Windsurf</span>
      </nav>

      <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
        MANOVIK AI vs Windsurf
      </h1>
      <p className="text-lg text-muted-foreground mb-10">
        Evaluating <strong>Windsurf</strong>, the agentic IDE from Codeium? Here's the honest
        comparison against MANOVIK AI — a <strong>sovereign, lifetime-licensed</strong>{" "}
        alternative built for teams who need privacy and cost predictability.
      </p>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-4">The 30-second summary</h2>
        <p className="leading-relaxed">
          Windsurf's Cascade agent is impressive — but everything runs in Codeium's cloud, and
          Windsurf Pro is a per-user monthly subscription. MANOVIK AI matches its agentic
          capabilities while letting you run the entire stack on your own infrastructure with
          local models, and replaces the subscription with a one-time lifetime payment.
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
                <th className="text-left p-3 font-semibold">Windsurf</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.feature} className="border-t">
                  <td className="p-3 font-medium">{r.feature}</td>
                  <td className="p-3 text-emerald-600 dark:text-emerald-400">{r.manovik}</td>
                  <td className="p-3 text-muted-foreground">{r.windsurf}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-4">Why teams switch from Windsurf</h2>
        <ul className="space-y-3 list-disc pl-6">
          <li><strong>Sovereignty:</strong> code, prompts, and embeddings stay inside your network.</li>
          <li><strong>Total cost:</strong> a lifetime license replaces ~$180/year/user, forever.</li>
          <li><strong>Model choice:</strong> run Claude, Gemini, GPT, or local Llama/Qwen without changing IDE.</li>
          <li><strong>Compliance:</strong> on-prem inference simplifies SOC2, HIPAA, GDPR, and DPDP audits.</li>
        </ul>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-4">FAQ</h2>
        <div className="space-y-4">
          <div>
            <h3 className="font-semibold">Is MANOVIK really self-hostable?</h3>
            <p className="text-muted-foreground">Yes — sovereign mode runs the full agent, tool calling, and inference on your own hardware.</p>
          </div>
          <div>
            <h3 className="font-semibold">Does MANOVIK work offline?</h3>
            <p className="text-muted-foreground">With a local model endpoint (Ollama, vLLM, llama.cpp) MANOVIK operates entirely offline.</p>
          </div>
          <div>
            <h3 className="font-semibold">How does the lifetime price compare to Windsurf Pro?</h3>
            <p className="text-muted-foreground">Windsurf Pro is a monthly per-user subscription. MANOVIK's lifetime plan is a single payment — most teams break even inside 12 months.</p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border bg-card p-8 text-center">
        <h2 className="text-2xl font-bold mb-2">Try the sovereign Windsurf alternative</h2>
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
