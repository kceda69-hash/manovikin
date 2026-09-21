import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/vs-replit-agent")({
  component: VsReplitAgentPage,
  head: () => ({
    meta: [
      { title: "MANOVIK AI vs Replit Agent — Sovereign, Lifetime Alternative" },
      {
        name: "description",
        content:
          "Replit Agent alternative: MANOVIK offers sovereign self-hosting, local models, and lifetime pricing vs Replit's cloud subscription.",
      },
      {
        name: "keywords",
        content:
          "replit agent alternative, ai coding agent, best ai for coding, self-hosted ai agent, sovereign ai coding, replit vs manovik",
      },
      { property: "og:title", content: "MANOVIK AI vs Replit Agent — Sovereign Alternative" },
      {
        property: "og:description",
        content:
          "Head-to-head: sovereign self-hosting, local models, and a lifetime license vs Replit Agent's cloud-only subscription.",
      },
      { property: "og:url", content: "https://manovik.in/vs-replit-agent" },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "MANOVIK AI vs Replit Agent" },
      {
        name: "twitter:description",
        content:
          "Sovereign, lifetime-licensed alternative to Replit Agent for building full-stack apps.",
      },
    ],
    links: [{ rel: "canonical", href: "https://manovik.in/vs-replit-agent" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: [
            {
              "@type": "Question",
              name: "Is MANOVIK AI a good Replit Agent alternative?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Yes. Replit Agent is a cloud-only autonomous app builder billed via Replit's subscription and effort-based usage. MANOVIK AI provides the same agentic app-building capabilities with sovereign self-hosting, local model support, and a one-time lifetime license.",
              },
            },
            {
              "@type": "Question",
              name: "Can I self-host MANOVIK the way I cannot self-host Replit Agent?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Yes. MANOVIK ships a sovereign deployment mode that runs entirely on your own infrastructure with Ollama, vLLM, or any OpenAI-compatible endpoint. Replit Agent is cloud-only and runs exclusively on Replit's platform.",
              },
            },
            {
              "@type": "Question",
              name: "How does MANOVIK's lifetime price compare to Replit's subscription?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Replit charges a monthly Core subscription plus effort-based Agent usage that compounds over time. MANOVIK's lifetime plan is a single payment with unlimited use — most builders break even within the first year.",
              },
            },
          ],
        }),
      },
    ],
  }),
});

function VsReplitAgentPage() {
  const rows: Array<{ feature: string; manovik: string; replit: string }> = [
    {
      feature: "Pricing model",
      manovik: "Lifetime — one-time payment",
      replit: "Monthly subscription + effort-based Agent usage",
    },
    {
      feature: "Sovereign / self-hosted deployment",
      manovik: "Yes — full self-host on your infra",
      replit: "No — cloud-only on Replit",
    },
    {
      feature: "Local model support",
      manovik: "Yes (Ollama, vLLM, OpenAI-compatible)",
      replit: "Cloud models only",
    },
    {
      feature: "Code privacy",
      manovik: "Your repo never leaves your network in sovereign mode",
      replit: "Code and prompts run in Replit's cloud",
    },
    {
      feature: "Agentic app building",
      manovik: "Full multi-step agent with tool calling",
      replit: "Replit Agent (cloud)",
    },
    {
      feature: "Vendor lock-in",
      manovik: "Open — swap models and hosting anytime",
      replit: "Tied to Replit's runtime and hosting",
    },
    {
      feature: "Compliance posture",
      manovik: "SOC2, HIPAA, GDPR, DPDP friendly via on-prem",
      replit: "Depends on Replit's cloud certifications",
    },
  ];

  return (
    <main className="mx-auto max-w-4xl px-6 py-16 text-foreground">
      <nav className="text-sm text-muted-foreground mb-6">
        <Link to="/" className="hover:underline">
          Home
        </Link>{" "}
        / <span>vs Replit Agent</span>
      </nav>

      <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
        MANOVIK AI vs Replit Agent
      </h1>
      <p className="text-lg text-muted-foreground mb-10">
        Evaluating <strong>Replit Agent</strong> to build full-stack apps? Here's the honest
        comparison against MANOVIK AI — a <strong>sovereign, lifetime-licensed</strong> alternative
        for teams who need privacy, portability, and predictable cost.
      </p>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-4">The 30-second summary</h2>
        <p className="leading-relaxed">
          Replit Agent is a slick way to ship apps from a prompt — but everything runs on Replit's
          cloud, and pricing stacks a monthly subscription on top of effort-based Agent usage that
          scales with every run. MANOVIK AI matches its agentic app-building capabilities while
          letting you run the entire stack on your own infrastructure with local models, and
          replaces the subscription with a one-time lifetime payment.
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
                <th className="text-left p-3 font-semibold">Replit Agent</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.feature} className="border-t">
                  <td className="p-3 font-medium">{r.feature}</td>
                  <td className="p-3 text-emerald-600 dark:text-emerald-400">{r.manovik}</td>
                  <td className="p-3 text-muted-foreground">{r.replit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-4">Why teams switch from Replit Agent</h2>
        <ul className="space-y-3 list-disc pl-6">
          <li>
            <strong>Sovereignty:</strong> code, prompts, and generated projects stay inside your
            network.
          </li>
          <li>
            <strong>Predictable cost:</strong> a lifetime license replaces stacked subscription +
            effort-based Agent fees.
          </li>
          <li>
            <strong>Model choice:</strong> run Claude, Gemini, GPT, or local Llama/Qwen instead of
            Replit's fixed cloud stack.
          </li>
          <li>
            <strong>Portability:</strong> deploy the apps you build anywhere — no lock-in to
            Replit's runtime or hosting.
          </li>
        </ul>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-4">FAQ</h2>
        <div className="space-y-4">
          <div>
            <h3 className="font-semibold">Is MANOVIK really self-hostable?</h3>
            <p className="text-muted-foreground">
              Yes — sovereign mode runs the full agent, tool calling, and inference on your own
              hardware.
            </p>
          </div>
          <div>
            <h3 className="font-semibold">Does MANOVIK work offline?</h3>
            <p className="text-muted-foreground">
              With a local model endpoint (Ollama, vLLM, llama.cpp) MANOVIK operates entirely
              offline — Replit Agent requires Replit's cloud.
            </p>
          </div>
          <div>
            <h3 className="font-semibold">How does the lifetime price compare to Replit?</h3>
            <p className="text-muted-foreground">
              Replit stacks a monthly Core subscription with effort-based Agent usage. MANOVIK's
              lifetime plan is a single payment — most builders break even inside 12 months.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border bg-card p-8 text-center">
        <h2 className="text-2xl font-bold mb-2">Try the sovereign Replit Agent alternative</h2>
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
