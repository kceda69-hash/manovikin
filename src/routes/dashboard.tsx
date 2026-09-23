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
  Coins,
  Flame,
  Hourglass,
  KeyRound,
  Layers,
  LayoutDashboard,
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
      { name: "twitter:card", content: "summary_large" },
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

/* ---------------- Dashboard style mode (JARVIS / MINIMAL) ---------------- */

type DashboardStyle = "jarvis" | "minimal";
const STYLE_KEY = "manovik:dashboard-style";

function useDashboardStyle() {
  const [style, setStyle] = useState<DashboardStyle>(() => {
    if (typeof window === "undefined") return "jarvis";
    try {
      return window.localStorage.getItem(STYLE_KEY) === "minimal" ? "minimal" : "jarvis";
    } catch {
      return "jarvis";
    }
  });
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("style-minimal", style === "minimal");
    try {
      window.localStorage.setItem(STYLE_KEY, style);
    } catch {
      /* storage unavailable — style still applies for this session */
    }
    return () => {
      root.classList.remove("style-minimal");
    };
  }, [style]);
  return { style, setStyle };
}

/* ---------------- Shared spend derivations ---------------- */

function useSpendData(ledger: LedgerRow[]) {
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
  const byReason = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of ledger) {
      if (row.delta >= 0) continue;
      const r = row.reason || "Other";
      map.set(r, (map.get(r) ?? 0) + Math.abs(row.delta));
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [ledger]);
  const totalSpent = useMemo(() => byReason.reduce((s, [, v]) => s + v, 0), [byReason]);
  return { spendByDay, byReason, totalSpent };
}

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
    <div className="tilt-card hud-frame surface-card animate-fade-in relative h-full rounded-2xl p-6">
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

/* ---------------- Credit intelligence (overview) ---------------- */

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

  const { spendByDay, byReason } = useSpendData(ledger);
  const topReasons = byReason.slice(0, 4);
  const maxDay = Math.max(1, ...spendByDay.map(([, v]) => v));
  const maxReason = Math.max(1, ...topReasons.map(([, v]) => v));

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

      {topReasons.length > 0 && (
        <div className="mt-5 space-y-3">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Top spend areas</p>
          {topReasons.map(([reason, v]) => (
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

/* ---------------- Spend analytics (intelligence tab) ---------------- */

function SpendAnalytics({
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

  const { spendByDay, byReason, totalSpent } = useSpendData(ledger);
  const maxReason = Math.max(1, ...byReason.map(([, v]) => v));
  const dayOfMonth = new Date().getDate();
  const burn = monthUsed / Math.max(1, dayOfMonth);
  const daysLeft = burn > 0 ? Math.floor(credits / burn) : null;
  const peak = spendByDay.reduce<[string, number]>(
    (m, e) => (e[1] > m[1] ? e : m),
    ["—", 0],
  );

  const tiles = [
    {
      icon: Flame,
      label: "Avg burn rate",
      value: `${burn.toFixed(1)} / day`,
      hint: `${monthUsed} used over ${dayOfMonth} day${dayOfMonth === 1 ? "" : "s"}`,
    },
    {
      icon: Hourglass,
      label: "Projected runway",
      value: daysLeft == null ? "No burn yet" : `${daysLeft} days`,
      hint: daysLeft == null ? "Credits untouched" : "At the current pace",
    },
    {
      icon: Coins,
      label: "Tracked spend",
      value: `${totalSpent}`,
      hint: `${byReason.length} categor${byReason.length === 1 ? "y" : "ies"}`,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        {tiles.map((t, i) => (
          <StatCard
            key={t.label}
            icon={t.icon}
            label={t.label}
            value={t.value}
            hint={t.hint}
            delay={i * 60}
          />
        ))}
      </div>

      <div
        className="tilt-card hud-frame surface-card animate-fade-in relative rounded-2xl p-6"
        style={{ animationDelay: "180ms" }}
      >
        <span className="card-border-glow" aria-hidden />
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Brain className="h-5 w-5 text-primary" /> Spend by category
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {peak[1] > 0 ? (
            <>
              Peak day: <span className="font-medium text-foreground">{peak[0]}</span> ·{" "}
              <span className="tabular-nums">{peak[1]} credits</span>
            </>
          ) : (
            "Category breakdown appears once credits are spent."
          )}
        </p>

        {byReason.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">No spend data yet.</p>
        ) : (
          <div className="mt-5 space-y-4">
            {byReason.map(([reason, v]) => {
              const pct = totalSpent > 0 ? Math.round((v / totalSpent) * 100) : 0;
              return (
                <div key={reason}>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="truncate text-muted-foreground">{reason}</span>
                    <span className="shrink-0 tabular-nums">
                      {v}{" "}
                      <span className="text-xs text-muted-foreground">({pct}%)</span>
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="bg-aurora h-full rounded-full"
                      style={{
                        width: `${on ? (v / maxReason) * 100 : 0}%`,
                        transition: "width 0.9s cubic-bezier(0.22,1,0.36,1)",
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------- Quick actions (command rail) ---------------- */

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

function CommandRail() {
  const btn =
    "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary";
  return (
    <>
      {/* Desktop: slim vertical command rail */}
      <nav
        aria-label="Quick actions"
        className="hud-frame surface-card fixed bottom-4 left-4 top-4 z-40 hidden w-[72px] flex-col items-center gap-1 overflow-y-auto rounded-2xl py-4 md:flex"
      >
        <span className="card-border-glow" aria-hidden />
        <Link
          to="/dashboard"
          title="Dashboard"
          aria-label="Dashboard"
          className="mb-2 flex h-11 w-11 items-center justify-center"
        >
          <span className="animate-pulse-glow h-2.5 w-2.5 rounded-full bg-primary" />
        </Link>
        {QUICK_ACTIONS.map((a) => (
          <Link
            key={a.to}
            to={a.to}
            title={`${a.label} — ${a.desc}`}
            aria-label={a.label}
            className={btn}
          >
            <a.icon className="h-5 w-5" />
          </Link>
        ))}
      </nav>

      {/* Mobile: bottom command bar */}
      <nav
        aria-label="Quick actions"
        className="hud-frame surface-card fixed bottom-3 left-3 right-3 z-40 flex items-center gap-1 overflow-x-auto rounded-2xl px-3 py-2 md:hidden"
      >
        <span className="card-border-glow" aria-hidden />
        {QUICK_ACTIONS.map((a) => (
          <Link
            key={a.to}
            to={a.to}
            title={a.label}
            aria-label={a.label}
            className={btn}
          >
            <a.icon className="h-5 w-5" />
          </Link>
        ))}
      </nav>
    </>
  );
}

/* ---------------- Top status bar ---------------- */

function TopStatusBar({
  style,
  setStyle,
  email,
}: {
  style: DashboardStyle;
  setStyle: (s: DashboardStyle) => void;
  email?: string;
}) {
  const { theme, toggle } = useTheme();
  return (
    <div className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="animate-pulse-glow h-2 w-2 shrink-0 rounded-full bg-primary" />
          <div className="min-w-0">
            <div className="cmd-eyebrow font-mono text-[11px] uppercase tracking-[0.25em] text-primary">
              MANO // Command Center
            </div>
            <div className="truncate text-xs text-muted-foreground">
              {email ?? "Dashboard"}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="seg-group" role="group" aria-label="Dashboard style">
            {(["jarvis", "minimal"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStyle(s)}
                data-active={style === s}
                aria-pressed={style === s}
                className="cmd-pill"
              >
                {s === "jarvis" ? "JARVIS" : "MINIMAL"}
              </button>
            ))}
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={toggle}
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <Link to="/billing" className="hidden sm:block">
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
      style={{ animationDelay: "100ms" }}
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
              type="button"
              onClick={() => setFilter(f.id)}
              data-active={filter === f.id}
              aria-pressed={filter === f.id}
              className="cmd-pill"
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
      style={{ animationDelay: "200ms" }}
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

/* ---------------- Tabs ---------------- */

const TABS = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "activity", label: "Activity", icon: Activity },
  { id: "intelligence", label: "Intelligence", icon: Brain },
] as const;
type TabId = (typeof TABS)[number]["id"];

/* ---------------- Page ---------------- */

function DashboardPage() {
  const fetchDashboard = useServerFn(getManovikDashboard);
  const { data, isLoading, error } = useQuery({
    queryKey: ["manovik-dashboard-page"],
    queryFn: () => fetchDashboard(),
  });
  const { style, setStyle } = useDashboardStyle();
  const [tab, setTab] = useState<TabId>("overview");

  return (
    <div className="relative min-h-screen text-foreground">
      {/* Ambient breathing backdrop (JARVIS only — hidden in minimal mode) */}
      <div className="mesh-aurora pointer-events-none fixed inset-0 opacity-30" aria-hidden />

      <CommandRail />

      <div className="relative pb-28 md:pb-0 md:pl-28">
        <TopStatusBar style={style} setStyle={setStyle} email={data?.user.email ?? undefined} />

        <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
          {isLoading && (
            <>
              <div className="grid gap-4 lg:grid-cols-12">
                <div className="h-56 animate-pulse rounded-2xl bg-muted/40 lg:col-span-3" />
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 lg:col-span-9">
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} className="h-32 animate-pulse rounded-2xl bg-muted/40" />
                  ))}
                </div>
              </div>
              <div className="mt-4 h-96 animate-pulse rounded-2xl bg-muted/40" />
            </>
          )}
          {error && (
            <p className="mt-10 text-destructive">
              Could not load your dashboard. Please sign in and try again.
            </p>
          )}

          {data && (
            <>
              {/* Hero: credit ring + headline stats */}
              <div className="grid gap-4 lg:grid-cols-12">
                <div className="lg:col-span-3">
                  <CreditRing credits={data.balance.credits} monthUsed={data.balance.monthUsed} />
                </div>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 lg:col-span-9">
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

              {/* Tabbed viewport */}
              <div
                className="mt-6 flex gap-2 overflow-x-auto pb-1"
                role="tablist"
                aria-label="Dashboard sections"
              >
                {TABS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    role="tab"
                    aria-selected={tab === t.id}
                    data-active={tab === t.id}
                    onClick={() => setTab(t.id)}
                    className="cmd-pill px-4 py-2 text-sm"
                  >
                    <t.icon className="h-4 w-4" />
                    {t.label}
                  </button>
                ))}
              </div>

              {tab === "overview" && (
                <div className="mt-4 grid gap-4 lg:grid-cols-12">
                  <div className="lg:col-span-8">
                    <CreditIntel
                      ledger={data.recentLedger}
                      monthUsed={data.balance.monthUsed}
                      credits={data.balance.credits}
                    />
                  </div>
                  <div className="space-y-4 lg:col-span-4">
                    <PlanCard plan={data.plan} isAdmin={data.user.isAdmin} />
                    <div className="animate-fade-in" style={{ animationDelay: "250ms" }}>
                      <ShareManovik source="dashboard" />
                    </div>
                  </div>
                </div>
              )}

              {tab === "activity" && (
                <div className="mt-4">
                  <ActivityTimeline
                    purchases={data.purchases}
                    ledger={data.recentLedger}
                    audit={data.recentAudit}
                  />
                </div>
              )}

              {tab === "intelligence" && (
                <div className="mt-4">
                  <SpendAnalytics
                    ledger={data.recentLedger}
                    monthUsed={data.balance.monthUsed}
                    credits={data.balance.credits}
                  />
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
