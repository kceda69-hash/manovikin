import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Bot,
  Play,
  Pause,
  Trash2,
  Loader2,
  Plus,
  ChevronDown,
  Crown,
  Users,
  Clock,
  Activity,
} from "lucide-react";
import {
  createSchedule,
  deleteSchedule,
  listSchedules,
  runScheduleNow,
  toggleSchedule,
} from "@/lib/schedules.functions";
import {
  listAgentTemplates,
  listFleetAgents,
  createFleetAgent,
  setFleetAgentStatus,
  runFleetAgentNow,
  removeFleetAgent,
  fleetAgentRuns,
  listFleetProposals,
  listFleetProposalHistory,
  approveFleetProposal,
  rejectFleetProposal,
  teachFleetStudent,
  graduateFleetStudent,
  enrollFleetStudent,
  promoteFleetMentor,
  retireFleetAgent,
  getFleetWorldStats,
} from "@/lib/agent-fleet/fleet.functions";
import { describeSchedule } from "@/lib/agent-fleet/schedule";

const TITLE = "Agent Fleet — MANOVIK";
const DESC =
  "Your AI staff: hire autonomous agents with their own jobs and schedules — from the C-suite to the crew — plus your scheduled missions.";

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
  return (
    <main className="mx-auto max-w-6xl px-4 md:px-6 py-8 md:py-12 text-foreground">
      <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
        <Bot className="h-7 w-7" /> Agent Fleet
      </h1>
      <p className="text-muted-foreground mb-8">{DESC}</p>
      <Tabs defaultValue="fleet">
        <TabsList className="mb-6">
          <TabsTrigger value="fleet">Agent Fleet</TabsTrigger>
          <TabsTrigger value="schedules">Scheduled Missions</TabsTrigger>
        </TabsList>
        <TabsContent value="fleet">
          <FleetDashboard />
        </TabsContent>
        <TabsContent value="schedules">
          <SchedulesPanel />
        </TabsContent>
      </Tabs>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Fleet dashboard (new)
// ---------------------------------------------------------------------------

interface Template {
  key: string;
  name: string;
  role: string;
  job: string;
  schedule: string;
  tier: string;
}

interface FleetAgent {
  id: string;
  name: string;
  role: string;
  status: "active" | "paused";
  schedule: string;
  next_run_at: string | null;
  last_run_at: string | null;
  last_outcome: string | null;
  run_count: number;
  lifecycle_stage: "applicant" | "student" | "worker" | "mentor" | "retired";
  skills: string[];
  proposed_by: string | null;
  proposed_by_name: string | null;
  mentor_id: string | null;
  mentor_name: string | null;
}

interface Proposal {
  id: string;
  name: string;
  role: string;
  job: string;
  rationale: string;
  status: string;
  created_at: string;
  decided_at: string | null;
  decision_note: string | null;
  proposer_name: string | null;
}

const STAGE_META: Record<FleetAgent["lifecycle_stage"], { label: string; icon: string }> = {
  applicant: { label: "Applicant", icon: "📝" },
  student: { label: "Student", icon: "🎓" },
  worker: { label: "Worker", icon: "⚙️" },
  mentor: { label: "Mentor", icon: "🧙" },
  retired: { label: "Retired", icon: "🌅" },
};

function timeAgo(iso: string | null): string {
  if (!iso) return "never";
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return "just now";
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
  return `${Math.floor(ms / 86_400_000)}d ago`;
}

function TemplateCard({
  tpl,
  onHire,
  hiring,
}: {
  tpl: Template;
  onHire: (key: string) => void;
  hiring: string | null;
}) {
  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{tpl.name}</CardTitle>
        <CardDescription className="line-clamp-3">{tpl.job}</CardDescription>
      </CardHeader>
      <CardContent className="mt-auto flex items-center justify-between pt-2">
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" /> {tpl.schedule}
        </span>
        <Button size="sm" onClick={() => onHire(tpl.key)} disabled={hiring !== null}>
          {hiring === tpl.key ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Hire
        </Button>
      </CardContent>
    </Card>
  );
}

function FleetAgentCard({
  agent,
  onAction,
  busy,
}: {
  agent: FleetAgent;
  onAction: (kind: string, id: string) => void;
  busy: string | null;
}) {
  const [showRuns, setShowRuns] = useState(false);
  const fetchRuns = useServerFn(fleetAgentRuns);
  const runs = useQuery({
    queryKey: ["agent-runs", agent.id],
    queryFn: () => fetchRuns({ data: { id: agent.id, limit: 5 } }),
    enabled: showRuns,
  });
  const isBusy = busy === agent.id;
  const stage = STAGE_META[agent.lifecycle_stage];

  return (
    <Card className={agent.lifecycle_stage === "retired" ? "opacity-70" : ""}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Bot className="h-4 w-4" /> {agent.name}
            </CardTitle>
            <CardDescription>
              {agent.role}
              {agent.proposed_by_name && (
                <span className="text-muted-foreground"> · proposed by {agent.proposed_by_name}</span>
              )}
              {agent.mentor_name && agent.lifecycle_stage === "student" && (
                <span className="text-muted-foreground"> · mentored by {agent.mentor_name}</span>
              )}
            </CardDescription>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Badge variant={agent.status === "active" ? "default" : "secondary"}>{agent.status}</Badge>
            <Badge variant="outline">
              {stage.icon} {stage.label}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {describeSchedule(agent.schedule)}
          </span>
          <span className="flex items-center gap-1">
            <Activity className="h-3 w-3" />
            {agent.run_count} runs
          </span>
          <span>Last: {timeAgo(agent.last_run_at)}</span>
        </div>
        {agent.skills.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {agent.skills.map((s) => (
              <Badge key={s} variant="secondary" className="text-[10px]">
                {s}
              </Badge>
            ))}
          </div>
        )}
        {agent.last_outcome && (
          <p className="text-xs line-clamp-3 rounded bg-muted p-2">{agent.last_outcome}</p>
        )}
        <div className="flex flex-wrap gap-2">
          {(agent.lifecycle_stage === "worker" || agent.lifecycle_stage === "mentor") && (
            <>
              <Button size="sm" variant="outline" disabled={isBusy} onClick={() => onAction("run", agent.id)}>
                {isBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />} Run now
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={isBusy}
                onClick={() => onAction(agent.status === "active" ? "pause" : "resume", agent.id)}
              >
                {agent.status === "active" ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                {agent.status === "active" ? "Pause" : "Resume"}
              </Button>
            </>
          )}
          {agent.lifecycle_stage === "student" && (
            <>
              <Button size="sm" variant="outline" disabled={isBusy} onClick={() => onAction("teach", agent.id)}>
                {isBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Bot className="h-3 w-3" />} Teach
              </Button>
              <Button size="sm" variant="outline" disabled={isBusy} onClick={() => onAction("graduate", agent.id)}>
                Graduate
              </Button>
            </>
          )}
          {agent.lifecycle_stage === "applicant" && (
            <Button size="sm" variant="outline" disabled={isBusy} onClick={() => onAction("enroll", agent.id)}>
              Enroll in school
            </Button>
          )}
          {agent.lifecycle_stage === "worker" && (
            <Button size="sm" variant="outline" disabled={isBusy} onClick={() => onAction("promote", agent.id)}>
              Promote to mentor
            </Button>
          )}
          {(agent.lifecycle_stage === "worker" || agent.lifecycle_stage === "mentor") && (
            <Button size="sm" variant="outline" disabled={isBusy} onClick={() => onAction("retire", agent.id)}>
              Retire
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => setShowRuns((v) => !v)}>
            History{" "}
            <ChevronDown className={`h-3 w-3 transition-transform ${showRuns ? "rotate-180" : ""}`} />
          </Button>
          {agent.lifecycle_stage !== "retired" && (
            <Button
              size="sm"
              variant="destructive"
              disabled={isBusy}
              onClick={() => {
                if (window.confirm(`Fire "${agent.name}"? This is permanent.`)) onAction("remove", agent.id);
              }}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
        </div>
        {showRuns && (
          <div className="space-y-1 text-xs">
            {runs.isLoading && <p className="text-muted-foreground">Loading runs…</p>}
            {runs.data?.length === 0 && <p className="text-muted-foreground">No runs yet.</p>}
            {runs.data?.map((r: { id: string; status: string; answer: string | null; created_at: string }) => (
              <div key={r.id} className="rounded border p-2">
                <div className="flex justify-between">
                  <Badge variant={r.status === "done" ? "default" : "secondary"}>{r.status}</Badge>
                  <span className="text-muted-foreground">{timeAgo(r.created_at)}</span>
                </div>
                {r.answer && <p className="mt-1 line-clamp-2 text-muted-foreground">{r.answer}</p>}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function WorldStatsStrip() {
  const fetchStats = useServerFn(getFleetWorldStats);
  const stats = useQuery({ queryKey: ["fleet-world-stats"], queryFn: () => fetchStats({}) });
  const s = stats.data;
  const items = [
    { label: "Agents", value: s?.total ?? "—", icon: "🤖" },
    { label: "In school", value: s ? (s.applicants ?? 0) + (s.students ?? 0) : "—", icon: "🎓" },
    { label: "Mentors", value: s?.mentors ?? "—", icon: "🧙" },
    { label: "Pending proposals", value: s?.pendingProposals ?? "—", icon: "📝" },
    { label: "Runs today", value: s?.runsToday ?? "—", icon: "⚡" },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
      {items.map((i) => (
        <Card key={i.label}>
          <CardContent className="pt-4 pb-3 text-center">
            <div className="text-2xl font-bold">
              {i.icon} {i.value}
            </div>
            <div className="text-xs text-muted-foreground">{i.label}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function ProposalCard({
  proposal,
  onDecide,
  busy,
}: {
  proposal: Proposal;
  onDecide: (kind: "approve" | "reject", id: string) => void;
  busy: string | null;
}) {
  const isBusy = busy === proposal.id;
  return (
    <Card className="border-dashed">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Bot className="h-4 w-4" /> {proposal.name}
          <Badge variant="outline">{proposal.role}</Badge>
        </CardTitle>
        <CardDescription>
          Proposed by {proposal.proposer_name ?? "an agent"} · {timeAgo(proposal.created_at)}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-xs text-muted-foreground line-clamp-3">
          <span className="font-medium text-foreground">Job: </span>
          {proposal.job}
        </p>
        <p className="text-xs text-muted-foreground line-clamp-3">
          <span className="font-medium text-foreground">Why: </span>
          {proposal.rationale}
        </p>
        <div className="flex gap-2 pt-1">
          <Button size="sm" disabled={isBusy} onClick={() => onDecide("approve", proposal.id)}>
            {isBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : null} Approve — send to school
          </Button>
          <Button size="sm" variant="outline" disabled={isBusy} onClick={() => onDecide("reject", proposal.id)}>
            Reject
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ProposalsSection({ onChanged }: { onChanged: () => void }) {
  const queryClient = useQueryClient();
  const fetchPending = useServerFn(listFleetProposals);
  const fetchApproved = useServerFn(listFleetProposalHistory);
  const approve = useServerFn(approveFleetProposal);
  const reject = useServerFn(rejectFleetProposal);

  const pending = useQuery({ queryKey: ["fleet-proposals"], queryFn: () => fetchPending({}) });
  const [showHistory, setShowHistory] = useState(false);
  const history = useQuery({
    queryKey: ["fleet-proposal-history"],
    queryFn: async () => {
      const [a, r] = await Promise.all([
        fetchApproved({ data: { status: "approved" } }),
        fetchApproved({ data: { status: "rejected" } }),
      ]);
      return [...a, ...r].sort(
        (x, y) => new Date(y.decided_at ?? y.created_at).getTime() - new Date(x.decided_at ?? x.created_at).getTime(),
      ).slice(0, 10);
    },
    enabled: showHistory,
  });
  const [busy, setBusy] = useState<string | null>(null);

  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ["fleet-proposals"] });
    queryClient.invalidateQueries({ queryKey: ["fleet-world-stats"] });
    onChanged();
  };

  const handleDecide = async (kind: "approve" | "reject", id: string) => {
    if (kind === "reject") {
      const reason = window.prompt("Why reject this proposal? (kept in history)");
      if (!reason || !reason.trim()) return;
      setBusy(id);
      try {
        await reject({ data: { id, reason: reason.trim() } });
        toast.success("Proposal rejected.");
        refreshAll();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Reject failed");
      } finally {
        setBusy(null);
      }
      return;
    }
    setBusy(id);
    try {
      const agent = await approve({ data: { id } });
      toast.success(`"${agent.name}" born — enrolled in school.`);
      refreshAll();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Approve failed");
    } finally {
      setBusy(null);
    }
  };

  const list: Proposal[] = pending.data ?? [];
  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold flex items-center gap-2">
        📝 Hiring proposals {list.length > 0 && <Badge>{list.length} pending</Badge>}
      </h2>
      <p className="text-sm text-muted-foreground -mt-2">
        Your agents dream up new hires — nothing is born without your word.
      </p>
      {pending.isLoading && <p className="text-muted-foreground text-sm">Loading proposals…</p>}
      {!pending.isLoading && list.length === 0 && (
        <Card>
          <CardContent className="pt-6 text-muted-foreground text-sm">
            No pending proposals. When a fleet agent spots a recurring job, it will file one here.
          </CardContent>
        </Card>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        {list.map((p) => (
          <ProposalCard key={p.id} proposal={p} onDecide={handleDecide} busy={busy} />
        ))}
      </div>
      <Button size="sm" variant="ghost" onClick={() => setShowHistory((v) => !v)}>
        Past decisions{" "}
        <ChevronDown className={`h-3 w-3 transition-transform ${showHistory ? "rotate-180" : ""}`} />
      </Button>
      {showHistory && (
        <div className="space-y-2 text-sm">
          {history.isLoading && <p className="text-muted-foreground">Loading…</p>}
          {history.data?.map((p: Proposal) => (
            <div key={p.id} className="flex items-center justify-between gap-2 rounded border p-2">
              <span>
                {p.name} <span className="text-muted-foreground">({p.role})</span>
                {p.decision_note && <span className="text-muted-foreground"> — {p.decision_note}</span>}
              </span>
              <Badge variant={p.status === "approved" ? "default" : "secondary"}>{p.status}</Badge>
            </div>
          ))}
          {history.data?.length === 0 && <p className="text-muted-foreground">No past decisions.</p>}
        </div>
      )}
    </section>
  );
}

function FleetDashboard() {
  const queryClient = useQueryClient();
  const fetchTemplates = useServerFn(listAgentTemplates);
  const fetchAgents = useServerFn(listFleetAgents);
  const hireAgent = useServerFn(createFleetAgent);
  const changeStatus = useServerFn(setFleetAgentStatus);
  const runNow = useServerFn(runFleetAgentNow);
  const fire = useServerFn(removeFleetAgent);
  const teach = useServerFn(teachFleetStudent);
  const graduate = useServerFn(graduateFleetStudent);
  const enroll = useServerFn(enrollFleetStudent);
  const promote = useServerFn(promoteFleetMentor);
  const retire = useServerFn(retireFleetAgent);

  const templates = useQuery({ queryKey: ["agent-templates"], queryFn: () => fetchTemplates({}) });
  const agents = useQuery({ queryKey: ["fleet-agents"], queryFn: () => fetchAgents({}) });

  const [hiring, setHiring] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [job, setJob] = useState("");
  const [schedule, setSchedule] = useState("daily");

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["fleet-agents"] });
    queryClient.invalidateQueries({ queryKey: ["fleet-world-stats"] });
  };

  const handleHire = async (key: string) => {
    setHiring(key);
    try {
      const agent = await hireAgent({ data: { template: key } });
      toast.success(`Hired "${agent.name}" — first run scheduled.`);
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Hire failed");
    } finally {
      setHiring(null);
    }
  };

  const handleCreate = async () => {
    if (!name.trim() || job.trim().length < 4) {
      toast.error("Give your agent a name and a job (4+ characters).");
      return;
    }
    setBusy("new");
    try {
      await hireAgent({
        data: {
          name: name.trim(),
          role: role.trim() || "custom",
          job: job.trim(),
          schedule: schedule.trim() || "daily",
        },
      });
      toast.success(`Hired "${name.trim()}".`);
      setName("");
      setRole("");
      setJob("");
      setSchedule("daily");
      setFormOpen(false);
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Create failed");
    } finally {
      setBusy(null);
    }
  };

  const handleAction = async (kind: string, id: string) => {
    setBusy(id);
    try {
      if (kind === "run") {
        const r = await runNow({ data: { id } });
        toast.success(`Run ${r.status}: ${(r.summary ?? "").slice(0, 120)}`);
      } else if (kind === "pause" || kind === "resume") {
        await changeStatus({ data: { id, status: kind === "pause" ? "paused" : "active" } });
        toast.success(kind === "pause" ? "Agent paused." : "Agent resumed.");
      } else if (kind === "remove") {
        await fire({ data: { id } });
        toast.success("Agent removed.");
      } else if (kind === "teach") {
        const r = await teach({ data: { id } });
        toast.success(
          r.newSkills.length > 0
            ? `Study session done — learned: ${r.newSkills.join(", ")}`
            : "Study session done — no new skills this time.",
        );
      } else if (kind === "graduate") {
        const a = await graduate({ data: { id } });
        toast.success(`"${a.name}" graduated — now working.`);
      } else if (kind === "enroll") {
        const a = await enroll({ data: { id } });
        toast.success(`"${a.name}" enrolled in school.`);
      } else if (kind === "promote") {
        const a = await promote({ data: { id } });
        toast.success(`"${a.name}" is now a mentor.`);
      } else if (kind === "retire") {
        const reason = window.prompt("Why retire this agent? (kept in history)");
        if (!reason || !reason.trim()) {
          setBusy(null);
          return;
        }
        const a = await retire({ data: { id, reason: reason.trim() } });
        toast.success(`"${a.name}" retired.`);
      }
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(null);
    }
  };

  const leadership: Template[] = templates.data?.leadership ?? [];
  const team: Template[] = templates.data?.team ?? [];
  const list: FleetAgent[] = agents.data ?? [];

  const school = list.filter((a) => a.lifecycle_stage === "applicant" || a.lifecycle_stage === "student");
  const workers = list.filter((a) => a.lifecycle_stage === "worker");
  const mentors = list.filter((a) => a.lifecycle_stage === "mentor");
  const retired = list.filter((a) => a.lifecycle_stage === "retired");

  const stageSection = (title: string, icon: string, agents: FleetAgent[]) =>
    agents.length > 0 && (
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">
          {icon} {title} ({agents.length})
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          {agents.map((a) => (
            <FleetAgentCard key={a.id} agent={a} onAction={handleAction} busy={busy} />
          ))}
        </div>
      </section>
    );

  return (
    <div className="space-y-8">
      <WorldStatsStrip />
      <ProposalsSection onChanged={refresh} />

      <section className="space-y-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Crown className="h-5 w-5" /> Leadership
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {leadership.map((t) => (
            <TemplateCard key={t.key} tpl={t} onHire={handleHire} hiring={hiring} />
          ))}
        </div>
        <h2 className="text-lg font-semibold flex items-center gap-2 pt-2">
          <Users className="h-5 w-5" /> Team
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {team.map((t) => (
            <TemplateCard key={t.key} tpl={t} onHire={handleHire} hiring={hiring} />
          ))}
        </div>
      </section>

      <Collapsible open={formOpen} onOpenChange={setFormOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="outline">
            <Plus className="h-4 w-4" /> Build a custom agent{" "}
            <ChevronDown className={`h-4 w-4 transition-transform ${formOpen ? "rotate-180" : ""}`} />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-4">
          <Card>
            <CardContent className="space-y-3 pt-6">
              <div className="grid gap-3 sm:grid-cols-3">
                <Input
                  placeholder="Name (e.g. Deal Hunter)"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                <Input
                  placeholder="Role (e.g. researcher)"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                />
                <Input
                  placeholder='Schedule (hourly, daily, "8am", "every morning 8am")'
                  value={schedule}
                  onChange={(e) => setSchedule(e.target.value)}
                />
              </div>
              <Textarea
                placeholder="Standing job instructions — what should this agent do every run?"
                rows={4}
                value={job}
                onChange={(e) => setJob(e.target.value)}
              />
              <Button onClick={handleCreate} disabled={busy === "new"}>
                {busy === "new" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}{" "}
                Hire agent
              </Button>
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Your staff ({list.length})</h2>
        {agents.isLoading && <p className="text-muted-foreground">Loading your fleet…</p>}
        {list.length === 0 && !agents.isLoading && (
          <Card>
            <CardContent className="pt-6 text-muted-foreground">
              No agents hired yet — pick from the org chart above or build your own.
            </CardContent>
          </Card>
        )}
      </section>
      {stageSection("In school", "🎓", school)}
      {stageSection("Workers", "⚙️", workers)}
      {stageSection("Mentors", "🧙", mentors)}
      {stageSection("Retired", "🌅", retired)}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Scheduled missions (pre-existing /agents content, preserved verbatim)
// ---------------------------------------------------------------------------

function SchedulesPanel() {
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
    <div className="space-y-8">
      <section className="rounded-2xl border bg-card p-6">
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

      <section className="rounded-2xl border bg-card p-6">
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
    </div>
  );
}
