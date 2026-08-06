import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowLeft, Loader2, Search, CheckCircle2, AlertCircle, RefreshCw, UploadCloud, BellRing, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import {
  getSeoHealth,
  submitSitemap,
  verifySite,
  getSeoMonitor,
  runSeoMonitorNow,
  acknowledgeSeoAlert,
} from "@/lib/seo.functions";

export const Route = createFileRoute("/seo")({
  component: SeoPage,
  head: () => ({
    meta: [
      { title: "MANOVIK AI — SEO health" },
      { name: "description", content: "Monitor Google Search Console health for manovik.in: indexing, sitemaps, clicks, and impressions." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

type Health = Awaited<ReturnType<typeof getSeoHealth>>;

function SeoPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<Health | null>(null);
  const [busy, setBusy] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, user, navigate]);

  const load = async () => {
    setBusy(true);
    try {
      const h = await getSeoHealth();
      setData(h);
    } catch (e) {
      toast.error("Failed to load SEO health", { description: String(e) });
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (user) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const onVerify = async () => {
    setActing("verify");
    try {
      const r = await verifySite();
      if (r.verified) toast.success("Site verified with Google");
      else toast.error("Verification failed", { description: JSON.stringify(r.error).slice(0, 200) });
      await load();
    } finally {
      setActing(null);
    }
  };

  const onResubmit = async () => {
    setActing("submit");
    try {
      const r = await submitSitemap();
      if (r.ok) toast.success("Sitemap submitted to Google");
      else toast.error("Sitemap submit failed", { description: `Status ${r.status}` });
      await load();
    } finally {
      setActing(null);
    }
  };

  const totalsRow = (data?.totals as { rows?: Array<{ clicks: number; impressions: number; ctr: number; position: number }> } | null)?.rows?.[0];
  const sitemaps = (data?.sitemaps as { sitemap?: Array<{ path: string; lastSubmitted?: string; isPending?: boolean; errors?: number; warnings?: number }> } | null)?.sitemap ?? [];
  const topQueries = (data?.topQueries as { rows?: Array<{ keys: string[]; clicks: number; impressions: number; position: number }> } | null)?.rows ?? [];
  const topPages = (data?.topPages as { rows?: Array<{ keys: string[]; clicks: number; impressions: number; position: number }> } | null)?.rows ?? [];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60 px-4 py-3 flex items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link to="/">
            <ArrowLeft className="size-4 mr-1" /> Back
          </Link>
        </Button>
        <div className="flex items-center gap-2">
          <Search className="size-5 text-primary" />
          <h1 className="text-lg font-semibold">SEO health</h1>
        </div>
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="outline" onClick={load} disabled={busy}>
            <RefreshCw className={`size-4 mr-1 ${busy ? "animate-spin" : ""}`} /> Refresh
          </Button>
          <Button size="sm" variant="outline" onClick={onVerify} disabled={!!acting}>
            {acting === "verify" ? <Loader2 className="size-4 mr-1 animate-spin" /> : <CheckCircle2 className="size-4 mr-1" />}
            Verify
          </Button>
          <Button size="sm" onClick={onResubmit} disabled={!!acting}>
            {acting === "submit" ? <Loader2 className="size-4 mr-1 animate-spin" /> : <UploadCloud className="size-4 mr-1" />}
            Submit sitemap
          </Button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-4 space-y-4">
        {busy && !data ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading…
          </div>
        ) : !data ? (
          <p className="text-muted-foreground text-sm">No data.</p>
        ) : (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  {data.verified ? (
                    <><CheckCircle2 className="size-4 text-primary" /> Verified — {data.site}</>
                  ) : (
                    <><AlertCircle className="size-4 text-destructive" /> Not yet verified — {data.site}</>
                  )}
                </CardTitle>
                <CardDescription>
                  Range: {data.range.startDate} → {data.range.endDate}
                </CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Metric label="Clicks" value={totalsRow?.clicks ?? 0} />
                <Metric label="Impressions" value={totalsRow?.impressions ?? 0} />
                <Metric label="CTR" value={totalsRow ? `${(totalsRow.ctr * 100).toFixed(2)}%` : "—"} />
                <Metric label="Avg position" value={totalsRow ? totalsRow.position.toFixed(1) : "—"} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base"><h2>Sitemaps</h2></CardTitle>
              </CardHeader>
              <CardContent>
                {sitemaps.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No sitemaps submitted yet. Click "Submit sitemap".</p>
                ) : (
                  <ul className="divide-y divide-border/60 text-sm">
                    {sitemaps.map((s) => (
                      <li key={s.path} className="py-2 flex items-center justify-between gap-3">
                        <span className="truncate">{s.path}</span>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {s.lastSubmitted ? new Date(s.lastSubmitted).toLocaleString() : "—"}
                          {s.errors ? ` • ${s.errors} errors` : ""}
                          {s.warnings ? ` • ${s.warnings} warnings` : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <div className="grid md:grid-cols-2 gap-4">
              <Card>
                <CardHeader><CardTitle className="text-base"><h2>Top queries</h2></CardTitle></CardHeader>
                <CardContent>
                  <Table rows={topQueries} />
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-base"><h2>Top pages</h2></CardTitle></CardHeader>
                <CardContent>
                  <Table rows={topPages} />
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-border/60 p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function Table({ rows }: { rows: Array<{ keys: string[]; clicks: number; impressions: number; position: number }> }) {
  if (!rows.length) return <p className="text-sm text-muted-foreground">No data yet.</p>;
  return (
    <ul className="divide-y divide-border/60 text-sm">
      {rows.map((r) => (
        <li key={r.keys.join("|")} className="py-2 flex items-center justify-between gap-3">
          <span className="truncate">{r.keys[0]}</span>
          <span className="text-xs text-muted-foreground shrink-0 tabular-nums">
            {r.clicks} clicks • {r.impressions} impr • #{r.position.toFixed(1)}
          </span>
        </li>
      ))}
    </ul>
  );
}
