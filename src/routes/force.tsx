import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import {
  Atom,
  CheckCircle2,
  CircleAlert,
  GitFork,
  Loader2,
  Play,
  ShieldCheck,
  Trash2,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  FORCE_MODES,
  RISK_TONE,
  type ForceMode,
  type ProofItem,
  type ProposedAction,
} from "@/lib/force/types";
import {
  startForceRun,
  listForceRuns,
  getForceRun,
  deleteForceRun,
} from "@/lib/force.functions";
import { listDevices, sendDeviceCommand } from "@/lib/devices.functions";

export const Route = createFileRoute("/force")({
  head: () => ({
    meta: [
      { title: "MANOVIK FORCE — Parallel AI Agent Swarm" },
      {
        name: "description",
        content:
          "Run four specialist AI agents on one objective in parallel, cross-reviewed by an adversary and merged into proof-carrying output you can rewind, fork and approve.",
      },
      { property: "og:title", content: "MANOVIK FORCE — parallel agent swarm" },
      {
        property: "og:description",
        content: "Four agents, one objective, adversarial review and proof-carrying results.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ForcePage,
});

const STATUS_ICON = {
  verified: <CheckCircle2 className="h-4 w-4 text-emerald-500" aria-hidden />,
  unverified: <CircleAlert className="h-4 w-4 text-amber-500" aria-hidden />,
  failed: <XCircle className="h-4 w-4 text-destructive" aria-hidden />,
} as const;

function ProofRow({ item }: { item: ProofItem }) {
  return (
    <li className="flex gap-3 rounded-md border border-border/60 p-3">
      <span className="mt-0.5 shrink-0">{STATUS_ICON[item.status]}</span>
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{item.check}</p>
        <pre className="mt-1 overflow-x-auto rounded bg-muted/60 p-2 text-xs text-muted-foreground">
          {item.how}
        </pre>
      </div>
    </li>
  );
}

function ForcePage() {
  const qc = useQueryClient();
  const launch = useServerFn(startForceRun);
  const fetchRuns = useServerFn(listForceRuns);
  const fetchRun = useServerFn(getForceRun);
  const removeRun = useServerFn(deleteForceRun);
  const fetchDevices = useServerFn(listDevices);
  const dispatch = useServerFn(sendDeviceCommand);

  const [objective, setObjective] = useState("");
  const [mode, setMode] = useState<ForceMode>("build");
  const [agents, setAgents] = useState(4);
  const [activeId, setActiveId] = useState<string | null>(null);

  const runs = useQuery({ queryKey: ["force-runs"], queryFn: () => fetchRuns({}) });
  const active = useQuery({
    queryKey: ["force-run", activeId],
    queryFn: () => fetchRun({ data: { id: activeId! } }),
    enabled: !!activeId,
  });
  const devices = useQuery({ queryKey: ["devices"], queryFn: () => fetchDevices({}) });

  const start = useMutation({
    mutationFn: (vars: { objective: string; parentRunId?: string | null; forkFromStep?: number | null }) =>
      launch({
        data: {
          objective: vars.objective,
          mode,
          agents,
          parentRunId: vars.parentRunId ?? null,
          forkFromStep: vars.forkFromStep ?? null,
        },
      }),
    onSuccess: (res) => {
      setActiveId(res.runId);
      qc.invalidateQueries({ queryKey: ["force-runs"] });
      if (res.error) toast.error(res.error);
      else toast.success("Swarm finished");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: (id: string) => removeRun({ data: { id } }),
    onSuccess: (_r, id) => {
      if (activeId === id) setActiveId(null);
      qc.invalidateQueries({ queryKey: ["force-runs"] });
    },
  });

  const pairedDevices = useMemo(
    () => (devices.data ?? []).filter((d) => d.paired_at),
    [devices.data],
  );

  const approve = async (action: ProposedAction) => {
    const device = pairedDevices[0];
    if (!device) {
      toast.error("Pair a device first on the Devices page.");
      return;
    }
    try {
      await dispatch({ data: { deviceId: device.id, kind: action.kind, command: action.command } });
      toast.success(`Queued on ${device.name}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not queue action");
    }
  };

  const run = active.data?.run;
  const busy = start.isPending;

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10">
      <header className="mb-8">
        <Badge variant="outline" className="mb-3 gap-1.5">
          <Atom className="h-3.5 w-3.5" aria-hidden /> New in MANOVIK
        </Badge>
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          MANOVIK FORCE
        </h1>
        <p className="mt-3 max-w-3xl text-muted-foreground">
          Four specialist agents attack the same objective in parallel, a hostile reviewer scores
          every draft, and the merged deliverable must carry machine-checkable proof. Every phase is
          snapshotted, so you can rewind and fork any decision — and no action ever touches your
          devices without your approval.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Launch a mission</CardTitle>
              <CardDescription>Describe the outcome, not the steps.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                value={objective}
                onChange={(e) => setObjective(e.target.value)}
                placeholder="Build a rate-limited webhook receiver with replay protection and tests…"
                rows={5}
                aria-label="Mission objective"
              />
              <div className="grid grid-cols-2 gap-2">
                {FORCE_MODES.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMode(m.id)}
                    aria-pressed={mode === m.id}
                    title={m.blurb}
                    className={`rounded-md border px-3 py-2 text-left text-xs transition-colors ${
                      mode === m.id
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border text-muted-foreground hover:bg-accent"
                    }`}
                  >
                    <span className="block font-medium">{m.label}</span>
                    <span className="mt-0.5 block leading-snug opacity-80">{m.blurb}</span>
                  </button>
                ))}
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <label htmlFor="force-agents">Agents in swarm</label>
                <input
                  id="force-agents"
                  type="range"
                  min={2}
                  max={4}
                  value={agents}
                  onChange={(e) => setAgents(Number(e.target.value))}
                  className="w-28"
                />
                <span className="font-mono text-foreground">{agents}</span>
              </div>
              <Button
                className="w-full"
                disabled={busy || objective.trim().length < 8}
                onClick={() => start.mutate({ objective })}
              >
                {busy ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> Swarm running…
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" aria-hidden /> Deploy the force
                  </>
                )}
              </Button>
              <p className="flex items-start gap-2 text-[11px] leading-snug text-muted-foreground">
                <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" aria-hidden />
                Privacy shield: agents never request credentials or personal data, and device
                actions are proposals until you approve them.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Recent missions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {(runs.data ?? []).length === 0 && (
                <p className="text-sm text-muted-foreground">No missions yet.</p>
              )}
              {(runs.data ?? []).map((r) => (
                <div
                  key={r.id}
                  className={`flex items-start gap-2 rounded-md border p-2 ${
                    activeId === r.id ? "border-primary bg-primary/5" : "border-border"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setActiveId(r.id)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <span className="line-clamp-2 text-xs text-foreground">{r.objective}</span>
                    <span className="mt-1 flex items-center gap-2 text-[10px] uppercase tracking-wide text-muted-foreground">
                      {r.mode}
                      {r.parent_run_id ? " · fork" : ""}
                      {typeof r.score === "number" ? ` · ${r.score}%` : ""}
                    </span>
                  </button>
                  <button
                    type="button"
                    aria-label="Delete mission"
                    onClick={() => del.mutate(r.id)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <section aria-live="polite">
          {!run && (
            <Card className="h-full">
              <CardContent className="flex h-full min-h-64 items-center justify-center p-10 text-center text-sm text-muted-foreground">
                {busy
                  ? "Recon → swarm → adversarial review → synthesis. This takes a minute."
                  : "Launch a mission or pick one from the list to see the full swarm output."}
              </CardContent>
            </Card>
          )}

          {run && (
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{run.mode}</Badge>
                  {typeof run.score === "number" && (
                    <Badge variant="secondary">Confidence {run.score}%</Badge>
                  )}
                  <Badge variant={run.status === "failed" ? "destructive" : "outline"}>
                    {run.status}
                  </Badge>
                </div>
                <CardTitle className="mt-2 text-lg">{run.objective}</CardTitle>
                {run.error && <CardDescription className="text-destructive">{run.error}</CardDescription>}
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="answer">
                  <TabsList className="flex-wrap">
                    <TabsTrigger value="answer">Deliverable</TabsTrigger>
                    <TabsTrigger value="agents">
                      Agents ({active.data?.agents.length ?? 0})
                    </TabsTrigger>
                    <TabsTrigger value="proof">Proof ({run.proof?.length ?? 0})</TabsTrigger>
                    <TabsTrigger value="actions">Actions ({run.actions?.length ?? 0})</TabsTrigger>
                    <TabsTrigger value="timeline">Timeline</TabsTrigger>
                  </TabsList>

                  <TabsContent value="answer" className="mt-4">
                    <div className="prose prose-sm max-w-none dark:prose-invert">
                      <ReactMarkdown>{run.answer ?? "_No deliverable produced._"}</ReactMarkdown>
                    </div>
                  </TabsContent>

                  <TabsContent value="agents" className="mt-4 space-y-4">
                    {(active.data?.agents ?? []).map((a) => (
                      <div key={a.role} className="rounded-lg border border-border p-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-sm font-semibold text-foreground">{a.role}</h3>
                          <Badge variant="secondary">{a.score}/100</Badge>
                          <span className="font-mono text-[10px] text-muted-foreground">{a.model}</span>
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">
                          <strong className="text-foreground">Adversary:</strong> {a.critique}
                        </p>
                        <details className="mt-2">
                          <summary className="cursor-pointer text-xs text-primary">
                            Read this agent&apos;s full draft
                          </summary>
                          <div className="prose prose-sm mt-2 max-w-none dark:prose-invert">
                            <ReactMarkdown>{a.output}</ReactMarkdown>
                          </div>
                        </details>
                      </div>
                    ))}
                  </TabsContent>

                  <TabsContent value="proof" className="mt-4">
                    {run.proof?.length ? (
                      <ul className="space-y-2">
                        {run.proof.map((p, i) => (
                          <ProofRow key={i} item={p} />
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-muted-foreground">No proof attached to this run.</p>
                    )}
                  </TabsContent>

                  <TabsContent value="actions" className="mt-4 space-y-3">
                    {run.actions?.length ? (
                      run.actions.map((a, i) => (
                        <div key={i} className="rounded-lg border border-border p-4">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium text-foreground">{a.label}</span>
                            <Badge variant="outline" className={RISK_TONE[a.risk]}>
                              {a.risk} risk
                            </Badge>
                            <Badge variant="secondary">{a.kind}</Badge>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">{a.why}</p>
                          <pre className="mt-2 overflow-x-auto rounded bg-muted/60 p-2 text-xs">
                            {a.command}
                          </pre>
                          <Button
                            size="sm"
                            variant="outline"
                            className="mt-3"
                            onClick={() => approve(a)}
                          >
                            Approve &amp; queue on my device
                          </Button>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        This mission proposed no device actions.
                      </p>
                    )}
                    {pairedDevices.length === 0 && (
                      <p className="text-xs text-muted-foreground">
                        No paired device yet — pair one on the Devices page to run approved actions.
                      </p>
                    )}
                  </TabsContent>

                  <TabsContent value="timeline" className="mt-4 space-y-2">
                    {(active.data?.steps ?? []).map((s) => (
                      <div
                        key={s.idx}
                        className="flex items-center justify-between gap-3 rounded-md border border-border p-3"
                      >
                        <div className="min-w-0">
                          <p className="text-sm text-foreground">{s.label}</p>
                          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                            step {s.idx} · {s.phase}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={busy}
                          onClick={() =>
                            start.mutate({
                              objective: `${run.objective}\n\n[Fork from step ${s.idx} — ${s.phase}: ${s.label}. Take a different approach from this point onward.]`,
                              parentRunId: run.id,
                              forkFromStep: s.idx,
                            })
                          }
                        >
                          <GitFork className="mr-1.5 h-3.5 w-3.5" aria-hidden /> Fork here
                        </Button>
                      </div>
                    ))}
                    {(active.data?.steps ?? []).length === 0 && (
                      <p className="text-sm text-muted-foreground">No timeline recorded.</p>
                    )}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          )}
        </section>
      </div>
    </main>
  );
}
