import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { MapPin, Navigation, Globe, Loader2 } from "lucide-react";
import { listDevices, sendDeviceCommand } from "@/lib/devices.functions";

export const Route = createFileRoute("/track")({
  head: () => ({
    meta: [
      { title: "Location Tracker — MANOVIK" },
      {
        name: "description",
        content:
          "Track your own paired devices and geolocate IPs for security recon. Your devices only — never anyone else's.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: TrackPage,
});

interface GeoLookup {
  ip: string;
  country: string;
  city: string;
  lat: number;
  lon: number;
  isp: string;
}

/** OpenStreetMap embed centered on a marker. No API key needed. */
function osmEmbed(lat: number, lon: number): string {
  const d = 0.15;
  const bbox = `${lon - d},${lat - d},${lon + d},${lat + d}`;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lon}`;
}

function timeAgo(iso: string | null): string {
  if (!iso) return "never";
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return "just now";
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
  return `${Math.floor(ms / 86_400_000)}d ago`;
}

function TrackPage() {
  const fetchDevices = useServerFn(listDevices);
  const queueLocate = useServerFn(sendDeviceCommand);
  const devices = useQuery({ queryKey: ["devices"], queryFn: () => fetchDevices({}) });

  const [ip, setIp] = useState("");
  const [lookup, setLookup] = useState<GeoLookup | null>(null);
  const [looking, setLooking] = useState(false);
  const [locating, setLocating] = useState<string | null>(null);

  const handleLocate = async (deviceId: string, name: string) => {
    setLocating(deviceId);
    try {
      // NOTE: devices.functions sendDeviceCommand's kind enum needs "locate"
      // added for this call to validate (parent wires it).
      await queueLocate({ data: { deviceId, kind: "locate" as never, command: "locate" } });
      toast.success(`Locate request sent to "${name}" — it reports back within seconds.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Locate failed");
    } finally {
      setLocating(null);
    }
  };

  const handleIpLookup = async () => {
    const clean = ip.trim();
    if (!clean) return;
    setLooking(true);
    setLookup(null);
    try {
      // Same free GeoIP source as the server geo.ip tool; client-side here
      // so no new backend endpoint is needed.
      const res = await fetch(
        `https://ip-api.com/json/${encodeURIComponent(clean)}?fields=status,message,country,city,lat,lon,isp,query`,
      );
      const j = (await res.json()) as {
        status?: string;
        message?: string;
        country?: string;
        city?: string;
        lat?: number;
        lon?: number;
        isp?: string;
        query?: string;
      };
      if (j.status !== "success" || typeof j.lat !== "number") {
        throw new Error(j.message ?? "Lookup failed");
      }
      setLookup({
        ip: j.query ?? clean,
        country: j.country ?? "Unknown",
        city: j.city ?? "Unknown",
        lat: j.lat,
        lon: j.lon!,
        isp: j.isp ?? "Unknown",
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "IP lookup failed");
    } finally {
      setLooking(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <MapPin className="h-6 w-6" /> Location Tracker
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Your paired devices and IP geolocation for security recon. Your assets only.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Navigation className="h-5 w-5" /> My Devices
          </CardTitle>
          <CardDescription>
            Request a live location from a paired device. The device agent reports back with
            coordinates.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {devices.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading devices…</p>
          ) : (devices.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No paired devices yet. Pair one at <a className="underline" href="/devices">/devices</a>.
            </p>
          ) : (
            <ul className="space-y-3">
              {(devices.data ?? []).map((d) => (
                <li
                  key={d.id}
                  className="flex items-center justify-between gap-3 rounded-lg border p-3"
                >
                  <div>
                    <div className="font-medium">{d.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {d.platform ?? "unknown"} · last seen {timeAgo(d.last_seen_at ?? null)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {d.paired_at ? (
                      <Badge variant="outline">paired</Badge>
                    ) : (
                      <Badge variant="secondary">unpaired</Badge>
                    )}
                    <Button
                      size="sm"
                      disabled={!d.paired_at || locating === d.id}
                      onClick={() => handleLocate(d.id, d.name)}
                    >
                      {locating === d.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <MapPin className="h-4 w-4" />
                      )}
                      Locate
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" /> IP Geolocation
          </CardTitle>
          <CardDescription>
            Look up a public IP for security recon on infrastructure you own or are authorized to
            test.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="8.8.8.8"
              value={ip}
              onChange={(e) => setIp(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleIpLookup()}
              className="max-w-xs font-mono"
            />
            <Button onClick={handleIpLookup} disabled={looking || !ip.trim()}>
              {looking ? <Loader2 className="h-4 w-4 animate-spin" /> : "Locate IP"}
            </Button>
          </div>
          {lookup && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
                <div>
                  <div className="text-muted-foreground">IP</div>
                  <div className="font-mono">{lookup.ip}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Location</div>
                  <div>
                    {lookup.city}, {lookup.country}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Coordinates</div>
                  <div className="font-mono">
                    {lookup.lat.toFixed(4)}, {lookup.lon.toFixed(4)}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">ISP</div>
                  <div>{lookup.isp}</div>
                </div>
              </div>
              <iframe
                title={`Map of ${lookup.city}`}
                src={osmEmbed(lookup.lat, lookup.lon)}
                className="h-72 w-full rounded-lg border"
                loading="lazy"
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
