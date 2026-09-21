import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, ShieldAlert, PackageCheck } from "lucide-react";
import { runSupplyChainScan, parseSupplyChainReport } from "@/lib/supply-chain.functions";
import type { ScanReport, Severity } from "@/lib/supply-chain/analyzer";

const SEVERITY_STYLE: Record<Severity, string> = {
  critical: "bg-destructive text-destructive-foreground",
  high: "bg-destructive/80 text-destructive-foreground",
  medium: "bg-primary/20 text-primary",
  low: "bg-secondary text-secondary-foreground",
  info: "bg-muted text-muted-foreground",
};

const CATEGORY_LABEL: Record<string, string> = {
  dependency: "Dependency",
  provenance: "Provenance",
  "ai-service": "Third-party AI",
  "model-config": "Model / API config",
};

export function SupplyChainTab() {
  const [report, setReport] = useState<ScanReport | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const scan = async () => {
    setBusy(true);
    setError(null);
    try {
      const { reportJson } = await runSupplyChainScan();
      setReport(parseSupplyChainReport(reportJson));
    } catch {
      setError("Scan failed. Check server logs.");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void scan();
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold flex items-center gap-2">
            <ShieldAlert className="size-4 text-primary" /> Supply chain &amp; model provenance
          </h2>
          <p className="text-sm text-muted-foreground">
            Verifies dependency pinning and registry provenance, third-party AI services, and
            model/API configuration risks.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => void scan()} disabled={busy}>
          <RefreshCw className={`size-4 mr-1 ${busy ? "animate-spin" : ""}`} /> Rescan
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {busy && !report ? (
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="size-4 animate-spin" /> Scanning…
        </div>
      ) : report ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="p-3">
              <p className="text-xs text-muted-foreground">Score</p>
              <p className="text-2xl font-semibold">{report.score}/100</p>
            </Card>
            <Card className="p-3">
              <p className="text-xs text-muted-foreground">Findings</p>
              <p className="text-2xl font-semibold">{report.findings.length}</p>
            </Card>
            <Card className="p-3">
              <p className="text-xs text-muted-foreground">Packages</p>
              <p className="text-2xl font-semibold">
                {report.stats.dependencies + report.stats.devDependencies}
              </p>
            </Card>
            <Card className="p-3">
              <p className="text-xs text-muted-foreground">Models checked</p>
              <p className="text-2xl font-semibold">{report.stats.modelsChecked}</p>
            </Card>
          </div>

          <p className="text-xs text-muted-foreground">
            Lockfile: {report.stats.lockfile ?? "none"} · AI hosts: {report.stats.aiHosts} · Last
            scan: {new Date(report.generatedAt).toLocaleString()}
          </p>

          {report.findings.length === 0 ? (
            <Card className="p-6 flex items-center gap-3">
              <PackageCheck className="size-5 text-primary" />
              <p className="text-sm">No supply-chain or model provenance risks detected.</p>
            </Card>
          ) : (
            <ul className="space-y-3">
              {report.findings.map((f) => (
                <li key={f.id}>
                  <Card className="p-4 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className={SEVERITY_STYLE[f.severity]}>{f.severity}</Badge>
                      <Badge variant="outline">{CATEGORY_LABEL[f.category] ?? f.category}</Badge>
                      <span className="font-medium text-sm">{f.title}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{f.detail}</p>
                    <p className="text-sm">
                      <span className="text-muted-foreground">Fix: </span>
                      {f.remediation}
                    </p>
                    {f.evidence && (
                      <p className="font-mono text-xs bg-secondary text-secondary-foreground rounded px-2 py-1 inline-block break-all">
                        {f.evidence}
                      </p>
                    )}
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : null}
    </div>
  );
}
