import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getManovikDashboard } from "@/lib/manovik-balance.functions";
import { Button } from "@/components/ui/button";
import { ShareManovik } from "@/components/manovik/share-manovik";
import {
  Coins,
  MessageSquare,
  Layers,
  Receipt,
  ShieldCheck,
  ArrowRight,
  Sparkles,
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

function Stat({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Coins;
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border bg-card/60 p-5 backdrop-blur">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="h-4 w-4 text-primary" />
        {label}
      </div>
      <div className="mt-2 text-3xl font-bold">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

function DashboardPage() {
  const fetchDashboard = useServerFn(getManovikDashboard);
  const { data, isLoading, error } = useQuery({
    queryKey: ["manovik-dashboard-page"],
    queryFn: () => fetchDashboard(),
  });

  return (
    <main className="mx-auto max-w-5xl px-6 py-12 text-foreground">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="mt-1 text-muted-foreground">
            {data?.user.email ? data.user.email : "Your MANOVIK account at a glance."}
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/chat">
            <Button className="bg-aurora text-primary-foreground glow">
              Open chat <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </Link>
          <Link to="/billing">
            <Button variant="outline">Billing</Button>
          </Link>
        </div>
      </div>

      {isLoading && <p className="mt-10 text-muted-foreground">Loading…</p>}
      {error && (
        <p className="mt-10 text-destructive">
          Could not load your dashboard. Please sign in and try again.
        </p>
      )}

      {data && (
        <>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat
              icon={Coins}
              label="Credits left"
              value={data.balance.credits}
              hint={
                data.balance.updatedAt
                  ? `Updated ${new Date(data.balance.updatedAt).toLocaleString()}`
                  : undefined
              }
            />
            <Stat
              icon={Sparkles}
              label="Used this month"
              value={data.balance.monthUsed}
              hint="Credits spent since the 1st"
            />
            <Stat icon={Layers} label="Threads" value={data.usage.threads} />
            <Stat icon={MessageSquare} label="Messages" value={data.usage.messages} />
          </div>

          <section className="mt-10 rounded-2xl border bg-card/60 p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-muted-foreground">Current plan</div>
                <div className="text-2xl font-bold">{data.plan}</div>
              </div>
              {data.plan === "Free" && (
                <Link to="/billing">
                  <Button variant="outline">Upgrade</Button>
                </Link>
              )}
              {data.user.isAdmin && (
                <span className="inline-flex items-center gap-1 rounded-full border border-primary/40 px-3 py-1 text-xs text-primary">
                  <ShieldCheck className="h-3.5 w-3.5" /> Admin
                </span>
              )}
            </div>
          </section>

          <div className="mt-10 grid gap-8 lg:grid-cols-2">
            <section>
              <h2 className="mb-3 flex items-center gap-2 text-xl font-semibold">
                <Receipt className="h-5 w-5 text-primary" /> Billing history
              </h2>
              <ul className="divide-y rounded-xl border">
                {data.purchases.length === 0 && (
                  <li className="p-4 text-sm text-muted-foreground">No purchases yet.</li>
                )}
                {data.purchases.map((row, i) => (
                  <li key={i} className="flex items-center justify-between gap-3 p-4 text-sm">
                    <span className="capitalize">
                      {row.plan}
                      <span className="ml-2 text-xs text-muted-foreground">{row.status}</span>
                      {row.receipt_no && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          #{row.receipt_no}
                        </span>
                      )}
                    </span>
                    <span className="text-right">
                      <span className="font-medium">{money(row.amount, row.currency)}</span>
                      <span className="block text-xs text-muted-foreground">
                        {new Date(row.created_at).toLocaleDateString()}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>

            <section>
              <h2 className="mb-3 text-xl font-semibold">Recent credit activity</h2>
              <ul className="divide-y rounded-xl border">
                {data.recentLedger.length === 0 && (
                  <li className="p-4 text-sm text-muted-foreground">No activity yet.</li>
                )}
                {data.recentLedger.map((row, i) => (
                  <li key={i} className="flex justify-between gap-3 p-4 text-sm">
                    <span>
                      <span className={row.delta < 0 ? "text-destructive" : "text-emerald-500"}>
                        {row.delta > 0 ? `+${row.delta}` : row.delta}
                      </span>{" "}
                      · {row.reason}
                    </span>
                    <span className="text-muted-foreground">
                      {new Date(row.created_at).toLocaleDateString()}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <div className="mt-10 flex flex-wrap gap-2 text-sm">
            {[
              { to: "/memory" as const, label: "Knowledge memory" },
              { to: "/agents" as const, label: "Scheduled agents" },
              { to: "/force" as const, label: "FORCE missions" },
              { to: "/team" as const, label: "Team" },
              { to: "/keys" as const, label: "API keys" },
              { to: "/account" as const, label: "Account" },
            ].map((l) => (
              <Link
                key={l.to}
                to={l.to}
                className="rounded-full border px-4 py-1.5 hover:border-primary/50 hover:text-primary"
              >
                {l.label}
              </Link>
            ))}
          </div>

          <div className="mt-8 max-w-xl">
            <ShareManovik source="dashboard" />
          </div>
        </>
      )}
    </main>
  );
}
