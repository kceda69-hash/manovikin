import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Disc3, Link2, Loader2, Unlink } from "lucide-react";
import { getSpotifyStatus, unlinkSpotifyAccount } from "@/lib/integrations/spotify.functions";

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
 * Spotify link card for the Account page. Connect starts the OAuth
 * round-trip; the callback lands back here with ?sp=linked (or ?sp=error).
 */
export function SpotifyCard() {
  const qc = useQueryClient();
  const [connecting, setConnecting] = useState(false);

  const status = useQuery({
    queryKey: ["spotify-status"],
    queryFn: () => getSpotifyStatus(),
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sp = params.get("sp");
    if (!sp) return;
    if (sp === "linked") {
      toast.success("Spotify linked — MANO can DJ for you now.");
      void qc.invalidateQueries({ queryKey: ["spotify-status"] });
    } else {
      toast.error(
        params.get("reason") === "denied"
          ? "Spotify connection was cancelled."
          : "Spotify connection failed. Please try again.",
      );
    }
    params.delete("sp");
    params.delete("reason");
    const clean = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}`;
    window.history.replaceState(null, "", clean);
  }, [qc]);

  const connect = async () => {
    setConnecting(true);
    try {
      const { url } = (await authedGet("/api/integrations/spotify/connect")) as { url: string };
      window.location.href = url;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not start Spotify connection.");
      setConnecting(false);
    }
  };

  const unlink = async () => {
    try {
      await unlinkSpotifyAccount();
      toast.success("Spotify unlinked.");
      void qc.invalidateQueries({ queryKey: ["spotify-status"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Unlink failed.");
    }
  };

  const linked = !!status.data?.linked;

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Disc3 className="h-5 w-5" /> Spotify
        </CardTitle>
        <CardDescription>
          Link your Spotify once — then tell MANO things like “play some jazz” or “make me a
          workout playlist” in chat. Playback runs on your Spotify devices (Premium needed to
          start music). Tokens stay server-side and are never shown back to you.
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
              <Disc3 className="h-4 w-4" /> Linked
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
            Link Spotify
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
