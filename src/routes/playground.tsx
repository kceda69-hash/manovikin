import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { getManoCard, runManoPlayground } from "@/lib/mano/mano.functions";

const TITLE = "MANO 1.1 Playground | MANOVIK";
const DESC =
  "Run MANOVIK's own MANO 1.1 model directly: pick reasoning depth, set an operator instruction, and inspect every inference stage.";

export const Route = createFileRoute("/playground")({
  component: PlaygroundPage,
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: TITLE },
      { name: "twitter:description", content: DESC },
    ],
  }),
});

const DEPTHS = ["auto", "lite", "standard", "deep"] as const;
type Depth = (typeof DEPTHS)[number];

function PlaygroundPage() {
  const run = useServerFn(runManoPlayground);
  const card = useServerFn(getManoCard);

  const [prompt, setPrompt] = useState("");
  const [system, setSystem] = useState("");
  const [depth, setDepth] = useState<Depth>("auto");
  const [maxTokens, setMaxTokens] = useState(4000);

  const model = useQuery({ queryKey: ["mano-card"], queryFn: () => card() });

  const runMut = useMutation({
    mutationFn: () =>
      run({
        data: {
          prompt,
          ...(system.trim() ? { system: system.trim() } : {}),
          depth,
          maxTokens,
        },
      }),
    onError: (e: Error) => toast.error(e.message),
  });

  const result = runMut.data;

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight">MANO 1.1 Playground</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Direct access to MANOVIK&apos;s own model. Every request runs the full MANO cycle —
          plan, draft, adversarial review, synthesis — and reports what each stage cost.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <section className="space-y-4">
          <div>
            <label htmlFor="mano-prompt" className="mb-1 block text-sm font-medium">
              Prompt
            </label>
            <Textarea
              id="mano-prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={10}
              placeholder="Ask MANO 1.1 to build, debug, reason or research something."
            />
          </div>

          <div>
            <label htmlFor="mano-system" className="mb-1 block text-sm font-medium">
              Operator instruction <span className="text-muted-foreground">(optional)</span>
            </label>
            <Textarea
              id="mano-system"
              value={system}
              onChange={(e) => setSystem(e.target.value)}
              rows={3}
              placeholder="e.g. Answer in TypeScript only. Keep it under 40 lines."
            />
          </div>

          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label htmlFor="mano-depth" className="mb-1 block text-sm font-medium">
                Depth
              </label>
              <select
                id="mano-depth"
                value={depth}
                onChange={(e) => setDepth(e.target.value as Depth)}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                {DEPTHS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="mano-tokens" className="mb-1 block text-sm font-medium">
                Max tokens: {maxTokens}
              </label>
              <input
                id="mano-tokens"
                type="range"
                min={256}
                max={8000}
                step={256}
                value={maxTokens}
                onChange={(e) => setMaxTokens(Number(e.target.value))}
                className="w-56 accent-primary"
              />
            </div>

            <Button
              onClick={() => runMut.mutate()}
              disabled={runMut.isPending || prompt.trim().length === 0}
            >
              {runMut.isPending ? "Running MANO 1.1…" : "Run"}
            </Button>
          </div>

          {result ? (
            <article className="rounded-lg border border-border bg-card p-4">
              <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="rounded bg-muted px-2 py-1 font-mono">{result.model}</span>
                <span className="rounded bg-muted px-2 py-1">depth: {result.depth}</span>
                <span className="rounded bg-muted px-2 py-1">{result.totalMs} ms total</span>
              </div>
              <pre className="max-h-[32rem] overflow-auto whitespace-pre-wrap break-words text-sm leading-relaxed">
                {result.text}
              </pre>
            </article>
          ) : null}
        </section>

        <aside className="space-y-6">
          <div className="rounded-lg border border-border bg-card p-4">
            <h2 className="text-sm font-semibold">Model card</h2>
            <dl className="mt-3 space-y-1 text-sm text-muted-foreground">
              <div className="flex justify-between gap-2">
                <dt>Model</dt>
                <dd className="font-mono text-foreground">{model.data?.model ?? "…"}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt>Version</dt>
                <dd className="text-foreground">{model.data?.version ?? "…"}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt>Serving</dt>
                <dd className="text-foreground">{model.data?.serving ?? "…"}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt>Weights</dt>
                <dd className="text-foreground">{model.data?.weights ?? "…"}</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <h2 className="text-sm font-semibold">Stage trace</h2>
            {result ? (
              <ul className="mt-3 space-y-2 text-sm">
                {result.stages.map((s, i) => (
                  <li key={`${s.stage}-${i}`} className="flex items-baseline justify-between gap-2">
                    <span className="font-medium capitalize">{s.stage}</span>
                    <span className="text-xs text-muted-foreground">{s.ms} ms</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">
                Run a prompt to see how MANO 1.1 spent its passes.
              </p>
            )}
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <h2 className="text-sm font-semibold">Skills</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {(model.data?.skills ?? []).map((s) => (
                <li key={s.id}>
                  <span className="font-medium">{s.label}</span>
                  <p className="text-xs text-muted-foreground">{s.detail}</p>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </main>
  );
}
