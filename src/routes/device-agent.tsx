import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Smartphone, Power, Volume2 } from "lucide-react";
import {
  detectHotword,
  AMBIENT_WATCH_INTERVAL_MS,
  MAX_AMBIENT_FRAME_DIM,
} from "@/lib/device-agent-utils";
import { captureVideoFrame, blobToFile, stopStream, canUseCamera } from "@/lib/capture";
import { VOICE_LANG_STORAGE_KEY } from "@/lib/voice-langs";

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

// Minimal SpeechRecognition typings (mirrors src/routes/chat.tsx).
interface SpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}

interface SpeechRecognitionResult {
  readonly length: number;
  readonly isFinal: boolean;
  readonly [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  readonly [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionEvent extends Event {
  readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string;
}

interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognitionInstance;
}

interface WindowWithSpeechRecognition {
  readonly SpeechRecognition?: SpeechRecognitionConstructor;
  readonly webkitSpeechRecognition?: SpeechRecognitionConstructor;
}

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
      } else if (cmd.kind === "vibrate") {
        if ("vibrate" in navigator) {
          const pattern = cmd.command
            .split(",")
            .map((s) => parseInt(s.trim(), 10))
            .filter((n) => Number.isFinite(n) && n > 0)
            .slice(0, 10);
          result = navigator.vibrate(pattern.length > 0 ? pattern : 200)
            ? `vibrated (${(pattern.length > 0 ? pattern : [200]).join(",")}ms)`
            : "vibration not supported on this device";
        } else {
          result = "vibration not supported on this device";
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

  // ---- "Hey MANO" hotword mode ------------------------------------------------
  const [hotwordOn, setHotwordOn] = useState(false);
  const [hotwordHint, setHotwordHint] = useState<string | null>(null);
  const [hotwordPulse, setHotwordPulse] = useState(false);
  const hotwordOnRef = useRef(false);
  const hotwordRecRef = useRef<SpeechRecognitionInstance | null>(null);
  const hotwordPulseTimer = useRef<number | null>(null);

  const teardownHotword = useCallback(() => {
    hotwordOnRef.current = false;
    setHotwordOn(false);
    try {
      hotwordRecRef.current?.stop();
    } catch {
      /* ignore */
    }
    hotwordRecRef.current = null;
    if (hotwordPulseTimer.current !== null) {
      window.clearTimeout(hotwordPulseTimer.current);
      hotwordPulseTimer.current = null;
    }
    setHotwordPulse(false);
  }, []);

  const startHotword = useCallback(() => {
    const w = window as unknown as WindowWithSpeechRecognition;
    const SR = w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
    if (!SR) {
      setHotwordHint("Hotword listening isn't supported in this browser.");
      return;
    }
    let rec: SpeechRecognitionInstance;
    try {
      rec = new SR();
    } catch {
      setHotwordHint("Could not start the microphone.");
      return;
    }
    rec.continuous = true;
    rec.interimResults = true;
    try {
      const savedLang = localStorage.getItem(VOICE_LANG_STORAGE_KEY);
      if (savedLang) rec.lang = savedLang;
    } catch {
      /* ignore */
    }
    rec.onresult = (event: SpeechRecognitionEvent) => {
      let transcript = "";
      try {
        for (let i = 0; i < event.results.length; i++) {
          transcript += event.results[i][0]?.transcript + " ";
        }
      } catch {
        return;
      }
      if (!detectHotword(transcript)) return;
      try {
        navigator.vibrate?.(60);
      } catch {
        /* ignore */
      }
      setHotwordPulse(true);
      if (hotwordPulseTimer.current !== null) window.clearTimeout(hotwordPulseTimer.current);
      hotwordPulseTimer.current = window.setTimeout(() => setHotwordPulse(false), 1200);
      // Recognition tends to stop; restarting makes the next hotword catchable.
      try {
        rec.stop();
      } catch {
        /* ignore — onend will restart it */
      }
      window.dispatchEvent(
        new CustomEvent("mano-hotword", { detail: { transcript: transcript.trim() } }),
      );
    };
    rec.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        setHotwordHint("Microphone blocked — allow mic access for this page, then try again.");
        teardownHotword();
      }
      // "no-speech" / "audio-capture" etc. just end the turn; onend restarts.
    };
    rec.onend = () => {
      if (!hotwordOnRef.current) return;
      window.setTimeout(() => {
        if (!hotwordOnRef.current || !hotwordRecRef.current) return;
        try {
          hotwordRecRef.current.start();
        } catch {
          /* already started or browser busy; the next onend will retry */
        }
      }, 250);
    };
    hotwordRecRef.current = rec;
    hotwordOnRef.current = true;
    setHotwordOn(true);
    setHotwordHint(null);
    try {
      rec.start();
    } catch {
      setHotwordHint("Could not start the microphone.");
      teardownHotword();
    }
  }, [teardownHotword]);

  const toggleHotword = useCallback(() => {
    if (hotwordOnRef.current) {
      teardownHotword();
    } else {
      startHotword();
    }
  }, [startHotword, teardownHotword]);

  // ---- Ambient Watch ---------------------------------------------------------
  const [ambientOn, setAmbientOn] = useState(false);
  const [ambientStatus, setAmbientStatus] = useState<string | null>(null);
  const ambientTimerRef = useRef<number | null>(null);
  const ambientBusyRef = useRef(false);

  /** Capture one camera frame and POST it to the ambient-frame endpoint. */
  const captureAmbientFrame = useCallback(async () => {
    if (ambientBusyRef.current || !tokenRef.current) return;
    ambientBusyRef.current = true;
    try {
      if (!canUseCamera()) throw new Error("Camera is not available on this device.");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 } },
      });
      try {
        const video = document.createElement("video");
        video.muted = true;
        video.playsInline = true;
        video.srcObject = stream;
        await video.play();
        await new Promise<void>((resolve, reject) => {
          const done = () => {
            video.removeEventListener("playing", done);
            resolve();
          };
          video.addEventListener("playing", done);
          window.setTimeout(() => reject(new Error("Camera frame timed out.")), 8000);
        });
        const blob = await captureVideoFrame(video, MAX_AMBIENT_FRAME_DIM);
        const form = new FormData();
        form.append("frame", blobToFile(blob, "ambient"));
        const res = await fetch("/api/public/device/ambient-frame", {
          method: "POST",
          headers: { Authorization: `Bearer ${tokenRef.current}` },
          body: form,
        });
        if (!res.ok) throw new Error(`Frame upload failed (${res.status}).`);
        setAmbientStatus(`Last check ${new Date().toLocaleTimeString()}.`);
      } finally {
        // Never keep the camera on between captures.
        stopStream(stream);
      }
    } catch (e) {
      setAmbientStatus(e instanceof Error ? e.message : "Ambient capture failed.");
    } finally {
      ambientBusyRef.current = false;
    }
  }, []);

  const startAmbient = useCallback(() => {
    if (ambientTimerRef.current !== null) return;
    setAmbientOn(true);
    setAmbientStatus("Capturing first frame…");
    void captureAmbientFrame();
    ambientTimerRef.current = window.setInterval(() => {
      void captureAmbientFrame();
    }, AMBIENT_WATCH_INTERVAL_MS);
  }, [captureAmbientFrame]);

  const stopAmbient = useCallback(() => {
    setAmbientOn(false);
    if (ambientTimerRef.current !== null) {
      window.clearInterval(ambientTimerRef.current);
      ambientTimerRef.current = null;
    }
    setAmbientStatus(null);
  }, []);

  const toggleAmbient = useCallback(() => {
    if (ambientTimerRef.current !== null) {
      stopAmbient();
    } else {
      startAmbient();
    }
  }, [startAmbient, stopAmbient]);

  useEffect(() => {
    if (token && !running) start();
    return () => {
      runningRef.current = false;
      teardownHotword();
      if (ambientTimerRef.current !== null) {
        window.clearInterval(ambientTimerRef.current);
        ambientTimerRef.current = null;
      }
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
      {ambientOn && (
        <div className="fixed top-0 inset-x-0 z-50 bg-red-600 text-white text-center text-sm font-semibold py-1.5">
          🔴 WATCHING — Ambient Watch active
        </div>
      )}
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
              <div className="grid grid-cols-2 gap-2">
                <Button
                  onClick={toggleHotword}
                  variant={hotwordOn ? "default" : "outline"}
                  className={`${hotwordOn ? "bg-orange-500 hover:bg-orange-600" : ""} ${
                    hotwordPulse ? "ring-2 ring-orange-300 animate-pulse" : ""
                  }`}
                >
                  🎙️ Hey MANO
                </Button>
                <Button
                  onClick={toggleAmbient}
                  variant={ambientOn ? "default" : "outline"}
                  className={ambientOn ? "bg-red-600 hover:bg-red-700" : ""}
                >
                  👁️ Ambient Watch
                </Button>
              </div>
              {hotwordOn && (
                <p className="text-xs text-zinc-500 text-center">
                  🎙️ Listening for “Hey MANO”…
                  <br />
                  Works while this page is open.
                </p>
              )}
              {hotwordHint && (
                <p className="text-xs text-amber-400 text-center">{hotwordHint}</p>
              )}
              {ambientOn && (
                <p className="text-xs text-red-400 text-center">
                  Ambient Watch is on — the camera takes one frame every 5 minutes and only a
                  text observation is stored.
                  {ambientStatus ? <span className="text-zinc-400"> {ambientStatus}</span> : null}
                </p>
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
