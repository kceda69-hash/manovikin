import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/vs-devin")({
  component: VsDevinPage,
  head: () => ({
    meta: [
      { title: "MANOVIK AI vs Devin — Sovereign Autonomous Coding Agent" },
      {
        name: "description",
        content:
          "Devin AI alternative: MANOVIK is a sovereign, self-hostable autonomous coding agent with lifetime pricing vs Devin's SaaS-only subscription.",
      },
      {
        name: "keywords",
        content:
          "devin ai alternative, autonomous coding agent, ai software engineer, cognition devin, self-hosted ai agent, sovereign ai coding, devin vs manovik",
      },
      { property: "og:title", content: "MANOVIK AI vs Devin — Sovereign Autonomous Agent" },
      {
        property: "og:description",
        content:
          "Autonomous coding agent, self-hostable and lifetime-priced — the sovereign alternative to Cognition's Devin.",
      },
      { property: "og:url", content: "https://manovik.in/vs-devin" },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "MANOVIK AI vs Devin" },
      {
        name: "twitter:description",
        content:
          "Sovereign, self-hostable autonomous coding agent — a lifetime-licensed Devin alternative.",
      },
    ],
    links: [{ rel: "canonical", href: "https://manovik.in/vs-devin" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: [
            {
              "@type": "Question",
              name: "Is MANOVIK AI a real Devin alternative?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Yes. Devin (by Cognition) is an autonomous AI software engineer that runs entirely in Cognition's cloud. MANOVIK matches the autonomous agent workflow — plan, code, run, iterate — but ships a sovereign mode you can self-host, plus a lifetime license instead of a per-seat monthly subscription.",
              },
            },
            {
              "@type": "Question",
              name: "Can I self-host MANOVIK the way I can't self-host Devin?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Yes. MANOVIK runs on your infra with Ollama, vLLM, or any OpenAI-compatible endpoint. Devin is SaaS-only — your repos, prompts, and execution traces live in Cognition's cloud.",
              },
            },
            {
              "@type": "Question",
              name: "How does MANOVIK's lifetime price compare to Devin?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Devin is sold as a monthly subscription (~$500/seat/month for the Team tier). MANOVIK is a one-time lifetime payment — most teams break even in the first month.",
              },
            },
          ],
        }),
      },
    ],
  }),
});

function VsDevinPage() {
  const rows: Array<{ feature: string; manovik: string; devin: string }> = [
    {
      feature: "Pricing model",
      manovik: "Lifetime — one-time payment",
      devin: "Subscription (~$500/seat/mo Team tier)",
    },
    {
      feature: "Sovereign / self-hosted deployment",
      manovik: "Yes — full self-host on your infra",
      devin: "No — SaaS only",
    },
    {
      feature: "Autonomous agent loop",
      manovik: "Plan → code → run → verify, with tool calling",
      devin: "Yes — autonomous 'AI software engineer'",
    },
    {
      feature: "Local model support",
      manovik: "Yes (Ollama, vLLM, OpenAI-compatible)",
      devin: "Cognition cloud only",
    },
    {
      feature: "Code privacy",
      manovik: "Repos never leave your network in sovereign mode",
      devin: "Code, prompts, and runs live in Cognition cloud",
    },
    {
      feature: "Model choice",
      manovik: "GPT, Claude, Gemini, or local Llama/Qwen",
      devin: "Cognition-chosen models, not user-swappable",
    },
    {
      feature: "Compliance posture",
      manovik: "SOC2, HIPAA, GDPR, DPDP friendly via on-prem",
      devin: "Depends on Cognition's cloud certifications",
    },
    {
      feature: "Cost predictability",
      manovik: "Flat lifetime cost, unlimited use",
      devin: "Per-seat monthly + usage overages",
    },
  ];

  return (
    <main className="mx-auto max-w-4xl px-6 py-16 text-foreground">
      <nav className="text-sm text-muted-foreground mb-6">
        <Link to="/" className="hover:underline">
          Home
        </Link>{" "}
        / <span>vs Devin</span>
      </nav>

      <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">MANOVIK AI vs Devin</h1>
      <p className="text-lg text-muted-foreground mb-10">
        Considering <strong>Devin</strong>, Cognition's autonomous AI software engineer? Here's an
        honest side-by-side with MANOVIK AI — a{" "}
        <strong>sovereign, self-hostable, lifetime-licensed</strong> autonomous coding agent built
        for teams that can't send their codebase to a third-party cloud.
      </p>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-4">The 30-second summary</h2>
        <p className="leading-relaxed">
          Devin popularised the "AI employee" pitch — an agent that plans, writes, runs, and debugs
          code end to end. MANOVIK gives you the same autonomous loop, but the entire stack (agent,
          tools, and models) can run inside your network. And instead of a per-seat monthly
          subscription, MANOVIK is a one-time lifetime payment.
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
                <th className="text-left p-3 font-semibold">Devin</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.feature} className="border-t">
                  <td className="p-3 font-medium">{r.feature}</td>
                  <td className="p-3 text-emerald-600 dark:text-emerald-400">{r.manovik}</td>
                  <td className="p-3 text-muted-foreground">{r.devin}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-4">When Devin wins</h2>
        <ul className="space-y-3 list-disc pl-6">
          <li>You're OK sending your repo, prompts, and run traces to a third-party cloud.</li>
          <li>You want a fully managed sandbox and don't want to run any infrastructure.</li>
          <li>Per-seat monthly billing fits your procurement flow.</li>
        </ul>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-4">When MANOVIK beats Devin</h2>
        <ul className="space-y-3 list-disc pl-6">
          <li>
            <strong>Sovereignty:</strong> code, prompts, and embeddings stay inside your network.
          </li>
          <li>
            <strong>Total cost:</strong> a lifetime license replaces $500+/seat/month, forever.
          </li>
          <li>
            <strong>Model choice:</strong> pick GPT, Claude, Gemini, or a local Llama/Qwen without
            switching agent.
          </li>
          <li>
            <strong>Compliance:</strong> on-prem inference simplifies SOC2, HIPAA, GDPR, and DPDP
            audits.
          </li>
          <li>
            <strong>No lock-in:</strong> swap models and hosting anytime — nothing is tied to
            Cognition's cloud.
          </li>
        </ul>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-4">FAQ</h2>
        <div className="space-y-4">
          <div>
            <h3 className="font-semibold">Is MANOVIK really autonomous like Devin?</h3>
            <p className="text-muted-foreground">
              Yes — MANOVIK runs a full plan/code/run/verify loop with tool calling, not just
              autocomplete.
            </p>
          </div>
          <div>
            <h3 className="font-semibold">Does MANOVIK work offline?</h3>
            <p className="text-muted-foreground">
              With a local model endpoint (Ollama, vLLM, llama.cpp) MANOVIK operates entirely
              offline.
            </p>
          </div>
          <div>
            <h3 className="font-semibold">How does the lifetime price compare to Devin?</h3>
            <p className="text-muted-foreground">
              Devin is per-seat monthly (~$500/seat on Team). MANOVIK is a single lifetime payment —
              most teams break even in the first month.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border bg-card p-8 text-center">
        <h2 className="text-2xl font-bold mb-2">Try the sovereign Devin alternative</h2>
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
