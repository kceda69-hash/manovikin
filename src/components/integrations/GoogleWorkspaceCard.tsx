import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { CalendarDays, Link2, Loader2, Mail, Unlink } from "lucide-react";
import {
  getGoogleWorkspaceStatus,
  unlinkGoogleWorkspace,
} from "@/lib/integrations/google-workspace.functions";

async function authedGet(path: string): Promise<Record<string, unknown>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const res = await fetch(path, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new Error(String(body.error ?? `Request failed (${res.status})`));
  return body;
}

/**
 * Google Workspace (Gmail + Calendar) link card for the Account page.
 * Connect starts the OAuth round-trip; the callback lands back here with
 * ?gw=linked (or ?gw=error&reason=...).
 */
export function GoogleWorkspaceCard() {
  const qc = useQueryClient();
  const [connecting, setConnecting] = useState(false);

  const status = useQuery({
    queryKey: ["google-workspace-status"],
    queryFn: () => getGoogleWorkspaceStatus(),
  });

  // Surface the OAuth callback result once.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const gw = params.get("gw");
    if (!gw) return;
    if (gw === "linked") {
      toast.success("Google Workspace linked — MANO can now read your mail and calendar.");
      void qc.invalidateQueries({ queryKey: ["google-workspace-status"] });
    } else {
      const reason = params.get("reason");
      toast.error(
        reason === "denied"
          ? "Google connection was cancelled."
          : "Google connection failed. Please try again.",
      );
    }
    params.delete("gw");
    params.delete("reason");
    const clean = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}`;
    window.history.replaceState(null, "", clean);
  }, [qc]);

  const connect = async () => {
    setConnecting(true);
    try {
      const { url } = (await authedGet("/api/integrations/google/connect")) as { url: string };
      window.location.href = url;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not start Google connection.");
      setConnecting(false);
    }
  };

  const unlink = async () => {
    try {
      await unlinkGoogleWorkspace();
      toast.success("Google Workspace unlinked.");
      void qc.invalidateQueries({ queryKey: ["google-workspace-status"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Unlink failed.");
    }
  };

  const linked = !!status.data?.linked;

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Mail className="h-5 w-5" /> Google Workspace
        </CardTitle>
        <CardDescription>
          Link your Gmail and Google Calendar once — then tell MANO things like “summarize my
          unread email” or “what’s on my calendar tomorrow” in chat. Tokens stay server-side and
          are never shown back to you.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {status.isLoading ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Checking link status…
          </p>
        ) : linked ? (
          <div className="flex items-center justify-between gap-4">
            <p className="flex items-center gap-2 text-sm text-emerald-400">
              <CalendarDays className="h-4 w-4" /> Linked
              {status.data?.linkedAt && (
                <span className="text-muted-foreground">
                  since {new Date(status.data.linkedAt).toLocaleDateString()}
                </span>
              )}
            </p>
            <Button variant="ghost" size="sm" onClick={unlink}>
              <Unlink className="mr-1.5 h-4 w-4" /> Unlink
            </Button>
          </div>
        ) : (
          <Button onClick={connect} disabled={connecting}>
            {connecting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Link2 className="mr-2 h-4 w-4" />
            )}
            Link Gmail + Calendar
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
