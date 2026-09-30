import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { House, Link2, Unlink, RefreshCw, Lightbulb } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/home")({
  head: () => ({
    meta: [
      { title: "Smart Home — MANOVIK Jarvis Mode" },
      {
        name: "description",
        content:
          "Link your Tuya / Smart Life account and control your lights and devices from MANO chat — Jarvis-style smart home control.",
      },
      { property: "og:title", content: "MANOVIK smart home" },
      {
        property: "og:description",
        content: "Link Tuya / Smart Life and control devices from chat.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: HomePage,
});

interface LinkStatus {
  linked: boolean;
  maskedClientId: string | null;
  region: string | null;
  linkedAt: string | null;
}

interface HomeDevice {
  id: string;
  name: string;
  category: string;
  online: boolean;
  status: Record<string, unknown>;
}

async function authedFetch(path: string, init?: RequestInit) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const res = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new Error(String(body.error ?? `Request failed (${res.status})`));
  return body;
}

const REGIONS = ["us", "eu", "in", "cn"] as const;

function HomePage() {
  const qc = useQueryClient();
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [uid, setUid] = useState("");
  const [region, setRegion] = useState<(typeof REGIONS)[number]>("us");

  const status = useQuery({
    queryKey: ["home-status"],
    queryFn: () => authedFetch("/api/home") as unknown as Promise<LinkStatus>,
  });
  const linked = status.data?.linked === true;

  const devices = useQuery({
    queryKey: ["home-devices"],
    queryFn: async () => {
      const body = await authedFetch("/api/home?devices=1");
      return (body.devices ?? []) as HomeDevice[];
    },
    enabled: linked,
    refetchInterval: 10_000,
  });

  const link = useMutation({
    mutationFn: () =>
      authedFetch("/api/home", {
        method: "POST",
        body: JSON.stringify({ op: "link", clientId, clientSecret, region, uid }),
      }),
    onSuccess: () => {
      setClientId("");
      setClientSecret("");
      setUid("");
      toast.success("Smart home linked");
      void qc.invalidateQueries({ queryKey: ["home-status"] });
      void qc.invalidateQueries({ queryKey: ["home-devices"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const unlink = useMutation({
    mutationFn: () =>
      authedFetch("/api/home", { method: "POST", body: JSON.stringify({ op: "unlink" }) }),
    onSuccess: () => {
      toast.success("Smart home unlinked");
      void qc.invalidateQueries({ queryKey: ["home-status"] });
      void qc.invalidateQueries({ queryKey: ["home-devices"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleDevice = useMutation({
    mutationFn: (deviceId: string) =>
      authedFetch("/api/home", {
        method: "POST",
        body: JSON.stringify({ op: "command", deviceId, action: "toggle" }),
      }),
    onSuccess: (r) => {
      toast.success(String((r as Record<string, unknown>).message ?? "Done"));
      void qc.invalidateQueries({ queryKey: ["home-devices"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const formReady = clientId.trim() && clientSecret.trim() && uid.trim();

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-10">
      <h1 className="flex items-center gap-2 text-3xl font-bold text-gradient">
        <House className="h-7 w-7" /> Smart home
      </h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Link your Tuya / Smart Life account once, then tell MANO things like{" "}
        <em>“turn off the bedroom lights”</em> in chat. Your credentials are stored
        server-side only and are never shown back to you or anyone else.
      </p>

      {status.isLoading && <p className="mt-6 text-sm text-muted-foreground">Checking link status…</p>}

      {!status.isLoading && !linked && (
        <>
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-lg">Link your account — 3 steps</CardTitle>
              <CardDescription>Free, takes about five minutes.</CardDescription>
            </CardHeader>
            <CardContent>
              <ol className="list-decimal space-y-3 pl-5 text-sm">
                <li>
                  Create a free project at{" "}
                  <a
                    className="text-primary underline"
                    href="https://iot.tuya.com"
                    target="_blank"
                    rel="noreferrer"
                  >
                    iot.tuya.com
                  </a>{" "}
                  and note down the <strong>Client ID</strong> and <strong>Client Secret</strong>{" "}
                  from the project overview.
                </li>
                <li>
                  In the Tuya IoT Platform, go to <strong>Link Tuya App Account</strong> and link
                  your Smart Life (or Tuya Smart) app account — this gives you your account{" "}
                  <strong>UID</strong>.
                </li>
                <li>
                  Paste the Client ID, Client Secret and UID below. MANOVIK validates them against
                  Tuya before saving anything.
                </li>
              </ol>
            </CardContent>
          </Card>

          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Link2 className="h-4 w-4" /> Credentials
              </CardTitle>
              <CardDescription>
                Sent straight to the server over HTTPS. Nothing is echoed back — you will only
                ever see a masked identifier.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="mb-1 block text-xs text-muted-foreground" htmlFor="tuya-client-id">
                  Client ID
                </label>
                <Input
                  id="tuya-client-id"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  placeholder="Tuya IoT project Client ID"
                  autoComplete="off"
                />
              </div>
              <div>
                <label
                  className="mb-1 block text-xs text-muted-foreground"
                  htmlFor="tuya-client-secret"
                >
                  Client Secret
                </label>
                <Input
                  id="tuya-client-secret"
                  type="password"
                  value={clientSecret}
                  onChange={(e) => setClientSecret(e.target.value)}
                  placeholder="Tuya IoT project Client Secret"
                  autoComplete="off"
                />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="mb-1 block text-xs text-muted-foreground" htmlFor="tuya-uid">
                    UID
                  </label>
                  <Input
                    id="tuya-uid"
                    value={uid}
                    onChange={(e) => setUid(e.target.value)}
                    placeholder="Linked app account UID"
                    autoComplete="off"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground" htmlFor="tuya-region">
                    Data center
                  </label>
                  <select
                    id="tuya-region"
                    value={region}
                    onChange={(e) => setRegion(e.target.value as (typeof REGIONS)[number])}
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {REGIONS.map((r) => (
                      <option key={r} value={r}>
                        {r.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <Button disabled={!formReady || link.isPending} onClick={() => link.mutate()}>
                {link.isPending ? "Validating with Tuya…" : "Link account"}
              </Button>
            </CardContent>
          </Card>
        </>
      )}

      {!status.isLoading && linked && (
        <>
          <Card className="mt-6">
            <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
              <div>
                <CardTitle className="text-lg">Tuya / Smart Life</CardTitle>
                <CardDescription>
                  Client ID{" "}
                  <span className="font-mono text-foreground">{status.data?.maskedClientId}</span>
                  {" · "}region {status.data?.region?.toUpperCase()}
                  {status.data?.linkedAt &&
                    ` · linked ${new Date(status.data.linkedAt).toLocaleDateString()}`}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Badge>linked</Badge>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={unlink.isPending}
                  onClick={() => unlink.mutate()}
                >
                  <Unlink className="mr-2 h-3.5 w-3.5" /> Unlink
                </Button>
              </div>
            </CardHeader>
          </Card>

          <div className="mt-6 flex items-center justify-between">
            <h2 className="text-xl font-semibold">Devices</h2>
            <Button
              size="icon"
              variant="outline"
              aria-label="Refresh devices"
              onClick={() => devices.refetch()}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>

          <div className="mt-3 space-y-3">
            {devices.isLoading && <p className="text-sm text-muted-foreground">Loading devices…</p>}
            {devices.data?.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No devices found on this Tuya account yet.
              </p>
            )}
            {(devices.data ?? []).map((d) => (
              <Card key={d.id}>
                <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Lightbulb className="h-4 w-4" /> {d.name}
                    </CardTitle>
                    <CardDescription>
                      {d.category}
                      {d.status.switch_led !== undefined && ` · ${d.status.switch_led ? "on" : "off"}`}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={d.online ? "default" : "secondary"}>
                      {d.online ? "online" : "offline"}
                    </Badge>
                    <Button
                      size="sm"
                      disabled={toggleDevice.isPending}
                      onClick={() => toggleDevice.mutate(d.id)}
                    >
                      Toggle
                    </Button>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>

          <p className="mt-6 text-sm text-muted-foreground">
            Tip: you can also control these from chat — try <em>“turn off the bedroom lights”</em>.
          </p>
        </>
      )}
    </main>
  );
}
