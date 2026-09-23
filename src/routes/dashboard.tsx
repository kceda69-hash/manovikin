import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { getManovikDashboard } from "@/lib/manovik-balance.functions";
import { Button } from "@/components/ui/button";
import { ShareManovik } from "@/components/manovik/share-manovik";
import { useTheme } from "@/hooks/useTheme";
import {
  Activity,
  ArrowRight,
  Bot,
  Brain,
  ChevronRight,
  Coins,
  Flame,
  KeyRound,
  Layers,
  MessageSquare,
  Moon,
  Plus,
  Receipt,
  Settings,
  ShieldCheck,
  Sparkles,
  Sun,
  Users,
} from "lucide-react";

export const Route = createFileRoute("/dashboard")({
  component: DashboardPage,
  head: () => ({
    meta: [
      { title: "Your MANOVIK Dashboard — Credits & Usage" },
      {
        name: "description",
        content:
          "Track your MANOVIK credits, monthly usage, plan, billing history and recent account activity in one place.",
      },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Your MANOVIK Dashboard" },
      {
        property: "og:description",
        content: "Credits, usage, plan and billing history for your MANOVIK account.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function money(amount: number | null, currency: string | null) {
  if (amount == null) return "—";
  const value = amount / 100;
  return `${currency === "USD" ? "$" : "₹"}${value.toLocaleString()}`;
}

type LedgerRow = { delta: number; reason: string; created_at: string };
type PurchaseRow = {
  plan: string;
  status: string;
  amount: number | null;
  currency: string | null;
  receipt_no: string | null;
  created_at: string;
};
type AuditRow = { event_type: string; summary: string | null; created_at: string };

/* ---------------- Animated credit ring ---------------- */

function CreditRing({ credits, monthUsed }: { credits: number; monthUsed: number }) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setOn(true));
    return () => cancelAnimationFrame(raf);
  }, []);
  const total = credits + monthUsed;
  const pct = total > 0 ? Math.min(1, credits / total) : 1;
  const R = 68;
  const C = 2 * Math.PI * R;
  return (
    <div className="tilt-card hud-frame surface-card animate-fade-in relative rounded-2xl p-6">
      <span className="card-border-glow" aria-hidden />
      <div className="relative mx-auto h-44 w-44">
        <svg viewBox="0 0 160 160" className="h-full w-full -rotate-90">
          <defs>
            <linearGradient id="cmd-ring-grad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="var(--primary)" />
              <stop offset="100%" stopColor="var(--accent)" />
            </linearGradient>
          </defs>
          <circle cx="80" cy="80" r={R} fill="none" stroke="var(--muted)" strokeWidth="12" opacity="0.45" />
          <circle
            cx="80"
            cy="80"
            r={R}
            fill="none"
            stroke="url(#cmd-ring-grad)"
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={C * (1 - (on ? pct : 0))}
            style={{
              transition: "stroke-dashoffset 1.6s cubic-bezier(0.22,1,0.36,1)",
              filter: "drop-shadow(0 0 10px var(--glow))",
            }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-4xl font-bold tabular-nums">{credits}</div>
          <div className="mt-1 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            credits left
          </div>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
        <Flame className="h-3.5 w-3.5 text-primary" />
        <span className="tabular-nums">{monthUsed} used this month</span>
      </div>
    </div>
  );
}

/* ---------------- Stat cards ---------------- */

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  delay = 0,
}: {
  icon: typeof Coins;
  label: string;
  value: string | number;
  hint?: string;
  delay?: number;
}) {
  return (
    <div
      className="tilt-card hud-frame surface-card animate-fade-in relative rounded-2xl p-5"
      style={{ animationDelay: `${delay}ms` }}
    >
      <span className="card-border-glow" aria-hidden />
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="h-4 w-4 text-primary" />
        {label}
      </div>
      <div className="mt-2 text-3xl font-bold tabular-nums">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

/* ---------------- Credit intelligence ---------------- */

function CreditIntel({
  ledger,
  monthUsed,
  credits,
}: {
  ledger: LedgerRow[];
  monthUsed: number;
  credits: number;
}) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setOn(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const spendByDay = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of ledger) {
      if (row.delta >= 0) continue;
      const label = new Date(row.created_at).toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
      });
      map.set(label, (map.get(label) ?? 0) + Math.abs(row.delta));
    }
    return [...map.entries()].slice(-7);
  }, [ledger]);
  const maxDay = Math.max(1, ...spendByDay.map(([, v]) => v));

  const byReason = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of ledger) {
      if (row.delta >= 0) continue;
      const r = row.reason || "Other";
      map.set(r, (map.get(r) ?? 0) + Math.abs(row.delta));
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
  }, [ledger]);
  const maxReason = Math.max(1, ...byReason.map(([, v]) => v));

  const dayOfMonth = new Date().getDate();
  const burn = monthUsed / Math.max(1, dayOfMonth);
  const daysLeft = burn > 0 ? Math.floor(credits / burn) : null;
  const insight =
    monthUsed === 0
      ? "No credit usage yet this month — your balance is untouched."
      : `Burning ~${burn.toFixed(1)} credits/day. At this pace your ${credits} credits last ~${daysLeft ?? "—"} more days.`;

  return (
    <div
      className="tilt-card hud-frame surface-card animate-fade-in relative rounded-2xl p-6"
      style={{ animationDelay: "150ms" }}
    >
      <span className="card-border-glow" aria-hidden />
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <Activity className="h-5 w-5 text-primary" /> Credit intelligence
      </h2>

      <p className="mt-1 text-xs uppercase tracking-widest text-muted-foreground">Daily spend</p>
      {spendByDay.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">No spend data yet.</p>
      ) : (
        <div className="mt-2 flex h-32 items-end gap-2">
          {spendByDay.map(([label, v]) => (
            <div key={label} className="flex h-full flex-1 flex-col items-center gap-1">
              <div className="flex w-full flex-1 items-end">
                <div
                  className="bg-aurora w-full rounded-t-md"
                  title={`${v} credits`}
                  style={{
                    height: `${on ? Math.max(5, (v / maxDay) * 100) : 0}%`,
                    transition: "height 0.9s cubic-bezier(0.22,1,0.36,1)",
                    boxShadow: "0 0 12px var(--glow)",
                  }}
                />
              </div>
              <span className="text-[10px] text-muted-foreground">{label}</span>
            </div>
          ))}
        </div>
      )}

      {byReason.length > 0 && (
        <div className="mt-5 space-y-3">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Top spend areas</p>
          {byReason.map(([reason, v]) => (
            <div key={reason}>
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="truncate text-muted-foreground">{reason}</span>
                <span className="shrink-0 tabular-nums">{v}</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="bg-aurora h-full rounded-full"
                  style={{
                    width: `${on ? (v / maxReason) * 100 : 0}%`,
                    transition: "width 0.9s cubic-bezier(0.22,1,0.36,1)",
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-5 flex items-start gap-2 rounded-xl border border-primary/25 bg-primary/5 p-3">
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <p className="text-sm">{insight}</p>
      </div>
    </div>
  );
}

/* ---------------- Quick-action deck ---------------- */

const QUICK_ACTIONS = [
  { to: "/chat", icon: Plus, label: "New chat", desc: "Talk to MANO" },
  { to: "/billing", icon: Receipt, label: "Billing", desc: "Plans & payments" },
  { to: "/keys", icon: KeyRound, label: "API keys", desc: "Developer access" },
  { to: "/agents", icon: Bot, label: "Agents", desc: "Scheduled agents" },
  { to: "/memory", icon: Brain, label: "Memory", desc: "Knowledge base" },
  { to: "/audit", icon: ShieldCheck, label: "Audit log", desc: "Security events" },
  { to: "/team", icon: Users, label: "Team", desc: "Manage members" },
  { to: "/account", icon: Settings, label: "Account", desc: "Profile & settings" },
] as const;

function QuickActions() {
  return (
    <div
      className="tilt-card hud-frame surface-card animate-fade-in relative rounded-2xl p-6"
      style={{ animationDelay: "200ms" }}
    >
      <span className="card-border-glow" aria-hidden />
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <Plus className="h-5 w-5 text-primary" /> Quick actions
      </h2>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {QUICK_ACTIONS.map((a) => (
          <Link
            key={a.to}
            to={a.to}
            className="group flex items-center gap-3 rounded-xl border border-border/60 bg-card/40 p-3 transition-colors hover:border-primary/50"
          >
            <span className="ring-glow flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <a.icon className="h-4 w-4 text-primary" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{a.label}</span>
              <span className="block truncate text-xs text-muted-foreground">{a.desc}</span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
          </Link>
        ))}
      </div>
    </div>
  );
}

/* ---------------- Unified activity timeline ---------------- */

type TimelineKind = "credits" | "billing" | "security";
type TimelineEntry = {
  key: string;
  kind: TimelineKind;
  at: number;
  title: string;
  detail: string;
  meta: string;
  tone: "up" | "down" | "info";
};

const FILTERS = [
  { id: "all", label: "All" },
  { id: "credits", label: "Credits" },
  { id: "billing", label: "Billing" },
  { id: "security", label: "Security" },
] as const;
type FilterId = (typeof FILTERS)[number]["id"];

const KIND_ICON: Record<TimelineKind, typeof Coins> = {
  credits: Coins,
  billing: Receipt,
  security: ShieldCheck,
};
const TONE_TEXT: Record<TimelineEntry["tone"], string> = {
  up: "text-emerald-500",
  down: "text-destructive",
  info: "text-primary",
};

function ActivityTimeline({
  purchases,
  ledger,
  audit,
}: {
  purchases: PurchaseRow[];
  ledger: LedgerRow[];
  audit: AuditRow[];
}) {
  const [filter, setFilter] = useState<FilterId>("all");

  const items = useMemo<TimelineEntry[]>(() => {
    const out: TimelineEntry[] = [];
    purchases.forEach((row, i) =>
      out.push({
        key: `billing-${i}`,
        kind: "billing",
        at: new Date(row.created_at).getTime(),
        title: `${row.plan} plan`,
        detail: `${row.status}${row.receipt_no ? ` · #${row.receipt_no}` : ""}`,
        meta: money(row.amount, row.currency),
        tone: row.status === "paid" ? "up" : "info",
      }),
    );
    ledger.forEach((row, i) =>
      out.push({
        key: `credit-${i}`,
        kind: "credits",
        at: new Date(row.created_at).getTime(),
        title: `${row.delta > 0 ? "+" : ""}${row.delta} credits`,
        detail: row.reason || "Balance update",
        meta: new Date(row.created_at).toLocaleDateString(),
        tone: row.delta > 0 ? "up" : "down",
      }),
    );
    audit.forEach((row, i) =>
      out.push({
        key: `sec-${i}`,
        kind: "security",
        at: new Date(row.created_at).getTime(),
        title: row.event_type,
        detail: row.summary ?? "Security event",
        meta: new Date(row.created_at).toLocaleDateString(),
        tone: "info",
      }),
    );
    return out.sort((a, b) => b.at - a.at);
  }, [purchases, ledger, audit]);

  const counts = useMemo(
    () => ({
      all: items.length,
      credits: items.filter((e) => e.kind === "credits").length,
      billing: items.filter((e) => e.kind === "billing").length,
      security: items.filter((e) => e.kind === "security").length,
    }),
    [items],
  );
  const visible = filter === "all" ? items : items.filter((e) => e.kind === filter);

  return (
    <div
      className="tilt-card hud-frame surface-card animate-fade-in relative rounded-2xl p-6"
      style={{ animationDelay: "250ms" }}
    >
      <span className="card-border-glow" aria-hidden />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Activity className="h-5 w-5 text-primary" /> Activity stream
        </h2>
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                filter === f.id
                  ? "border-primary/60 bg-primary/15 text-primary"
                  : "border-border/60 text-muted-foreground hover:border-primary/40 hover:text-foreground"
              }`}
            >
              {f.label} · {counts[f.id]}
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">No activity yet.</p>
      ) : (
        <ul className="mt-5">
          {visible.map((e, i) => {
            const Icon = KIND_ICON[e.kind];
            const isLast = i === visible.length - 1;
            return (
              <li key={e.key} className="relative flex gap-3 pb-5 last:pb-0">
                <div className="flex flex-col items-center">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border/70 bg-card">
                    <Icon className={`h-4 w-4 ${TONE_TEXT[e.tone]}`} />
                  </span>
                  {!isLast && <span className="mt-1 w-px flex-1 bg-border/60" aria-hidden />}
                </div>
                <div className="min-w-0 flex-1 pb-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="truncate text-sm font-medium">{e.title}</span>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{e.meta}</span>
                  </div>
                  <p className="mt-0.5 break-words text-sm text-muted-foreground">{e.detail}</p>
                  <time className="mt-0.5 block text-[11px] text-muted-foreground/70">
                    {new Date(e.at).toLocaleString()}
                  </time>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/* ---------------- Plan card ---------------- */

function PlanCard({ plan, isAdmin }: { plan: string; isAdmin: boolean }) {
  return (
    <div
      className="tilt-card hud-frame surface-card animate-fade-in relative rounded-2xl p-6"
      style={{ animationDelay: "300ms" }}
    >
      <span className="card-border-glow" aria-hidden />
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Current plan</div>
          <div className="text-gradient mt-1 text-3xl font-bold">{plan}</div>
        </div>
        {isAdmin && (
          <span className="inline-flex items-center gap-1 rounded-full border border-primary/40 px-3 py-1 text-xs text-primary">
            <ShieldCheck className="h-3.5 w-3.5" /> Admin
          </span>
        )}
      </div>
      {plan === "Free" && (
        <Link to="/billing" className="mt-4 block">
          <Button variant="outline" className="w-full">
            Upgrade <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </Link>
      )}
    </div>
  );
}

/* ---------------- Page ---------------- */

function DashboardPage() {
  const fetchDashboard = useServerFn(getManovikDashboard);
  const { data, isLoading, error } = useQuery({
    queryKey: ["manovik-dashboard-page"],
    queryFn: () => fetchDashboard(),
  });
  const { theme, toggle } = useTheme();

  return (
    <main className="relative mx-auto max-w-6xl px-4 py-8 text-foreground sm:px-6 sm:py-12">
      {/* Command-center header */}
      <header className="hud-frame surface-card relative overflow-hidden rounded-3xl p-6 sm:p-8">
        <div className="mesh-aurora absolute inset-0 opacity-70" aria-hidden />
        <div className="bg-grid absolute inset-0" aria-hidden />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.25em] text-primary">
              <span className="animate-pulse-glow h-2 w-2 rounded-full bg-primary" />
              MANO // Command Center
            </div>
            <h1 className="mt-2 text-3xl font-bold sm:text-4xl">
              <span className="text-gradient">Dashboard</span>
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {data?.user.email ? data.user.email : "Your MANOVIK account at a glance."}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={toggle}
              aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Link to="/billing">
              <Button variant="outline">Billing</Button>
            </Link>
            <Link to="/chat">
              <Button className="bg-aurora text-primary-foreground glow relative overflow-hidden">
                <span className="btn-sheen" aria-hidden />
                Open chat <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {isLoading && (
        <div className="mt-6 grid gap-4 lg:grid-cols-12">
          {[
            "lg:col-span-4",
            "lg:col-span-8",
            "lg:col-span-7",
            "lg:col-span-5",
            "lg:col-span-8",
            "lg:col-span-4",
          ].map((span, i) => (
            <div key={i} className={`h-44 animate-pulse rounded-2xl bg-muted/40 ${span}`} />
          ))}
        </div>
      )}
      {error && (
        <p className="mt-10 text-destructive">
          Could not load your dashboard. Please sign in and try again.
        </p>
      )}

      {data && (
        <>
          {/* Ring + stats */}
          <div className="mt-6 grid gap-4 lg:grid-cols-12">
            <div className="lg:col-span-4">
              <CreditRing credits={data.balance.credits} monthUsed={data.balance.monthUsed} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:col-span-8">
              <StatCard
                icon={Coins}
                label="Credits left"
                value={data.balance.credits}
                hint={
                  data.balance.updatedAt
                    ? `Updated ${new Date(data.balance.updatedAt).toLocaleString()}`
                    : undefined
                }
                delay={50}
              />
              <StatCard
                icon={Flame}
                label="Used this month"
                value={data.balance.monthUsed}
                hint="Credits spent since the 1st"
                delay={100}
              />
              <StatCard icon={Layers} label="Threads" value={data.usage.threads} delay={150} />
              <StatCard icon={MessageSquare} label="Messages" value={data.usage.messages} delay={200} />
            </div>
          </div>

          {/* Intelligence + quick actions */}
          <div className="mt-4 grid gap-4 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <CreditIntel
                ledger={data.recentLedger}
                monthUsed={data.balance.monthUsed}
                credits={data.balance.credits}
              />
            </div>
            <div className="lg:col-span-5">
              <QuickActions />
            </div>
          </div>

          {/* Timeline + plan/share */}
          <div className="mt-4 grid gap-4 lg:grid-cols-12">
            <div className="lg:col-span-8">
              <ActivityTimeline
                purchases={data.purchases}
                ledger={data.recentLedger}
                audit={data.recentAudit}
              />
            </div>
            <div className="space-y-4 lg:col-span-4">
              <PlanCard plan={data.plan} isAdmin={data.user.isAdmin} />
              <div className="animate-fade-in" style={{ animationDelay: "350ms" }}>
                <ShareManovik source="dashboard" />
              </div>
            </div>
          </div>
        </>
      )}
    </main>
  );
}
