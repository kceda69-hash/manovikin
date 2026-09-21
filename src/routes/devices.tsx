import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Cpu, Trash2, Send, RefreshCw } from "lucide-react";
import {
  listDevices,
  createDevice,
  deleteDevice,
  sendDeviceCommand,
  listDeviceCommands,
} from "@/lib/devices.functions";

export const Route = createFileRoute("/devices")({
  head: () => ({
    meta: [
      { title: "Connect Your Devices — MANOVIK JARVIS Mode" },
      {
        name: "description",
        content:
          "Pair your PC, laptop, or phone with MANOVIK and run real commands on your device from chat — JARVIS-style device control with an auditable command queue.",
      },
      { property: "og:title", content: "MANOVIK JARVIS device bridge" },
      {
        property: "og:description",
        content: "Pair a device with MANOVIK and run commands on it from chat.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: DevicesPage,
});

const AGENT_SCRIPT = `# MANOVIK device agent (Python 3, works on Windows / macOS / Linux / Termux)
# 1) pip install requests   2) python manovik_agent.py PAIRCODE
import subprocess, sys, time, platform, requests

BASE = "https://manovik.in/api/public/device"
code = sys.argv[1]
tok = requests.post(f"{BASE}/pair", json={"code": code, "platform": platform.system()}).json()["deviceToken"]
print("paired ✔  agent running — press Ctrl+C to stop")

while True:
    try:
        cmds = requests.post(f"{BASE}/poll", headers={"Authorization": f"Bearer {tok}"}).json()["commands"]
        for c in cmds:
            try:
                out = subprocess.run(c["command"], shell=True, capture_output=True, text=True, timeout=120)
                res, st = (out.stdout + out.stderr)[-15000:], "done"
            except Exception as e:
                res, st = str(e), "failed"
            requests.post(f"{BASE}/result", headers={"Authorization": f"Bearer {tok}"},
                          json={"id": c["id"], "result": res, "status": st})
    except Exception as e:
        print("poll error:", e)
    time.sleep(2)
`;

function DevicesPage() {
  const qc = useQueryClient();
  const fetchDevices = useServerFn(listDevices);
  const addDevice = useServerFn(createDevice);
  const removeDevice = useServerFn(deleteDevice);
  const runCommand = useServerFn(sendDeviceCommand);
  const fetchCommands = useServerFn(listDeviceCommands);

  const [name, setName] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [command, setCommand] = useState("");

  const devices = useQuery({ queryKey: ["devices"], queryFn: () => fetchDevices({}) });
  const commands = useQuery({
    queryKey: ["device-commands", selected],
    queryFn: () => fetchCommands({ data: { deviceId: selected! } }),
    enabled: !!selected,
    refetchInterval: 3000,
  });

  const create = useMutation({
    mutationFn: (n: string) => addDevice({ data: { name: n, platform: "unknown" } }),
    onSuccess: () => {
      setName("");
      toast.success("Device created — run the agent with the pairing code");
      void qc.invalidateQueries({ queryKey: ["devices"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const send = useMutation({
    mutationFn: () => runCommand({ data: { deviceId: selected!, kind: "shell", command } }),
    onSuccess: () => {
      setCommand("");
      void qc.invalidateQueries({ queryKey: ["device-commands", selected] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-10">
      <h1 className="text-3xl font-bold text-gradient">JARVIS device bridge</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Pair a PC, laptop, phone, or any device that can run Python. MANOVIK queues commands, your
        local agent executes them and streams the output back — every command is stored and
        auditable, and only you can see your own devices.
      </p>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Cpu className="h-4 w-4" /> Add a device
          </CardTitle>
          <CardDescription>Creates a one-time pairing code valid for 30 minutes.</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My MacBook"
            aria-label="Device name"
          />
          <Button
            disabled={!name.trim() || create.isPending}
            onClick={() => create.mutate(name.trim())}
          >
            Create
          </Button>
        </CardContent>
      </Card>

      <div className="mt-6 space-y-3">
        {(devices.data ?? []).map((d) => (
          <Card key={d.id} className={selected === d.id ? "ring-1 ring-primary" : undefined}>
            <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
              <div>
                <CardTitle className="text-base">{d.name}</CardTitle>
                <CardDescription>
                  {d.paired_at ? (
                    <>
                      Paired · {d.platform} ·{" "}
                      {d.last_seen_at
                        ? `last seen ${new Date(d.last_seen_at).toLocaleTimeString()}`
                        : "never polled"}
                    </>
                  ) : (
                    <>
                      Pairing code: <span className="font-mono text-foreground">{d.pair_code}</span>
                    </>
                  )}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={d.paired_at ? "default" : "secondary"}>
                  {d.paired_at ? "online-ready" : "awaiting pair"}
                </Badge>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSelected(selected === d.id ? null : d.id)}
                >
                  {selected === d.id ? "Close" : "Control"}
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`Remove ${d.name}`}
                  onClick={async () => {
                    await removeDevice({ data: { id: d.id } });
                    void qc.invalidateQueries({ queryKey: ["devices"] });
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            {selected === d.id && (
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    value={command}
                    onChange={(e) => setCommand(e.target.value)}
                    placeholder="echo hello from MANOVIK"
                    aria-label="Command to run on device"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && command.trim()) send.mutate();
                    }}
                  />
                  <Button
                    disabled={!command.trim() || send.isPending}
                    onClick={() => send.mutate()}
                  >
                    <Send className="mr-2 h-4 w-4" /> Run
                  </Button>
                  <Button
                    size="icon"
                    variant="outline"
                    aria-label="Refresh command results"
                    onClick={() => commands.refetch()}
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
                <div className="max-h-72 space-y-2 overflow-y-auto rounded-lg border border-border/50 p-3 text-xs">
                  {(commands.data ?? []).length === 0 && (
                    <p className="text-muted-foreground">No commands yet.</p>
                  )}
                  {(commands.data ?? []).map((c) => (
                    <div key={c.id} className="rounded-md bg-muted/40 p-2">
                      <div className="flex items-center justify-between gap-2">
                        <code className="font-mono">{c.command}</code>
                        <Badge variant="secondary">{c.status}</Badge>
                      </div>
                      {c.result && (
                        <pre className="mt-2 whitespace-pre-wrap break-words text-[11px] text-muted-foreground">
                          {c.result}
                        </pre>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            )}
          </Card>
        ))}
      </div>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="text-base">Local agent</CardTitle>
          <CardDescription>
            Save as <code>manovik_agent.py</code> and run it on the device with your pairing code.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="overflow-x-auto rounded-lg bg-muted/40 p-3 text-[11px] leading-relaxed">
            {AGENT_SCRIPT}
          </pre>
          <Button
            className="mt-3"
            variant="outline"
            onClick={() => {
              void navigator.clipboard.writeText(AGENT_SCRIPT);
              toast.success("Agent script copied");
            }}
          >
            Copy agent script
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
