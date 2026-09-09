import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { forgetLesson, getDoctrine, listMissions, runMission, trainMano } from "@/lib/mano/agi.functions";

const TITLE = "MANO Missions — Autonomous Agent | MANOVIK";
const DESC =
  "Give MANO 1.1 a goal and it plans, picks its own tools, checks its own work, and remembers what it learned for next time.";

export const Route = createFileRoute("/missions")({
  component: MissionsPage,
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

type MissionResult = Awaited<ReturnType<typeof runMission>>;

function MissionsPage() {
  const start = useServerFn(runMission);
  const list = useServerFn(listMissions);
  const forget = useServerFn(forgetLesson);
  const train = useServerFn(trainMano);
  const doctrineFn = useServerFn(getDoctrine);
  const qc = useQueryClient();

  const [goal, setGoal] = useState("");
  const [steps, setSteps] = useState(5);
  const [result, setResult] = useState<MissionResult | null>(null);

  const history = useQuery({ queryKey: ["missions"], queryFn: () => list({}) });
  const doctrine = useQuery({ queryKey: ["mano-doctrine"], queryFn: () => doctrineFn({}) });

  const training = useMutation({
    mutationFn: () => train({}),
    onSuccess: (d: { runsUsed: number; lessonsUsed: number }) => {
      toast.success(`MANO retrained on ${d.runsUsed} missions and ${d.lessonsUsed} lessons.`);
      void qc.invalidateQueries({ queryKey: ["mano-doctrine"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const run = useMutation({
    mutationFn: () => start({ data: { goal, maxSteps: steps } }),
    onSuccess: (data) => {
      setResult(data);
      void qc.invalidateQueries({ queryKey: ["missions"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const drop = useMutation({
    mutationFn: (id: string) => forget({ data: { id } }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["missions"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">MANO Missions</h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">
        Give MANO a goal. It plans, chooses its own tools, works step by step, reviews its own result,
        and stores what it learned so the next mission starts smarter.
      </p>

      <section className="mt-8 rounded-xl border border-border bg-card p-5">
        <label className="text-sm font-medium" htmlFor="goal">
          Goal
        </label>
        <Textarea
          id="goal"
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          placeholder="e.g. Design and write the database layer for a booking app, then verify it."
          className="mt-2 min-h-32"
        />
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <label className="text-sm text-muted-foreground" htmlFor="steps">
            Max steps: <span className="font-medium text-foreground">{steps}</span>
          </label>
          <input
            id="steps"
            type="range"
            min={1}
            max={8}
            value={steps}
            onChange={(e) => setSteps(Number(e.target.value))}
            className="w-48"
          />
          <Button onClick={() => run.mutate()} disabled={run.isPending || goal.trim().length < 4}>
            {run.isPending ? "Working…" : "Run mission"}
          </Button>
        </div>
      </section>

      {result ? (
        <section className="mt-8 space-y-4">
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <span className="rounded-full border border-border px-3 py-1">Status: {result.status}</span>
            <span className="rounded-full border border-border px-3 py-1">Self-score: {result.score}/100</span>
            <span className="rounded-full border border-border px-3 py-1">Steps: {result.steps.length}</span>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="text-lg font-semibold">What MANO did</h2>
            <ol className="mt-3 space-y-3">
              {result.steps.map((s) => (
                <li key={s.idx} className="rounded-lg bg-muted/40 p-3 text-sm">
                  <div className="font-medium">
                    {s.idx}. {s.tool} · {s.ms} ms
                  </div>
                  {s.thought ? <p className="mt-1 text-muted-foreground">{s.thought}</p> : null}
                  <p className="mt-1 whitespace-pre-wrap text-muted-foreground">
                    {s.observation.slice(0, 600)}
                  </p>
                </li>
              ))}
            </ol>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="text-lg font-semibold">Result</h2>
            <pre className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed">{result.answer}</pre>
          </div>
        </section>
      ) : null}

      <section className="mt-10 grid gap-6 md:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-lg font-semibold">Recent missions</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {(history.data?.runs ?? []).map((r: any) => (
              <li key={r.id} className="flex items-start justify-between gap-3 border-b border-border/60 pb-2">
                <span className="line-clamp-2">{r.goal}</span>
                <span className="shrink-0 text-muted-foreground">{r.score ?? "–"}</span>
              </li>
            ))}
            {history.data?.runs?.length ? null : (
              <li className="text-muted-foreground">No missions yet.</li>
            )}
          </ul>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-lg font-semibold">What MANO has learned</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {(history.data?.lessons ?? []).map((l: any) => (
              <li key={l.id} className="flex items-start justify-between gap-3 border-b border-border/60 pb-2">
                <span>
                  <span className="font-medium">{l.topic}</span> — {l.lesson}
                </span>
                <button
                  type="button"
                  onClick={() => drop.mutate(l.id)}
                  className="shrink-0 text-xs text-muted-foreground underline"
                >
                  forget
                </button>
              </li>
            ))}
            {history.data?.lessons?.length ? null : (
              <li className="text-muted-foreground">Nothing learned yet — run a mission.</li>
            )}
          </ul>
        </div>
      </section>
    </main>
  );
}
