// Security Lab page — defensive web security scanner UI.
//
// URL input + Scan button; renders the 0-100 score and findings grouped by
// severity with remediation text. Strictly for sites the user owns or is
// authorized to test — the page states this boundary.
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  ArrowLeft,
  CheckCircle2,
  Info,
  Loader2,
  ScanLine,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
} from "lucide-react";
import { runWebScan } from "@/lib/seclab/seclab.functions";
import type { SecFinding, WebScanReport, FindingSeverity } from "@/lib/seclab/webscan.server";

const SEVERITY_STYLE: Record<FindingSeverity, { badge: string; icon: typeof ShieldAlert }> = {
  high: { badge: "bg-red-500/15 text-red-300 border-red-500/30", icon: ShieldX },
  medium: { badge: "bg-amber-500/15 text-amber-300 border-amber-500/30", icon: ShieldAlert },
  low: { badge: "bg-sky-500/15 text-sky-300 border-sky-500/30", icon: ShieldAlert },
  info: { badge: "bg-zinc-500/15 text-zinc-300 border-zinc-500/30", icon: Info },
};

const SEVERITY_ORDER: FindingSeverity[] = ["high", "medium", "low", "info"];

function scoreColor(score: number): string {
  if (score >= 80) return "text-emerald-300";
  if (score >= 60) return "text-amber-300";
  return "text-red-300";
}

function scoreRing(score: number): string {
  if (score >= 80) return "stroke-emerald-400";
  if (score >= 60) return "stroke-amber-400";
  return "stroke-red-400";
}

function FindingCard({ finding }: { finding: SecFinding }) {
  const style = SEVERITY_STYLE[finding.severity];
  const Icon = style.icon;
  return (
    <div className={`rounded-xl border p-4 ${style.badge} border`}>
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 h-5 w-5 shrink-0" />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{finding.check}</span>
            <span
              className={`rounded-full border px-2 py-0.5 text-xs font-medium uppercase tracking-wide ${style.badge}`}
            >
              {finding.severity}
            </span>
          </div>
          <p className="mt-1 text-sm opacity-90">{finding.detail}</p>
          <p className="mt-2 text-sm">
            <span className="font-medium">Fix: </span>
            <span className="opacity-90">{finding.remediation}</span>
          </p>
        </div>
      </div>
    </div>
  );
}

export function SecurityPage() {
  const [url, setUrl] = useState("");
  const [scanning, setScanning] = useState(false);
  const [report, setReport] = useState<WebScanReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const runScan = useServerFn(runWebScan);

  const startScan = async () => {
    const target = url.trim();
    if (!target) {
      toast.error("Enter a URL to scan.");
      return;
    }
    setScanning(true);
    setError(null);
    setReport(null);
    try {
      const res = await runScan({ data: { url: target } });
      if (res.ok) {
        setReport(res.report);
      } else {
        setError(res.error);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Scan failed.");
    } finally {
      setScanning(false);
    }
  };

  const grouped = (() => {
    if (!report) return [];
    return SEVERITY_ORDER.map((sev) => ({
      severity: sev,
      items: report.findings.filter((f) => f.severity === sev),
    })).filter((g) => g.items.length > 0);
  })();

  const circumference = 2 * Math.PI * 52;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-200"
        >
          <ArrowLeft className="h-4 w-4" /> Home
        </Link>

        <div className="mt-6 flex items-center gap-3">
          <ShieldCheck className="h-8 w-8 text-emerald-400" />
          <div>
            <h1 className="text-2xl font-bold">Security Lab</h1>
            <p className="text-sm text-zinc-400">
              Defensive, read-only security scan for websites you own or are authorized to test.
            </p>
          </div>
        </div>

        <div className="mt-6 flex gap-2">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && startScan()}
            placeholder="https://your-website.com"
            className="flex-1 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm outline-none placeholder:text-zinc-500 focus:border-emerald-500"
            disabled={scanning}
          />
          <button
            onClick={startScan}
            disabled={scanning}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanLine className="h-4 w-4" />}
            {scanning ? "Scanning…" : "Scan"}
          </button>
        </div>
        <p className="mt-2 text-xs text-zinc-500">
          Only scan sites you own or have written permission to test. Private/internal hosts are refused automatically.
        </p>

        {error && (
          <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
            {error}
          </div>
        )}

        {report && (
          <div className="mt-8">
            <div className="flex items-center gap-6 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6">
              <div className="relative h-32 w-32 shrink-0">
                <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
                  <circle cx="60" cy="60" r="52" fill="none" strokeWidth="10" className="stroke-zinc-800" />
                  <circle
                    cx="60"
                    cy="60"
                    r="52"
                    fill="none"
                    strokeWidth="10"
                    strokeLinecap="round"
                    className={scoreRing(report.score)}
                    strokeDasharray={circumference}
                    strokeDashoffset={circumference * (1 - report.score / 100)}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className={`text-3xl font-bold ${scoreColor(report.score)}`}>{report.score}</span>
                  <span className="text-xs text-zinc-500">/ 100</span>
                </div>
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm text-zinc-400">{report.finalUrl}</p>
                <p className="mt-1 text-sm">
                  {report.findings.filter((f) => f.severity === "high").length} high ·{" "}
                  {report.findings.filter((f) => f.severity === "medium").length} medium ·{" "}
                  {report.findings.filter((f) => f.severity === "low").length} low
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  Scanned {new Date(report.scannedAt).toLocaleString()}
                </p>
                {report.findings.length === 0 && (
                  <p className="mt-2 inline-flex items-center gap-1 text-sm text-emerald-300">
                    <CheckCircle2 className="h-4 w-4" /> No issues found.
                  </p>
                )}
              </div>
            </div>

            <div className="mt-6 space-y-6">
              {grouped.map((g) => (
                <div key={g.severity}>
                  <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-400">
                    {g.severity} ({g.items.length})
                  </h2>
                  <div className="space-y-3">
                    {g.items.map((f, i) => (
                      <FindingCard key={`${g.severity}-${i}`} finding={f} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
