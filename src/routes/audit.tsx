import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ShieldCheck, Loader2 } from "lucide-react";
import { listAuditLogs, parseAuditLogs, type AuditEntry } from "@/lib/audit.functions";

export const Route = createFileRoute("/audit")({
  component: AuditPage,
  head: () => ({
    meta: [
      { title: "MANOVIK AI — Audit log" },
      { name: "description", content: "Review the security audit log for your MANOVIK AI account — sign-ins, key actions, and access events." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "MANOVIK AI — Audit log" },
      { property: "og:description", content: "Security audit log for your MANOVIK AI account." },
      { property: "og:url", content: "https://manovik.in/audit" },
    ],
  }),
});

function AuditPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const { logsJson } = await listAuditLogs();
        setLogs(parseAuditLogs(logsJson));
      } finally {
        setBusy(false);
      }
    })();
  }, [user]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60 px-4 py-3 flex items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link to="/chat">
            <ArrowLeft className="size-4 mr-1" /> Back
          </Link>
        </Button>
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-5 text-primary" />
          <h1 className="text-lg font-semibold">Security audit log</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4">
        {busy ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading…
          </div>
        ) : logs.length === 0 ? (
          <p className="text-muted-foreground text-sm">No activity yet.</p>
        ) : (
          <ul className="divide-y divide-border/60 rounded-lg border border-border/60">
            {logs.map((l) => (
              <li key={l.id} className="p-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-mono text-xs px-2 py-0.5 rounded bg-secondary text-secondary-foreground">
                    {l.event_type}
                  </span>
                  <time className="text-xs text-muted-foreground">
                    {new Date(l.created_at).toLocaleString()}
                  </time>
                </div>
                {l.summary && (
                  <p className="mt-2 text-sm break-words">{l.summary}</p>
                )}
                <div className="mt-1 text-xs text-muted-foreground">
                  {l.ip ? `IP ${l.ip}` : "IP unknown"}
                  {l.user_agent ? ` • ${l.user_agent.slice(0, 80)}` : ""}
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
