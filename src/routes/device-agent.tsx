import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Smartphone, Power, Volume2 } from "lucide-react";

export const Route = createFileRoute("/device-agent")({
  head: () => ({
    meta: [
      { title: "MANOVIK Device Agent — pair this device" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: DeviceAgentPage,
});

type AgentCommand = { id: string; kind: string; command: string };

const TOKEN_KEY = "manovik:device-token";

async function api(action: string, body: unknown, token?: string) {
  const res = await fetch(`/api/public/device/${action}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

function DeviceAgentPage() {
  const [code, setCode] = useState("");
  const [token, setToken] = useState<string | null>(() => {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  });
  const [deviceName, setDeviceName] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [lastCommand, setLastCommand] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const runningRef = useRef(false);
  const tokenRef = useRef<string | null>(token);
  tokenRef.current = token;

  const executeCommand = useCallback(async (cmd: AgentCommand) => {
    setLastCommand(`${cmd.kind}: ${cmd.command.slice(0, 80)}`);
    let result = "ok";
    try {
      if (cmd.kind === "open") {
        window.open(cmd.command, "_blank", "noopener");
      } else if (cmd.kind === "say") {
        const synth = window.speechSynthesis;
        if (synth) {
          synth.cancel();
          const utter = new SpeechSynthesisUtterance(cmd.command);
          utter.rate = 1;
          await new Promise<void>((resolve) => {
            utter.onend = () => resolve();
            utter.onerror = () => resolve();
            synth.speak(utter);
            setTimeout(resolve, 15000);
          });
        } else {
          result = "speech synthesis not supported";
        }
      } else if (cmd.kind === "notify") {
        if ("Notification" in window) {
          if (Notification.permission === "granted") {
            new Notification("MANOVIK", { body: cmd.command });
          } else if (Notification.permission !== "denied") {
            const perm = await Notification.requestPermission();
            if (perm === "granted") new Notification("MANOVIK", { body: cmd.command });
          }
        }
        alert(`MANOVIK: ${cmd.command}`);
      } else {
        result = `kind '${cmd.kind}' not supported by the web agent (use the Python agent for shell/script)`;
      }
    } catch (e) {
      result = `failed: ${e instanceof Error ? e.message : String(e)}`;
    }
    try {
      await api("result", { id: cmd.id, result, status: "done" }, tokenRef.current ?? undefined);
    } catch {
      // best effort
    }
  }, []);

  const pollLoop = useCallback(async () => {
    while (runningRef.current) {
      try {
        const data = await api("poll", {}, tokenRef.current ?? undefined);
        const commands: AgentCommand[] = data.commands ?? [];
        for (const cmd of commands) {
          await executeCommand(cmd);
        }
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Poll failed");
        if (e instanceof Error && /unauthorized/i.test(e.message)) {
          runningRef.current = false;
          setRunning(false);
          setToken(null);
          try {
            localStorage.removeItem(TOKEN_KEY);
          } catch {
            /* ignore */
          }
          break;
        }
      }
      await new Promise((r) => setTimeout(r, 3000));
    }
  }, [executeCommand]);

  const start = useCallback(() => {
    if (!tokenRef.current) return;
    runningRef.current = true;
    setRunning(true);
    void pollLoop();
  }, [pollLoop]);

  const stop = useCallback(() => {
    runningRef.current = false;
    setRunning(false);
    try {
      window.speechSynthesis?.cancel();
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (token && !running) start();
    return () => {
      runningRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pair = async () => {
    setError(null);
    const clean = code.trim().toUpperCase();
    if (!clean) {
      setError("Enter the pairing code from /devices");
      return;
    }
    try {
      const data = await api("pair", {
        code: clean,
        platform: /Android/i.test(navigator.userAgent)
          ? "android-web"
          : /iPhone|iPad/i.test(navigator.userAgent)
            ? "ios-web"
            : "web",
      });
      const t = data.deviceToken as string;
      setToken(t);
      setDeviceName(data.deviceId ? "This device" : null);
      try {
        localStorage.setItem(TOKEN_KEY, t);
      } catch {
        /* ignore */
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Pairing failed");
    }
  };

  const unpair = () => {
    stop();
    setToken(null);
    setDeviceName(null);
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-zinc-950 to-zinc-900">
      <Card className="w-full max-w-md bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-zinc-100">
            <Smartphone className="h-5 w-5 text-orange-400" />
            MANOVIK Device Agent
          </CardTitle>
          <CardDescription className="text-zinc-400">
            {token
              ? "This device is paired. Keep this page open — MANO can now control it by voice."
              : "Pair this phone/tablet so MANO can control it. Get a code at manovik.in/devices."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!token ? (
            <>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="Pairing code (e.g. X7K2P9QW)"
                className="bg-zinc-800 border-zinc-700 text-zinc-100 tracking-widest text-center"
                maxLength={8}
              />
              <Button onClick={pair} className="w-full bg-orange-500 hover:bg-orange-600">
                Pair this device
              </Button>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between rounded-lg bg-zinc-800 px-4 py-3">
                <div>
                  <div className="text-sm font-medium text-zinc-100">
                    {deviceName ?? "Paired device"}
                  </div>
                  <div className="text-xs text-zinc-400">
                    {running ? "Listening for commands…" : "Paused"}
                  </div>
                </div>
                <div
                  className={`h-3 w-3 rounded-full ${running ? "bg-green-400 animate-pulse" : "bg-zinc-600"}`}
                />
              </div>
              {lastCommand && (
                <div className="text-xs text-zinc-400 rounded-lg bg-zinc-800 px-3 py-2">
                  Last command: <span className="text-zinc-200">{lastCommand}</span>
                </div>
              )}
              <div className="flex gap-2">
                {running ? (
                  <Button onClick={stop} variant="outline" className="flex-1">
                    <Power className="h-4 w-4 mr-2" /> Pause
                  </Button>
                ) : (
                  <Button onClick={start} className="flex-1 bg-orange-500 hover:bg-orange-600">
                    <Volume2 className="h-4 w-4 mr-2" /> Resume
                  </Button>
                )}
                <Button onClick={unpair} variant="destructive" className="flex-1">
                  Unpair
                </Button>
              </div>
              <p className="text-xs text-zinc-500 text-center">
                Tip: add this page to your home screen. Keep it open in the background for instant
                voice control.
              </p>
            </>
          )}
          {error && <div className="text-sm text-red-400 text-center">{error}</div>}
        </CardContent>
      </Card>
    </div>
  );
}
