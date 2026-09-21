import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  createSchedule,
  deleteSchedule,
  listSchedules,
  runScheduleNow,
  toggleSchedule,
} from "@/lib/schedules.functions";

const TITLE = "MANOVIK Scheduled Agents";
const DESC =
  "Run MANOVIK missions on a schedule — hourly, daily or weekly swarm runs that work while you sleep.";

export const Route = createFileRoute("/agents")({
  component: AgentsPage,
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

function AgentsPage() {
  const qc = useQueryClient();
  const fetchAll = useServerFn(listSchedules);
  const create = useServerFn(createSchedule);
  const toggle = useServerFn(toggleSchedule);
  const remove = useServerFn(deleteSchedule);
  const runNow = useServerFn(runScheduleNow);

  const [name, setName] = useState("");
  const [objective, setObjective] = useState("");
  const [mode, setMode] = useState("research");
  const [cadence, setCadence] = useState("daily");

  const q = useQuery({ queryKey: ["schedules"], queryFn: () => fetchAll() });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["schedules"] });

  const createMut = useMutation({
    mutationFn: () =>
      create({
        data: {
          name,
          objective,
          mode: mode as "build" | "research" | "operate" | "clone",
          cadence: cadence as "hourly" | "daily" | "weekly",
        },
      }),
    onSuccess: () => {
      toast.success("Agent scheduled");
      setName("");
      setObjective("");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const runMut = useMutation({
    mutationFn: (id: string) => runNow({ data: { id } }),
    onSuccess: () => {
      toast.success("Run finished");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <main className="mx-auto max-w-4xl px-6 py-12 text-foreground">
      <h1 className="text-3xl font-bold mb-2">Scheduled Agents</h1>
      <p className="text-muted-foreground mb-8">{DESC}</p>

      <section className="rounded-2xl border bg-card p-6 mb-8">
        <h2 className="font-semibold mb-4">New scheduled mission</h2>
        <Input
          placeholder="Name — e.g. Weekly competitor sweep"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mb-3"
        />
        <Textarea
          placeholder="Objective for the agent swarm…"
          rows={5}
          value={objective}
          onChange={(e) => setObjective(e.target.value)}
          className="mb-3"
        />
        <div className="flex flex-wrap gap-3 mb-4">
          <select
            aria-label="Mode"
            className="h-10 rounded-md border bg-background px-3 text-sm"
            value={mode}
            onChange={(e) => setMode(e.target.value)}
          >
            {["research", "build", "operate", "clone"].map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <select
            aria-label="Cadence"
            className="h-10 rounded-md border bg-background px-3 text-sm"
            value={cadence}
            onChange={(e) => setCadence(e.target.value)}
          >
            {["hourly", "daily", "weekly"].map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <Button
          onClick={() => createMut.mutate()}
          disabled={createMut.isPending || !name.trim() || objective.trim().length < 5}
        >
          {createMut.isPending ? "Scheduling…" : "Schedule agent"}
        </Button>
      </section>

      <section className="rounded-2xl border bg-card p-6 mb-8">
        <h2 className="font-semibold mb-4">Your agents</h2>
        {q.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {q.data?.schedules.length === 0 && (
          <p className="text-sm text-muted-foreground">No scheduled agents yet.</p>
        )}
        <ul className="divide-y">
          {q.data?.schedules.map((s) => (
            <li key={s.id} className="py-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="font-medium">{s.name}</div>
                  <p className="text-sm text-muted-foreground line-clamp-2">{s.objective}</p>
                  <div className="text-xs text-muted-foreground mt-1">
                    {s.mode} · {s.cadence} · {s.run_count} runs · next{" "}
                    {new Date(s.next_run_at).toLocaleString()}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Switch
                    checked={s.enabled}
                    aria-label={`Enable ${s.name}`}
                    onCheckedChange={async (v) => {
                      await toggle({ data: { id: s.id, enabled: v } });
                      invalidate();
                    }}
                  />
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={runMut.isPending}
                    onClick={() => runMut.mutate(s.id)}
                  >
                    Run now
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={`Delete ${s.name}`}
                    onClick={async () => {
                      await remove({ data: { id: s.id } });
                      invalidate();
                    }}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border bg-card p-6">
        <h2 className="font-semibold mb-4">Recent runs</h2>
        {q.data?.runs.length === 0 && <p className="text-sm text-muted-foreground">No runs yet.</p>}
        <ul className="space-y-3">
          {q.data?.runs.map((r) => (
            <li key={r.id} className="rounded-lg border p-4">
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>{r.status}</span>
                <span>{new Date(r.created_at).toLocaleString()}</span>
              </div>
              <p className="text-sm whitespace-pre-wrap">
                {(r.error ?? r.result ?? "").slice(0, 1200) || "—"}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
